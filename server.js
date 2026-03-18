import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;
const port = Number(process.env.PORT || 3000);
const dbPath = path.join(root, 'data', 'db.json');
const EQUIP_SLOTS = ['head', 'torso', 'legs', 'feet', 'accessory'];
const TRADE_SLOT_COUNT = 6;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const defaultDb = {
  users: [],
  sessions: [],
  friendRequests: [],
  trades: [],
  chatMessages: [],
  directMessages: []
};

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
  }
}

function loadDb() {
  ensureDb();
  try {
    return { ...defaultDb, ...JSON.parse(fs.readFileSync(dbPath, 'utf8')) };
  } catch {
    return structuredClone(defaultDb);
  }
}

let db = loadDb();
const sseClients = new Set();

function saveDb() {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  const hash = crypto.scryptSync(password, user.salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
}

function createDefaultGameState() {
  return {
    money: 15000,
    exp: 0,
    level: 1,
    workClicks: 0,
    energy: 100,
    inventory: [],
    ownedCars: [],
    ownedProperty: [],
    equipped: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null]))
  };
}

function sanitizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sanitizeItem(item) {
  if (!item || typeof item !== 'object') return null;
  const category = String(item.category || '').trim();
  if (!category) return null;

  const sanitized = {
    id: String(item.id || 'item'),
    instanceId: String(item.instanceId || crypto.randomUUID()),
    category,
    icon: String(item.icon || '📦'),
    name: String(item.name || 'Предмет').slice(0, 80),
    rarity: String(item.rarity || 'common'),
    price: sanitizeNumber(item.price, 0),
    stats: item.stats && typeof item.stats === 'object'
      ? Object.fromEntries(Object.entries(item.stats).filter(([, value]) => Number.isFinite(Number(value))).map(([key, value]) => [key, Number(value)]))
      : {}
  };

  if (item.slot) sanitized.slot = String(item.slot);
  return sanitized;
}

function sanitizeCollection(items) {
  return Array.isArray(items) ? items.map(sanitizeItem).filter(Boolean) : [];
}

function sanitizeEquipped(equipped = {}) {
  return Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, sanitizeItem(equipped[slot]) || null]));
}

function sanitizeGameState(raw = {}) {
  const defaults = createDefaultGameState();
  return {
    ...defaults,
    money: sanitizeNumber(raw.money, defaults.money),
    exp: sanitizeNumber(raw.exp, defaults.exp),
    level: sanitizeNumber(raw.level, defaults.level),
    workClicks: sanitizeNumber(raw.workClicks, defaults.workClicks),
    energy: sanitizeNumber(raw.energy, defaults.energy),
    inventory: sanitizeCollection(raw.inventory),
    ownedCars: sanitizeCollection(raw.ownedCars),
    ownedProperty: sanitizeCollection(raw.ownedProperty),
    equipped: sanitizeEquipped(raw.equipped)
  };
}

function ensureUserGameState(user) {
  user.gameState = sanitizeGameState(user.gameState);
  return user.gameState;
}

function createSession(userId) {
  const token = crypto.randomUUID();
  db.sessions = [...db.sessions.filter((session) => session.userId !== userId), { token, userId, createdAt: new Date().toISOString() }];
  saveDb();
  return token;
}

function getSession(token) {
  return db.sessions.find((session) => session.token === token);
}

