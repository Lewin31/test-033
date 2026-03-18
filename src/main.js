import { renderApp } from './ui.js';
import {
  loadState,
  saveState,
  performWork,
  restoreEnergy,
  refreshShop,
  ensureFreshShop,
  buyItem,
  equipItem
} from './state.js';

const state = loadState();
const root = document.getElementById('app');

function render() {
  renderApp(root, state);
  saveState(state);
}

root.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const { action } = button.dataset;

  if (action === 'tab') {
    state.activeTab = button.dataset.tab;
    if (button.dataset.tab === 'shop') state.shopCategory = null;
  }
  if (action === 'shop-category') state.shopCategory = button.dataset.category;
  if (action === 'close-shop') state.shopCategory = null;
  if (action === 'work') performWork(state);
  if (action === 'rest') restoreEnergy(state);
  if (action === 'buy') buyItem(state, button.dataset.id, button.dataset.category);
  if (action === 'equip') equipItem(state, button.dataset.id);
  if (action === 'open-stats') state.showStats = true;
  if (action === 'close-stats') state.showStats = false;

  render();
});

setInterval(() => {
  const changed = ensureFreshShop(state);
  if (state.activeTab === 'shop' || changed) render();
}, 1000);

window.addEventListener('beforeunload', () => saveState(state));

refreshShop(state);
state.shopCategory = null;
render();
