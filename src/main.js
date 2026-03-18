import { renderApp } from './ui.js';
import {
  loadState,
  saveState,
  performWork,
  restoreEnergy,
  refreshShop,
  ensureFreshShop,
  buyItem,
  equipItem,
  unequipItem,
  updateOnlineStatus,
  appendChatMessage,
  setAuth,
  setSocialData,
  resetSocialState,
  addNotification,
  applyGameState,
  extractGameState,
  openTradePicker,
  closeTradePicker
} from './state.js';

const state = loadState();
const root = document.getElementById('app');
let events;
let lastShopSecondsLeft = Math.max(0, Math.ceil((state.shopRefreshAt - Date.now()) / 1000));

function render() {
  renderApp(root, state);
  saveState(state);
}

async function api(path, { method = 'GET', body } = {}) {
  const url = new URL(path, window.location.origin);
  if (state.auth.token && method === 'GET') url.searchParams.set('token', state.auth.token);

  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify({ ...body, token: state.auth.token }) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload;
}

function applyServerPayload(payload) {
  const previousActiveTradeId = state.social.activeTrade?.id || '';

  if (payload.gameState) {
    applyGameState(state, payload.gameState);
  }

  if (payload.social) {
    setSocialData(state, payload.social);
    updateOnlineStatus(state, {
      onlineCount: payload.social.onlineCount,
      chatMessages: payload.social.chatMessages
    });

    const nextActiveTradeId = payload.social.activeTrade?.id || '';
    if (nextActiveTradeId && nextActiveTradeId !== previousActiveTradeId) {
      state.tradeModalOpen = true;
    }
    if (!nextActiveTradeId) {
      state.tradeModalOpen = false;
      closeTradePicker(state);
    }
  }
}

async function syncGameState() {
  if (!state.auth.token) return;
  const payload = await api('/api/game/sync', {
    method: 'POST',
    body: { gameState: extractGameState(state) }
  });
  applyServerPayload(payload);
}

function disconnectEvents() {
  if (events) events.close();
}

function connectSocialEvents() {
  disconnectEvents();
  updateOnlineStatus(state, { status: 'connecting' });
  render();

  const url = new URL('/events', window.location.origin);
  if (state.auth.token) url.searchParams.set('token', state.auth.token);
  events = new EventSource(url);

  events.addEventListener('open', () => {
    updateOnlineStatus(state, { status: 'online' });
    render();
  });

  events.addEventListener('error', () => {
    updateOnlineStatus(state, { status: 'offline' });
    render();
    disconnectEvents();
    setTimeout(connectSocialEvents, 2500);
  });

  events.addEventListener('snapshot', (event) => {
    const payload = JSON.parse(event.data);
    updateOnlineStatus(state, {
      status: 'online',
      onlineCount: payload.onlineCount,
      chatMessages: payload.chatMessages
    });
    render();
  });

  events.addEventListener('presence', (event) => {
    const payload = JSON.parse(event.data);
    updateOnlineStatus(state, { status: 'online', onlineCount: payload.onlineCount });
    render();
  });

  events.addEventListener('chat_message', (event) => {
    const payload = JSON.parse(event.data);
    appendChatMessage(state, payload.message);
    render();
  });

  events.addEventListener('social_data', (event) => {
    const payload = JSON.parse(event.data);
    applyServerPayload(payload);
    render();
  });
}

async function restoreSession() {
  if (!state.auth.token) return;
  try {
    const payload = await api('/api/auth/session');
    setAuth(state, { token: payload.token, user: payload.user, error: '' });
    applyServerPayload(payload);
  } catch {
    setAuth(state, { token: '', user: null, error: '' });
    resetSocialState(state);
  }
}

async function refreshSocialData() {
  if (!state.auth.token) return;
  try {
    const payload = await api('/api/social/data');
    applyServerPayload(payload);
  } catch (error) {
    addNotification(state, error.message);
  }
}