function getUserByToken(token) {
  if (!token) return null;
  const session = getSession(token);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function getUserPublic(user) {
  return user ? { id: user.id, username: user.username, createdAt: user.createdAt } : null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 100_000) {
        reject(new Error('payload_too_large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseToken(reqUrl, payload = {}) {
  const url = new URL(reqUrl, 'http://localhost');
  return payload.token || url.searchParams.get('token') || '';
}

function getOnlineUserIds() {
  return [...new Set([...sseClients].map((client) => client.userId).filter(Boolean))];
}

function getTradeStatusLabel(status) {
  return {
    pending: 'ожидает ответа',
    active: 'активен',
    completed: 'завершён',
    declined: 'отклонён',
    cancelled: 'отменён'
  }[status] || status;
}

function mapTradeForUser(trade, user) {
  const meId = user.id;
  const partnerId = trade.fromUserId === meId ? trade.toUserId : trade.fromUserId;
  const partner = db.users.find((entry) => entry.id === partnerId);
  const ownSlots = Array.from({ length: TRADE_SLOT_COUNT }, (_, index) => sanitizeItem(trade.slots?.[meId]?.[index]) || null);
  const partnerSlots = Array.from({ length: TRADE_SLOT_COUNT }, (_, index) => sanitizeItem(trade.slots?.[partnerId]?.[index]) || null);

  return {
    id: trade.id,
    status: trade.status,
    statusLabel: getTradeStatusLabel(trade.status),
    createdAt: trade.createdAt,
    updatedAt: trade.updatedAt,
    isRequester: trade.fromUserId === meId,
    partner: getUserPublic(partner),
    from: getUserPublic(db.users.find((entry) => entry.id === trade.fromUserId)),
    to: getUserPublic(db.users.find((entry) => entry.id === trade.toUserId)),
    ownSlots,
    partnerSlots,
    ownConfirmed: Boolean(trade.confirmed?.[meId]),
    partnerConfirmed: Boolean(trade.confirmed?.[partnerId])
  };
}

function buildSocialPayload(user) {
  const onlineUserIds = getOnlineUserIds();
  const friends = db.friendRequests
    .filter((request) => request.status === 'accepted' && (request.fromUserId === user.id || request.toUserId === user.id))
    .map((request) => {
      const friendId = request.fromUserId === user.id ? request.toUserId : request.fromUserId;
      const friend = db.users.find((entry) => entry.id === friendId);
      return friend ? { ...getUserPublic(friend), online: onlineUserIds.includes(friend.id) } : null;
    })
    .filter(Boolean);

  const incomingRequests = db.friendRequests
    .filter((request) => request.status === 'pending' && request.toUserId === user.id)
    .map((request) => ({
      id: request.id,
      from: getUserPublic(db.users.find((entry) => entry.id === request.fromUserId)),
      createdAt: request.createdAt
    }));

  const outgoingRequests = db.friendRequests
    .filter((request) => request.status === 'pending' && request.fromUserId === user.id)
    .map((request) => ({
      id: request.id,
      to: getUserPublic(db.users.find((entry) => entry.id === request.toUserId)),
      createdAt: request.createdAt
    }));

  const relatedTrades = db.trades
    .filter((trade) => trade.fromUserId === user.id || trade.toUserId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    incomingTradeRequests: relatedTrades.filter((trade) => trade.status === 'pending' && trade.toUserId === user.id).map((trade) => mapTradeForUser(trade, user)),
    outgoingTradeRequests: relatedTrades.filter((trade) => trade.status === 'pending' && trade.fromUserId === user.id).map((trade) => mapTradeForUser(trade, user)),
    activeTrade: relatedTrades.find((trade) => trade.status === 'active') ? mapTradeForUser(relatedTrades.find((trade) => trade.status === 'active'), user) : null,
    tradeHistory: relatedTrades.filter((trade) => ['completed', 'declined', 'cancelled'].includes(trade.status)).slice(0, 10).map((trade) => mapTradeForUser(trade, user)),
    chatMessages: db.chatMessages.slice(-30),
    onlineCount: onlineUserIds.length
  };
}

function buildClientPayload(user) {
  return {
    social: buildSocialPayload(user),
    gameState: ensureUserGameState(user)
  };
}

function broadcast(event, payload) {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    client.res.write(chunk);
  }
}

function pushSocialUpdate() {
  const onlineCount = getOnlineUserIds().length;
  broadcast('presence', { onlineCount });

  for (const client of sseClients) {
    if (!client.userId) continue;
    const user = db.users.find((entry) => entry.id === client.userId);
    if (!user) continue;
    client.res.write(`event: social_data\ndata: ${JSON.stringify(buildClientPayload(user))}\n\n`);
  }
}

function isFriends(userId, targetId) {
  return db.friendRequests.some((request) => (
    request.status === 'accepted'
    && ((request.fromUserId === userId && request.toUserId === targetId) || (request.fromUserId === targetId && request.toUserId === userId))
  ));
}

function buildFriendProfilePayload(friend) {
  const gameState = ensureUserGameState(friend);
  return {
    friend: getUserPublic(friend),
    gameState: {
      equipped: sanitizeEquipped(gameState.equipped),
      inventory: sanitizeCollection(gameState.inventory),
      ownedCars: sanitizeCollection(gameState.ownedCars),
      ownedProperty: sanitizeCollection(gameState.ownedProperty)
    }
  };
}

function mapDirectMessage(message, user) {
  const author = db.users.find((entry) => entry.id === message.fromUserId);
  return {
    id: message.id,
    text: message.text,
    createdAt: message.createdAt,
    fromUserId: message.fromUserId,
    toUserId: message.toUserId,
    own: message.fromUserId === user.id,
    author: getUserPublic(author)
  };
}

function getDirectThread(userId, friendId) {
  return db.directMessages
    .filter((message) => (
      (message.fromUserId === userId && message.toUserId === friendId)
      || (message.fromUserId === friendId && message.toUserId === userId)
    ))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function broadcastToUsers(userIds, event, payload) {
  const targets = new Set(userIds);
  const chunk = `event: ${event}
data: ${JSON.stringify(payload)}

`;
  for (const client of sseClients) {
    if (targets.has(client.userId)) client.res.write(chunk);
  }
}

function hasOpenTrade(userId) {
  return db.trades.some((trade) => (trade.fromUserId === userId || trade.toUserId === userId) && ['pending', 'active'].includes(trade.status));
}

function findTrade(tradeId, userId, statuses = ['pending', 'active']) {
  return db.trades.find((trade) => trade.id === tradeId && (trade.fromUserId === userId || trade.toUserId === userId) && statuses.includes(trade.status));
}

function getTradeableCollections(gameState) {
  return [
    ['inventory', gameState.inventory],
    ['ownedCars', gameState.ownedCars],
    ['ownedProperty', gameState.ownedProperty]
  ];
}

function findTradeableItem(gameState, instanceId) {
  for (const [collectionName, collection] of getTradeableCollections(gameState)) {
    const index = collection.findIndex((item) => item.instanceId === instanceId);
    if (index !== -1) return { collectionName, index, item: collection[index] };
  }
  return null;
}

function takeTradeableItem(gameState, instanceId) {
  const found = findTradeableItem(gameState, instanceId);
  if (!found) return null;
  const [removed] = gameState[found.collectionName].splice(found.index, 1);
  return removed;
}

function addTradeableItem(gameState, item) {
  if (!item) return;
  if (item.category === 'cars') {
    gameState.ownedCars.push(item);
    return;
  }
  if (item.category === 'property') {
    gameState.ownedProperty.push(item);
    return;
  }
  gameState.inventory.push(item);
}

function resetTradeConfirmations(trade) {
  trade.confirmed = {
    [trade.fromUserId]: false,
    [trade.toUserId]: false
  };
}

function executeTrade(trade) {
  const fromUser = db.users.find((user) => user.id === trade.fromUserId);
  const toUser = db.users.find((user) => user.id === trade.toUserId);
  if (!fromUser || !toUser) throw new Error('Участники обмена не найдены.');

  const fromGame = ensureUserGameState(fromUser);
  const toGame = ensureUserGameState(toUser);
  const fromSelections = (trade.slots?.[trade.fromUserId] || []).filter(Boolean);
  const toSelections = (trade.slots?.[trade.toUserId] || []).filter(Boolean);

  const fromIds = new Set(fromSelections.map((item) => item.instanceId));
  const toIds = new Set(toSelections.map((item) => item.instanceId));
  if (fromIds.size !== fromSelections.length || toIds.size !== toSelections.length) {
    throw new Error('В трейде обнаружены повторяющиеся предметы.');
  }

  const fromItems = fromSelections.map((item) => findTradeableItem(fromGame, item.instanceId));
  const toItems = toSelections.map((item) => findTradeableItem(toGame, item.instanceId));
  if (fromItems.some((entry) => !entry) || toItems.some((entry) => !entry)) {
    throw new Error('Один из предметов для обмена больше недоступен.');
  }

  const transferredFrom = fromSelections.map((item) => takeTradeableItem(fromGame, item.instanceId));
  const transferredTo = toSelections.map((item) => takeTradeableItem(toGame, item.instanceId));
  transferredFrom.forEach((item) => addTradeableItem(toGame, item));
  transferredTo.forEach((item) => addTradeableItem(fromGame, item));

  trade.status = 'completed';
  trade.updatedAt = new Date().toISOString();
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/auth/session') {
    const token = parseToken(req.url);
    const user = getUserByToken(token);
    if (!user) return sendJson(res, 401, { error: 'Session not found' });
    return sendJson(res, 200, { token, user: getUserPublic(user), ...buildClientPayload(user) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    const payload = JSON.parse(await readBody(req) || '{}');
    const username = String(payload.username || '').trim().slice(0, 24);
    const password = String(payload.password || '').trim();

    if (username.length < 3 || password.length < 4) {
      return sendJson(res, 400, { error: 'Логин от 3 символов, пароль от 4.' });
    }

    if (db.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
      return sendJson(res, 409, { error: 'Такой логин уже занят.' });
    }

    const { salt, hash } = hashPassword(password);
    const user = {
      id: crypto.randomUUID(),
      username,
      salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      gameState: createDefaultGameState()
    };

    db.users.push(user);
    const token = createSession(user.id);
    saveDb();
    return sendJson(res, 200, { token, user: getUserPublic(user), ...buildClientPayload(user) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const payload = JSON.parse(await readBody(req) || '{}');
    const username = String(payload.username || '').trim();
    const password = String(payload.password || '').trim();
    const user = db.users.find((entry) => entry.username.toLowerCase() === username.toLowerCase());

    if (!user || !verifyPassword(password, user)) {
      return sendJson(res, 401, { error: 'Неверный логин или пароль.' });
    }

    ensureUserGameState(user);
    const token = createSession(user.id);
    return sendJson(res, 200, { token, user: getUserPublic(user), ...buildClientPayload(user) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const payload = JSON.parse(await readBody(req) || '{}');
    const token = parseToken(req.url, payload);
    db.sessions = db.sessions.filter((session) => session.token !== token);
    saveDb();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname.startsWith('/api/game')) {
    const payload = req.method === 'GET' ? {} : JSON.parse(await readBody(req) || '{}');
    const token = parseToken(req.url, payload);
    const user = getUserByToken(token);

    if (!user) return sendJson(res, 401, { error: 'Нужен вход в аккаунт.' });

    if (req.method === 'POST' && pathname === '/api/game/sync') {
      user.gameState = sanitizeGameState(payload.gameState);
      saveDb();
      pushSocialUpdate();
      return sendJson(res, 200, buildClientPayload(user));
    }
  }

  if (pathname.startsWith('/api/social') || pathname === '/api/chat') {
    const payload = req.method === 'GET' ? {} : JSON.parse(await readBody(req) || '{}');
    const token = parseToken(req.url, payload);
    const user = getUserByToken(token);

    if (!user) return sendJson(res, 401, { error: 'Нужен вход в аккаунт.' });

    if (req.method === 'GET' && pathname === '/api/social/data') {
      return sendJson(res, 200, buildClientPayload(user));
    }

    if (req.method === 'POST' && pathname === '/api/social/friends/request') {
      const username = String(payload.username || '').trim();
      const target = db.users.find((entry) => entry.username.toLowerCase() === username.toLowerCase());
      if (!target || target.id === user.id) return sendJson(res, 400, { error: 'Игрок не найден.' });

      const openRequest = db.friendRequests.find((request) => (
        (request.fromUserId === user.id && request.toUserId === target.id)
        || (request.fromUserId === target.id && request.toUserId === user.id)
      ) && ['pending', 'accepted'].includes(request.status));

      if (openRequest) {
        return sendJson(res, 409, { error: openRequest.status === 'accepted' ? 'Этот игрок уже у тебя в друзьях.' : 'Заявка уже существует.' });
      }

      const reusableRequest = db.friendRequests.find((request) => (
        (request.fromUserId === user.id && request.toUserId === target.id)
        || (request.fromUserId === target.id && request.toUserId === user.id)
      ) && ['declined', 'removed'].includes(request.status));

      if (reusableRequest) {
        reusableRequest.fromUserId = user.id;
        reusableRequest.toUserId = target.id;
        reusableRequest.status = 'pending';
        reusableRequest.createdAt = new Date().toISOString();
      } else {
        db.friendRequests.push({
          id: crypto.randomUUID(),
          fromUserId: user.id,
          toUserId: target.id,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }

      saveDb();
      pushSocialUpdate();
      return sendJson(res, 200, buildClientPayload(user));
    }

    if (req.method === 'POST' && pathname === '/api/social/friends/respond') {
      const request = db.friendRequests.find((entry) => entry.id === payload.requestId && entry.toUserId === user.id && entry.status === 'pending');
      if (!request) return sendJson(res, 404, { error: 'Заявка не найдена.' });
      request.status = payload.accept ? 'accepted' : 'declined';
      saveDb();
      pushSocialUpdate();
      return sendJson(res, 200, buildClientPayload(user));
    }

    if (req.method === 'POST' && pathname === '/api/social/friends/remove') {
      const friendId = String(payload.friendId || '');
      if (!isFriends(user.id, friendId)) return sendJson(res, 404, { error: 'Друг не найден.' });

      db.friendRequests = db.friendRequests.map((request) => (
        request.status === 'accepted' && (
          (request.fromUserId === user.id && request.toUserId === friendId)
          || (request.fromUserId === friendId && request.toUserId === user.id)
        )
          ? { ...request, status: 'removed' }
          : request
      ));

      db.trades = db.trades.map((trade) => (
        ['pending', 'active'].includes(trade.status) && (
          (trade.fromUserId === user.id && trade.toUserId === friendId)
          || (trade.fromUserId === friendId && trade.toUserId === user.id)
        )
          ? { ...trade, status: 'cancelled', updatedAt: new Date().toISOString() }
          : trade
      ));

      saveDb();
      pushSocialUpdate();
      return sendJson(res, 200, buildClientPayload(user));
    }

    if (req.method === 'POST' && pathname === '/api/social/friends/profile') {
      const friendId = String(payload.friendId || '');
      const friend = db.users.find((entry) => entry.id === friendId);
      if (!friend || !isFriends(user.id, friendId)) return sendJson(res, 404, { error: 'Друг не найден.' });
      return sendJson(res, 200, buildFriendProfilePayload(friend));
    }

    if (req.method === 'POST' && pathname === '/api/social/messages/thread') {
      const friendId = String(payload.friendId || '');
      const friend = db.users.find((entry) => entry.id === friendId);
      if (!friend || !isFriends(user.id, friendId)) return sendJson(res, 404, { error: 'Друг не найден.' });
      return sendJson(res, 200, {
        friend: getUserPublic(friend),
        messages: getDirectThread(user.id, friendId).map((message) => mapDirectMessage(message, user))
      });
    }

    if (req.method === 'POST' && pathname === '/api/social/messages/send') {
      const friendId = String(payload.friendId || '');
      const friend = db.users.find((entry) => entry.id === friendId);
      const text = String(payload.text || '').trim().slice(0, 240);
      if (!friend || !isFriends(user.id, friendId)) return sendJson(res, 404, { error: 'Друг не найден.' });
      if (!text) return sendJson(res, 400, { error: 'Сообщение пустое.' });

      const message = {
        id: crypto.randomUUID(),
        fromUserId: user.id,
        toUserId: friendId,
        text,
        createdAt: new Date().toISOString()
      };

      db.directMessages = [...db.directMessages.slice(-499), message];
      saveDb();
      const mappedForSender = mapDirectMessage(message, user);
      const mappedForFriend = mapDirectMessage(message, friend);
      broadcastToUsers([user.id], 'direct_message', { friendId, message: mappedForSender });
      broadcastToUsers([friendId], 'direct_message', { friendId: user.id, message: mappedForFriend });
      pushSocialUpdate();
      return sendJson(res, 200, {
        friend: getUserPublic(friend),
        messages: getDirectThread(user.id, friendId).map((entry) => mapDirectMessage(entry, user))
      });
    }

    if (req.method === 'POST' && pathname === '/api/social/trades/create') {
      const target = db.users.find((entry) => entry.id === String(payload.toUserId || ''));
      if (!target || target.id === user.id) return sendJson(res, 400, { error: 'Игрок для обмена не найден.' });
      if (!isFriends(user.id, target.id)) return sendJson(res, 400, { error: 'Обмен можно начать только с другом.' });
      if (hasOpenTrade(user.id) || hasOpenTrade(target.id)) return sendJson(res, 409, { error: 'У одного из игроков уже есть активный или ожидающий трейд.' });

      db.trades.push({
        id: crypto.randomUUID(),
        fromUserId: user.id,
        toUserId: target.id,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        slots: {
          [user.id]: Array.from({ length: TRADE_SLOT_COUNT }, () => null),
          [target.id]: Array.from({ length: TRADE_SLOT_COUNT }, () => null)
        },
        confirmed: {
          [user.id]: false,
          [target.id]: false
        }
      });
      saveDb();
      pushSocialUpdate();
      return sendJson(res, 200, buildClientPayload(user));
    }

    if (req.method === 'POST' && pathname === '/api/social/trades/respond') {
      const trade = db.trades.find((entry) => entry.id === payload.tradeId && entry.toUserId === user.id && entry.status === 'pending');
      if (!trade) return sendJson(res, 404, { error: 'Запрос на обмен не найден.' });
      trade.status = payload.accept ? 'active' : 'declined';
      trade.updatedAt = new Date().toISOString();
      resetTradeConfirmations(trade);
      saveDb();
      pushSocialUpdate();
      return sendJson(res, 200, buildClientPayload(user));
    }

    if (req.method === 'POST' && pathname === '/api/social/trades/select') {
      const trade = findTrade(String(payload.tradeId || ''), user.id, ['active']);
      if (!trade) return sendJson(res, 404, { error: 'Активный обмен не найден.' });

      const slotIndex = Number(payload.slotIndex);
      if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= TRADE_SLOT_COUNT) {
        return sendJson(res, 400, { error: 'Некорректный слот обмена.' });
      }

      const gameState = ensureUserGameState(user);
      const ownSlots = trade.slots[user.id] || Array.from({ length: TRADE_SLOT_COUNT }, () => null);
      const itemInstanceId = String(payload.itemInstanceId || '').trim();

      if (!itemInstanceId) {
        ownSlots[slotIndex] = null;
      } else {
        const foundItem = findTradeableItem(gameState, itemInstanceId);
        if (!foundItem) return sendJson(res, 400, { error: 'Этот предмет нельзя добавить в трейд.' });
        for (let index = 0; index < ownSlots.length; index += 1) {
          if (index !== slotIndex && ownSlots[index]?.instanceId === itemInstanceId) ownSlots[index] = null;
        }
        ownSlots[slotIndex] = sanitizeItem(foundItem.item);
      }

      trade.slots[user.id] = ownSlots;
      trade.updatedAt = new Date().toISOString();
      resetTradeConfirmations(trade);
      saveDb();
      pushSocialUpdate();
      return sendJson(res, 200, buildClientPayload(user));
    }

    if (req.method === 'POST' && pathname === '/api/social/trades/confirm') {
      const trade = findTrade(String(payload.tradeId || ''), user.id, ['active']);
      if (!trade) return sendJson(res, 404, { error: 'Активный обмен не найден.' });
      if ((trade.slots?.[user.id] || []).every((entry) => !entry)) {
        return sendJson(res, 400, { error: 'Сначала положи хотя бы один предмет в трейд.' });
      }

      trade.confirmed[user.id] = true;
      trade.updatedAt = new Date().toISOString();

      if (trade.confirmed[trade.fromUserId] && trade.confirmed[trade.toUserId]) {
        try {
          executeTrade(trade);
        } catch (error) {
          resetTradeConfirmations(trade);
          saveDb();
          pushSocialUpdate();
          return sendJson(res, 409, { error: error.message || 'Не удалось завершить обмен.' });
        }
      }

      saveDb();
      pushSocialUpdate();
      return sendJson(res, 200, buildClientPayload(user));
    }

    if (req.method === 'POST' && pathname === '/api/social/trades/cancel') {
      const trade = findTrade(String(payload.tradeId || ''), user.id, ['active']);
      if (!trade) return sendJson(res, 404, { error: 'Активный обмен не найден.' });
      trade.status = 'cancelled';
      trade.updatedAt = new Date().toISOString();
      resetTradeConfirmations(trade);
      saveDb();
      pushSocialUpdate();
      return sendJson(res, 200, buildClientPayload(user));
    }

    if (req.method === 'POST' && pathname === '/api/chat') {
      const text = String(payload.text || '').trim().slice(0, 180);
      if (!text) return sendJson(res, 400, { error: 'Сообщение пустое.' });

      const message = {
        id: crypto.randomUUID(),
        author: user.username,
        text,
        createdAt: new Date().toISOString()
      };

      db.chatMessages = [...db.chatMessages.slice(-29), message];
      saveDb();
      broadcast('chat_message', { message });
      pushSocialUpdate();
      return sendJson(res, 200, { ok: true });
    }
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = req.url?.split('?')[0] || '/';

    if (req.method === 'GET' && pathname === '/events') {
      const token = parseToken(req.url);
      const user = getUserByToken(token);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      });

      const client = { res, userId: user?.id || null };
      sseClients.add(client);

      res.write(`event: snapshot\ndata: ${JSON.stringify({
        onlineCount: getOnlineUserIds().length,
        chatMessages: db.chatMessages.slice(-30),
        user: getUserPublic(user)
      })}\n\n`);

      if (user) {
        res.write(`event: social_data\ndata: ${JSON.stringify(buildClientPayload(user))}\n\n`);
      }
      pushSocialUpdate();

      req.on('close', () => {
        sseClients.delete(client);
        pushSocialUpdate();
      });
      return;
    }

    const apiResult = await handleApi(req, res, pathname);
    if (apiResult !== false) return;

    const urlPath = pathname === '/' ? '/index.html' : pathname;
    const safePath = path.normalize(urlPath).replace(/^\/+/, '');
    const filePath = path.join(root, safePath);

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Server error', details: String(error.message || error) }));
  }
});

server.listen(port, () => {
  console.log(`Life Sim listening on http://localhost:${port}`);
});
