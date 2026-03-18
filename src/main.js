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
  appendChatMessage
} from './state.js';

const state = loadState();
const root = document.getElementById('app');
let events;

function render() {
  renderApp(root, state);
  saveState(state);
}

function connectSocialEvents() {
  updateOnlineStatus(state, { status: 'connecting' });
  render();

  events = new EventSource('/events');

  events.addEventListener('open', () => {
    updateOnlineStatus(state, { status: 'online' });
    render();
  });

  events.addEventListener('error', () => {
    updateOnlineStatus(state, { status: 'offline' });
    render();
    events.close();
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
    updateOnlineStatus(state, {
      status: 'online',
      onlineCount: payload.onlineCount
    });
    render();
  });

  events.addEventListener('chat_message', (event) => {
    const payload = JSON.parse(event.data);
    appendChatMessage(state, payload.message);
    render();
  });
}

root.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const { action } = button.dataset;
  if (action === 'noop') return;

  if (action === 'tab') {
    state.activeTab = button.dataset.tab;
    if (button.dataset.tab === 'shop') state.shopCategory = null;
    if (button.dataset.tab === 'social') state.socialSection = null;
  }
  if (action === 'shop-category') state.shopCategory = button.dataset.category;
  if (action === 'close-shop') state.shopCategory = null;
  if (action === 'social-section') state.socialSection = button.dataset.section;
  if (action === 'close-social') state.socialSection = null;
  if (action === 'work') performWork(state);
  if (action === 'rest') restoreEnergy(state);
  if (action === 'buy') buyItem(state, button.dataset.id, button.dataset.category);
  if (action === 'equip') equipItem(state, button.dataset.id);
  if (action === 'unequip') unequipItem(state, button.dataset.slot);
  if (action === 'open-stats') state.showStats = true;
  if (action === 'close-stats') state.showStats = false;

  render();
});

root.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-role="chat-form"]');
  if (!form) return;

  event.preventDefault();
  const input = form.querySelector('input[name="message"]');
  const text = input.value.trim();
  if (!text) return;

  await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author: 'Игрок', text })
  });

  input.value = '';
});

setInterval(() => {
  const changed = ensureFreshShop(state);
  if (state.activeTab === 'shop' || changed) render();
}, 1000);

window.addEventListener('beforeunload', () => saveState(state));

refreshShop(state);
state.shopCategory = null;
state.socialSection = null;
connectSocialEvents();
render();
