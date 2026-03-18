import { renderApp } from './ui.js';
import {
  loadState,
  saveState,
  restoreEnergy,
  refreshShop,
  ensureFreshShop,
  buyItem,
  openCase,
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
  openWorkSession,
  closeWorkSession,
  setWorkSessionPending,
  registerWorkDelivery,
  openTradePicker,
  closeTradePicker,
  openFriendModal,
  closeFriendModal,
  setFriendModalMode,
  setFriendMessages,
  appendFriendMessage,
  updateCaseOpening,
  closeCaseOpening,
  setInventorySection
} from './state.js';

const state = loadState();
const root = document.getElementById('app');

function renderFatalError(error) {
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#0b0e16;color:#f3f7ff;font-family:Inter,system-ui,sans-serif;">
      <div style="max-width:720px;padding:24px;border:1px solid rgba(255,255,255,0.12);border-radius:24px;background:#151926;">
        <p style="margin:0 0 8px;color:#9db0ff;text-transform:uppercase;letter-spacing:.14em;font-size:12px;">Life Sim</p>
        <h1 style="margin:0 0 12px;font-size:28px;">Ошибка запуска интерфейса</h1>
        <p style="margin:0 0 12px;color:#cfd8ec;line-height:1.6;">Приложение не смогло отрисоваться полностью. Попробуй обновить страницу. Если ошибка повторится — очисти локальное хранилище сайта.</p>
        <pre style="margin:0;white-space:pre-wrap;color:#ffb4c1;">${String(error?.message || error)}</pre>
      </div>
    </div>
  `;
}
let events;
let caseRevealTimer;
let caseSpinTimer;
let caseAnimationFrame;
let persistTimer;

const dragState = { active: false, pointerId: null, originX: 0, originY: 0, currentX: 0, currentY: 0, crate: null };
let lastShopSecondsLeft = Math.max(0, Math.ceil((state.shopRefreshAt - Date.now()) / 1000));

function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => saveState(state), 120);
}

function render() {
  if (!root) throw new Error('Root #app not found');
  try {
    renderApp(root, state);
    schedulePersist();
  } catch (error) {
    renderFatalError(error);
    throw error;
  }
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


function animateCaseOpening() {
  const rewardIndex = Number.isInteger(state.caseOpening.rewardIndex) ? state.caseOpening.rewardIndex : 22;
  const animationDuration = 4380;

  clearTimeout(caseSpinTimer);
  clearTimeout(caseRevealTimer);
  cancelAnimationFrame(caseAnimationFrame);
  updateCaseOpening(state, { offset: 0, reveal: false, spinning: true });
  render();

  const viewport = root.querySelector('.case-roulette__viewport');
  const firstCard = root.querySelector('.case-roulette__card');
  const track = root.querySelector('.case-roulette__track');
  const viewportWidth = viewport?.clientWidth || 640;
  const cardWidth = firstCard?.getBoundingClientRect().width || 160;
  const trackStyles = track ? getComputedStyle(track) : null;
  const gap = Number.parseFloat(trackStyles?.columnGap || trackStyles?.gap || '12') || 12;
  const paddingLeft = Number.parseFloat(trackStyles?.paddingLeft || '24') || 24;
  const targetOffset = Math.max(0, Math.round(
    paddingLeft + rewardIndex * (cardWidth + gap) + cardWidth / 2 - viewportWidth / 2
  ));
  const startTime = performance.now();

  const easeOutCubic = (progress) => 1 - ((1 - progress) ** 3);

  function step(timestamp) {
    const elapsed = timestamp - startTime;
    const progress = Math.min(1, elapsed / animationDuration);
    const offset = Math.round(targetOffset * easeOutCubic(progress));

    updateCaseOpening(state, { offset, spinning: progress < 1 });
    const currentTrack = root.querySelector('.case-roulette__track');
    if (currentTrack) currentTrack.style.transform = `translateX(-${offset}px)`;

    if (progress < 1) {
      caseAnimationFrame = requestAnimationFrame(step);
      return;
    }

    updateCaseOpening(state, { offset: targetOffset, reveal: true, spinning: false });
    render();
  }

  caseAnimationFrame = requestAnimationFrame(step);
}

async function handleWorkDelivery() {
  if (state.workSession.pendingDrop) return;

  setWorkSessionPending(state, true);
  const income = registerWorkDelivery(state);
  if (!income) {
    setWorkSessionPending(state, false);
    render();
    return;
  }

  render();
  try {
    await syncGameState();
  } catch (error) {
    setAuth(state, { error: error.message });
    addNotification(state, error.message);
  }
  render();
}

function resetDraggedCrate() {
  if (!dragState.crate) return;
  dragState.crate.classList.remove('dragging');
  dragState.crate.style.removeProperty('--drag-x');
  dragState.crate.style.removeProperty('--drag-y');
  dragState.crate = null;
  dragState.active = false;
  dragState.pointerId = null;
}

function releaseDraggedCrate(event) {
  if (!dragState.active || dragState.pointerId !== event.pointerId) return;

  const dropZone = root.querySelector('[data-work-dropzone="target"]');
  const releasedCrate = dragState.crate;
  const clientX = event.clientX;
  const clientY = event.clientY;
  const droppedInside = Boolean(dropZone) && (() => {
    const rect = dropZone.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  })();

  if (releasedCrate?.hasPointerCapture?.(event.pointerId)) {
    releasedCrate.releasePointerCapture(event.pointerId);
  }

  resetDraggedCrate();

  if (droppedInside) {
    handleWorkDelivery();
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

  if (!state.auth.token) {
    updateOnlineStatus(state, { status: 'offline', onlineCount: 0, chatMessages: [] });
    render();
    return;
  }

  if (typeof EventSource !== 'function') {
    updateOnlineStatus(state, { status: 'offline' });
    addNotification(state, 'Онлайн-функции недоступны: браузер не поддерживает EventSource.');
    render();
    return;
  }

  updateOnlineStatus(state, { status: 'connecting' });
  render();

  try {
    const url = new URL('/events', window.location.origin);
    if (state.auth.token) url.searchParams.set('token', state.auth.token);
    events = new EventSource(url);
  } catch (error) {
    updateOnlineStatus(state, { status: 'offline' });
    addNotification(state, `Не удалось подключить онлайн: ${error.message}`);
    render();
    return;
  }

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

  events.addEventListener('direct_message', (event) => {
    const payload = JSON.parse(event.data);
    if (state.friendModal.open && state.friendModal.friend?.id === payload.friendId) {
      appendFriendMessage(state, payload.message);
    }
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
    if (action === 'inventory-section') setInventorySection(state, button.dataset.section);
    if (action === 'close-shop') state.shopCategory = null;
    if (action === 'social-section') {
      state.socialSection = button.dataset.section;
      await refreshSocialData();
    }
    if (action === 'close-social') state.socialSection = null;
    if (action === 'friend-modal-close') closeFriendModal(state);
    if (action === 'friend-modal-mode') setFriendModalMode(state, button.dataset.mode);
    if (action === 'case-close-modal') {
      cancelAnimationFrame(caseAnimationFrame);
      closeCaseOpening(state);
    }
    if (action === 'work-open') openWorkSession(state);
    if (action === 'work-close') closeWorkSession(state);
    if (action === 'rest') {
      shouldSyncGame = restoreEnergy(state) || shouldSyncGame;
    }
    if (action === 'buy') {
      shouldSyncGame = buyItem(state, button.dataset.id, button.dataset.category) || shouldSyncGame;
    }
    if (action === 'open-case') {
      const reward = openCase(state, button.dataset.id);
      if (reward) {
        shouldSyncGame = true;
        render();
        animateCaseOpening();
      }
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
      disconnectEvents();
      updateOnlineStatus(state, { status: 'offline', onlineCount: 0, chatMessages: [] });
      addNotification(state, 'Ты вышел из аккаунта.');
    }
    if (action === 'friend-accept' || action === 'friend-decline') {
      const payload = await api('/api/social/friends/respond', {
        method: 'POST',
        body: { requestId: button.dataset.id, accept: action === 'friend-accept' }
      });
      applyServerPayload(payload);
    }
    if (action === 'friend-view-inventory') {
      const payload = await api('/api/social/friends/profile', {
        method: 'POST',
        body: { friendId: button.dataset.friendId }
      });
      openFriendModal(state, { mode: 'inventory', friend: payload.friend, gameState: payload.gameState, messages: state.friendModal.friend?.id === payload.friend.id ? state.friendModal.messages : [] });
    }
    if (action === 'friend-open-messages') {
      const payload = await api('/api/social/messages/thread', {
        method: 'POST',
        body: { friendId: button.dataset.friendId }
      });
      openFriendModal(state, { mode: 'messages', friend: payload.friend, gameState: state.friendModal.friend?.id === payload.friend.id ? state.friendModal.gameState : null, messages: payload.messages });
    }
    if (action === 'friend-remove') {
      const payload = await api('/api/social/friends/remove', {
        method: 'POST',
        body: { friendId: button.dataset.friendId }
      });
      applyServerPayload(payload);
      if (state.friendModal.friend?.id === button.dataset.friendId) closeFriendModal(state);
      addNotification(state, 'Друг удалён из списка.');
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
      render();
      await syncGameState();
    }
  } catch (error) {
    setAuth(state, { error: error.message });
    addNotification(state, error.message);
  }

  if (preserveAnimatedCaseFrame) {
    saveState(state);
    return;
  }

  render();
});

root.addEventListener('pointerdown', (event) => {
  const crate = event.target.closest('[data-work-crate]');
  if (!crate || !state.workSession.open || state.workSession.pendingDrop) return;

  dragState.active = true;
  dragState.pointerId = event.pointerId;
  dragState.originX = event.clientX;
  dragState.originY = event.clientY;
  dragState.currentX = 0;
  dragState.currentY = 0;
  dragState.crate = crate;
  crate.classList.add('dragging');
  crate.setPointerCapture(event.pointerId);
});

root.addEventListener('pointermove', (event) => {
  if (!dragState.active || dragState.pointerId !== event.pointerId || !dragState.crate) return;
  dragState.currentX = event.clientX - dragState.originX;
  dragState.currentY = event.clientY - dragState.originY;
  dragState.crate.style.setProperty('--drag-x', `${dragState.currentX}px`);
  dragState.crate.style.setProperty('--drag-y', `${dragState.currentY}px`);
});

root.addEventListener('pointerup', releaseDraggedCrate);
root.addEventListener('pointercancel', releaseDraggedCrate);

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

    if (form.dataset.role === 'dm-form') {
      const input = form.querySelector('input[name="dm_text"]');
      const payload = await api('/api/social/messages/send', {
        method: 'POST',
        body: { friendId: state.friendModal.friend?.id, text: input.value.trim() }
      });
      setFriendMessages(state, payload.messages);
      setFriendModalMode(state, 'messages');
      input.value = '';
    }
  } catch (error) {
    preserveAnimatedCaseFrame = false;
    setAuth(state, { error: error.message });
    addNotification(state, error.message);
  }

  if (preserveAnimatedCaseFrame) {
    saveState(state);
    return;
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

async function bootstrap() {
  refreshShop(state);
  state.shopCategory = null;
  state.socialSection = null;
  render();

  try {
    await restoreSession();
  } catch (error) {
    addNotification(state, `Не удалось восстановить сессию: ${error.message}`);
  }

  if (state.auth.token) connectSocialEvents();
  render();
}

bootstrap().catch((error) => {
  console.error(error);
  renderFatalError(error);
});
