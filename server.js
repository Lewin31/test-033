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
  chatMessages: []
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

  const trades = db.trades
    .filter((trade) => trade.fromUserId === user.id || trade.toUserId === user.id)
    .map((trade) => ({
      id: trade.id,
      status: trade.status,
      createdAt: trade.createdAt,
      offeredItem: trade.offeredItem,
      requestedItem: trade.requestedItem,
      from: getUserPublic(db.users.find((entry) => entry.id === trade.fromUserId)),
      to: getUserPublic(db.users.find((entry) => entry.id === trade.toUserId))
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    trades,
    chatMessages: db.chatMessages.slice(-30),
    onlineCount: onlineUserIds.length
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
    client.res.write(`event: social_data\ndata: ${JSON.stringify(buildSocialPayload(user))}\n\n`);
  }
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/auth/session') {
    const token = parseToken(req.url);
    const user = getUserByToken(token);
    if (!user) return sendJson(res, 401, { error: 'Session not found' });
    return sendJson(res, 200, { token, user: getUserPublic(user), social: buildSocialPayload(user) });
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
      createdAt: new Date().toISOString()
    };

    db.users.push(user);
    const token = createSession(user.id);
    saveDb();
    return sendJson(res, 200, { token, user: getUserPublic(user), social: buildSocialPayload(user) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const payload = JSON.parse(await readBody(req) || '{}');
    const username = String(payload.username || '').trim();
    const password = String(payload.password || '').trim();
    const user = db.users.find((entry) => entry.username.toLowerCase() === username.toLowerCase());

    if (!user || !verifyPassword(password, user)) {
      return sendJson(res, 401, { error: 'Неверный логин или пароль.' });
    }

    const token = createSession(user.id);
    return sendJson(res, 200, { token, user: getUserPublic(user), social: buildSocialPayload(user) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const payload = JSON.parse(await readBody(req) || '{}');
    const token = parseToken(req.url, payload);
    db.sessions = db.sessions.filter((session) => session.token !== token);
    saveDb();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname.startsWith('/api/social') || pathname === '/api/chat') {
    const payload = req.method === 'GET' ? {} : JSON.parse(await readBody(req) || '{}');
    const token = parseToken(req.url, payload);
    const user = getUserByToken(token);

    if (!user) return sendJson(res, 401, { error: 'Нужен вход в аккаунт.' });

    if (req.method === 'GET' && pathname === '/api/social/data') {
      return sendJson(res, 200, buildSocialPayload(user));
    }

    if (req.method === 'POST' && pathname === '/api/social/friends/request') {
      const username = String(payload.username || '').trim();
      const target = db.users.find((entry) => entry.username.toLowerCase() === username.toLowerCase());
      if (!target || target.id === user.id) return sendJson(res, 400, { error: 'Игрок не найден.' });

      const exists = db.friendRequests.find((request) => (
        (request.fromUserId === user.id && request.toUserId === target.id) ||
        (request.fromUserId === target.id && request.toUserId === user.id)
      ) && request.status !== 'declined');

      if (exists) return sendJson(res, 409, { error: 'Заявка уже существует.' });

      db.friendRequests.push({
        id: crypto.randomUUID(),
        fromUserId: user.id,
        toUserId: target.id,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      saveDb();
      pushSocialUpdate();
      return sendJson(res, 200, buildSocialPayload(user));
    }

    if (req.method === 'POST' && pathname === '/api/social/friends/respond') {
      const request = db.friendRequests.find((entry) => entry.id === payload.requestId && entry.toUserId === user.id && entry.status === 'pending');
      if (!request) return sendJson(res, 404, { error: 'Заявка не найдена.' });
      request.status = payload.accept ? 'accepted' : 'declined';
      saveDb();
      pushSocialUpdate();
      return sendJson(res, 200, buildSocialPayload(user));
    }

    if (req.method === 'POST' && pathname === '/api/social/trades/create') {
      const toUsername = String(payload.toUsername || '').trim();
      const offeredItem = String(payload.offeredItem || '').trim().slice(0, 60);
      const requestedItem = String(payload.requestedItem || '').trim().slice(0, 60);
      const target = db.users.find((entry) => entry.username.toLowerCase() === toUsername.toLowerCase());

      if (!target || target.id === user.id) return sendJson(res, 400, { error: 'Игрок для обмена не найден.' });
      if (!offeredItem || !requestedItem) return sendJson(res, 400, { error: 'Заполни оба поля обмена.' });

      db.trades.push({
        id: crypto.randomUUID(),
        fromUserId: user.id,
        toUserId: target.id,
        offeredItem,
        requestedItem,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      saveDb();
      pushSocialUpdate();
      return sendJson(res, 200, buildSocialPayload(user));
    }

    if (req.method === 'POST' && pathname === '/api/social/trades/respond') {
      const trade = db.trades.find((entry) => entry.id === payload.tradeId && entry.toUserId === user.id && entry.status === 'pending');
      if (!trade) return sendJson(res, 404, { error: 'Обмен не найден.' });
      trade.status = payload.accept ? 'accepted' : 'declined';
      saveDb();
      pushSocialUpdate();
      return sendJson(res, 200, buildSocialPayload(user));
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
        res.write(`event: social_data\ndata: ${JSON.stringify(buildSocialPayload(user))}\n\n`);
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