root.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const { action } = button.dataset;
  if (!action || action === 'noop') return;

  let shouldSyncGame = false;

  try {
    if (action === 'tab') {
      state.activeTab = button.dataset.tab;
      if (button.dataset.tab === 'shop') state.shopCategory = null;
      if (button.dataset.tab === 'social') {
        state.socialSection = null;
        await refreshSocialData();
      }
    }
    if (action === 'shop-category') state.shopCategory = button.dataset.category;
    if (action === 'close-shop') state.shopCategory = null;
    if (action === 'social-section') {
      state.socialSection = button.dataset.section;
      await refreshSocialData();
    }
    if (action === 'close-social') state.socialSection = null;
    if (action === 'work') {
      performWork(state);
      shouldSyncGame = true;
    }
    if (action === 'rest') {
      restoreEnergy(state);
      shouldSyncGame = true;
    }
    if (action === 'buy') {
      shouldSyncGame = buyItem(state, button.dataset.id, button.dataset.category) || shouldSyncGame;
    }
    if (action === 'equip') {
      shouldSyncGame = equipItem(state, button.dataset.id) || shouldSyncGame;
    }
    if (action === 'unequip') {
      shouldSyncGame = unequipItem(state, button.dataset.slot) || shouldSyncGame;
    }
    if (action === 'open-stats') state.showStats = true;
    if (action === 'close-stats') state.showStats = false;
    if (action === 'logout') {
      await api('/api/auth/logout', { method: 'POST', body: {} });
      setAuth(state, { token: '', user: null, error: '' });
      resetSocialState(state);
      connectSocialEvents();
      addNotification(state, 'Ты вышел из аккаунта.');
    }
    if (action === 'friend-accept' || action === 'friend-decline') {
      const payload = await api('/api/social/friends/respond', {
        method: 'POST',
        body: { requestId: button.dataset.id, accept: action === 'friend-accept' }
      });
      applyServerPayload(payload);
    }
    if (action === 'trade-request') {
      const payload = await api('/api/social/trades/create', {
        method: 'POST',
        body: { toUserId: button.dataset.userId }
      });
      applyServerPayload(payload);
      state.socialSection = 'trade';
      addNotification(state, 'Запрос на обмен отправлен.');
    }
    if (action === 'trade-accept' || action === 'trade-decline') {
      const payload = await api('/api/social/trades/respond', {
        method: 'POST',
        body: { tradeId: button.dataset.id, accept: action === 'trade-accept' }
      });
      applyServerPayload(payload);
      state.socialSection = 'trade';
    }
    if (action === 'trade-open-modal') {
      state.tradeModalOpen = true;
      state.socialSection = 'trade';
    }
    if (action === 'trade-close-modal') {
      state.tradeModalOpen = false;
      closeTradePicker(state);
    }
    if (action === 'trade-open-slot') {
      state.tradeModalOpen = true;
      openTradePicker(state, Number(button.dataset.slot));
    }
    if (action === 'trade-close-picker') {
      closeTradePicker(state);
    }
    if (action === 'trade-select-item' || action === 'trade-clear-slot') {
      const payload = await api('/api/social/trades/select', {
        method: 'POST',
        body: {
          tradeId: state.social.activeTrade?.id,
          slotIndex: state.tradePicker.slotIndex,
          itemInstanceId: action === 'trade-clear-slot' ? '' : button.dataset.instanceId
        }
      });
      applyServerPayload(payload);
      closeTradePicker(state);
      state.socialSection = 'trade';
    }
    if (action === 'trade-confirm') {
      const payload = await api('/api/social/trades/confirm', {
        method: 'POST',
        body: { tradeId: state.social.activeTrade?.id }
      });
      applyServerPayload(payload);
      state.socialSection = 'trade';
    }
    if (action === 'trade-cancel') {
      const payload = await api('/api/social/trades/cancel', {
        method: 'POST',
        body: { tradeId: state.social.activeTrade?.id }
      });
      applyServerPayload(payload);
      closeTradePicker(state);
      state.socialSection = 'trade';
    }

    if (shouldSyncGame) {
      await syncGameState();
    }
  } catch (error) {
    setAuth(state, { error: error.message });
    addNotification(state, error.message);
  }

  render();
});

root.addEventListener('submit', async (event) => {
  const form = event.target.closest('form');
  if (!form) return;
  event.preventDefault();

  try {
    if (form.dataset.role === 'register-form' || form.dataset.role === 'login-form') {
      const username = form.querySelector('[name="username"]').value.trim();
      const password = form.querySelector('[name="password"]').value.trim();
      const endpoint = form.dataset.role === 'register-form' ? '/api/auth/register' : '/api/auth/login';
      const payload = await api(endpoint, { method: 'POST', body: { username, password } });
      setAuth(state, { token: payload.token, user: payload.user, error: '' });
      applyServerPayload(payload);
      connectSocialEvents();
      addNotification(state, `${payload.user.username} вошёл в игру.`);
    }

    if (form.dataset.role === 'chat-form') {
      const input = form.querySelector('input[name="message"]');
      const text = input.value.trim();
      if (text) {
        await api('/api/chat', { method: 'POST', body: { text } });
        input.value = '';
      }
    }

    if (form.dataset.role === 'friend-form') {
      const input = form.querySelector('input[name="friend_username"]');
      const payload = await api('/api/social/friends/request', { method: 'POST', body: { username: input.value.trim() } });
      applyServerPayload(payload);
      input.value = '';
    }
  } catch (error) {
    setAuth(state, { error: error.message });
    addNotification(state, error.message);
  }

  render();
});

setInterval(() => {
  if (!state.auth.user) return;

  const changed = ensureFreshShop(state);
  const secondsLeft = Math.max(0, Math.ceil((state.shopRefreshAt - Date.now()) / 1000));
  const shouldRenderShopTimer = state.activeTab === 'shop' && secondsLeft !== lastShopSecondsLeft;

  lastShopSecondsLeft = secondsLeft;
  if (changed || shouldRenderShopTimer) render();
}, 1000);

window.addEventListener('beforeunload', () => {
  saveState(state);
  disconnectEvents();
});

refreshShop(state);
state.shopCategory = null;
state.socialSection = null;
await restoreSession();
connectSocialEvents();
render();
