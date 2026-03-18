import { rarityMap, categoryMeta } from './data.js';
import { getCollectionStats } from './state.js';

const slotLabels = {
  head: 'Голова',
  torso: 'Тело',
  legs: 'Ноги',
  feet: 'Обувь',
  accessory: 'Аксессуар'
};

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function rarityBadge(rarity) {
  const config = rarityMap[rarity];
  return `<span class="rarity-badge" style="--rarity:${config.color};--rarity-glow:${config.glow}">${config.label}</span>`;
}

function renderStats(stats) {
  return Object.entries(stats)
    .map(([key, value]) => `<span>${key}: <strong>${value}</strong></span>`)
    .join('');
}

function shopCard(item) {
  return `
    <article class="item-tile rarity-${item.rarity}">
      <div class="item-tile__glow"></div>
      <div class="item-tile__top">
        <span class="item-emoji">${item.icon}</span>
        ${rarityBadge(item.rarity)}
      </div>
      <div class="item-tile__body">
        <h3>${item.name}</h3>
        <div class="item-stats">${renderStats(item.stats)}</div>
      </div>
      <div class="item-tile__footer">
        <strong class="price">$${formatMoney(item.price)}</strong>
        <button data-action="buy" data-category="${item.category}" data-id="${item.id}">Купить</button>
      </div>
    </article>
  `;
}

function inventoryTile(item) {
  return `
    <button class="inventory-slot rarity-${item.rarity}" data-action="equip" data-id="${item.id}">
      <span class="inventory-slot__icon">${item.icon}</span>
      <span class="inventory-slot__name">${item.name}</span>
      ${rarityBadge(item.rarity)}
    </button>
  `;
}

function collectionTile(item) {
  return `
    <div class="collection-tile rarity-${item.rarity}">
      <span class="inventory-slot__icon">${item.icon}</span>
      <strong>${item.name}</strong>
      ${rarityBadge(item.rarity)}
    </div>
  `;
}

function equipTile(slotKey, item) {
  return `
    <div class="equip-rpg-slot ${item ? `rarity-${item.rarity}` : ''}">
      <span class="equip-rpg-slot__label">${slotLabels[slotKey]}</span>
      <span class="equip-rpg-slot__icon">${item?.icon || '✨'}</span>
      <strong>${item?.name || 'Пусто'}</strong>
    </div>
  `;
}

export function renderApp(root, state) {
  const stats = getCollectionStats(state);
  const activeOffers = state.shopOffers[state.shopCategory];
  const secondsLeft = Math.max(0, Math.ceil((state.shopRefreshAt - Date.now()) / 1000));
  const currentShop = categoryMeta[state.shopCategory];

  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="brand">🌆 Life Sim</p>
          <h1>Симулятор жизни</h1>
        </div>
        <nav class="tabs">
          ${['work', 'shop', 'inventory'].map((tab) => `
            <button class="tab ${state.activeTab === tab ? 'active' : ''}" data-action="tab" data-tab="${tab}">
              ${tab === 'work' ? 'Работа' : tab === 'shop' ? 'Магазин' : 'Инвентарь'}
            </button>
          `).join('')}
        </nav>
        <div class="money-panel">
          <span>$${formatMoney(state.money)}</span>
          <small>LVL ${state.level}</small>
        </div>
      </header>

      <main class="layout">
        <section class="panel hero-panel">
          <div class="hero-panel__content">
            <p class="section-label">Профиль</p>
            <h2>Строй карьеру, собирай стиль и имущество</h2>
            <div class="hero-stats">
              <div><span>Опыт</span><strong>${state.exp}</strong></div>
              <div><span>Энергия</span><strong>${state.energy}%</strong></div>
              <div><span>Клики работы</span><strong>${state.workClicks}</strong></div>
            </div>
          </div>
          <aside class="panel notifications">
            <p class="section-label">Лента</p>
            ${state.notifications.map((message) => `<div class="notification">${message}</div>`).join('')}
          </aside>
        </section>

        ${state.activeTab === 'work' ? `
          <section class="panel work-panel">
            <div class="work-card">
              <p class="section-label">Работа</p>
              <h2>Курьер в мегаполисе 📦</h2>
              <p>Нажимай на кнопку, выполняй доставку и получай деньги. Каждые 5 действий дают опыт.</p>
              <div class="work-actions">
                <button class="primary-button" data-action="work">Выйти на смену</button>
                <button class="secondary-button" data-action="rest">Отдохнуть</button>
              </div>
              <div class="work-summary">
                <div><span>Доход за действие</span><strong>$${formatMoney(Math.round((250 + state.level * 45) * (Object.values(state.equipped).filter(Boolean).reduce((sum, item) => sum + (item.stats.incomeBonus || 0), 1))))}</strong></div>
                <div><span>Следующий EXP</span><strong>${state.workClicks % 5 === 0 ? 5 : 5 - (state.workClicks % 5)} действий</strong></div>
              </div>
            </div>
          </section>
        ` : ''}

        ${state.activeTab === 'shop' ? `
          <section class="panel shop-panel">
            <div class="shop-header">
              <div>
                <p class="section-label">Магазин</p>
                <h2>Выбери, в какой магазин зайти</h2>
              </div>
              <div class="refresh-box">
                <span>Следующий завоз через</span>
                <strong>${secondsLeft} сек.</strong>
              </div>
            </div>

            <div class="shop-selector">
              ${Object.entries(categoryMeta).map(([key, meta]) => `
                <button class="store-card ${state.shopCategory === key ? 'active' : ''}" data-action="shop-category" data-category="${key}">
                  <span class="store-card__icon">${meta.icon}</span>
                  <strong>${meta.label}</strong>
                  <small>${meta.description}</small>
                </button>
              `).join('')}
            </div>

            <div class="shop-showcase panel-inner">
              <div class="shop-showcase__header">
                <div>
                  <p class="section-label">${currentShop.icon} ${currentShop.label}</p>
                  <h3>Текущие предметы в магазине</h3>
                </div>
                <span class="shop-note">5 квадратных слотов с завозом</span>
              </div>
              <div class="shop-grid square-grid">
                ${activeOffers.map((item) => shopCard(item)).join('')}
              </div>
            </div>
          </section>
        ` : ''}

        ${state.activeTab === 'inventory' ? `
          <section class="panel inventory-panel">
            <div class="inventory-rpg-layout">
              <div class="equipment-panel panel-inner">
                <div class="equipment-panel__header">
                  <div>
                    <p class="section-label">Экипировка</p>
                    <h2>RPG-снаряжение</h2>
                  </div>
                  <button class="secondary-button" data-action="open-stats">Статистика</button>
                </div>
                <div class="character-frame">
                  <div class="character-avatar">🧍</div>
                  <div class="equip-rpg-grid">
                    ${Object.entries(slotLabels).map(([slotKey]) => equipTile(slotKey, state.equipped[slotKey])).join('')}
                  </div>
                </div>
              </div>

              <div class="backpack-panel panel-inner">
                <div class="inventory-header">
                  <div>
                    <p class="section-label">Рюкзак</p>
                    <h2>Квадратные предметы</h2>
                  </div>
                </div>
                <div class="inventory-grid square-grid">
                  ${state.inventory.length
                    ? state.inventory.map((item) => inventoryTile(item)).join('')
                    : '<div class="empty-state">Пока пусто. Купи одежду в магазине.</div>'}
                </div>
                <div class="collection-row">
                  <div class="mini-card"><span>Одежда</span><strong>${stats.wardrobe}/${stats.fullCatalog.clothing}</strong></div>
                  <div class="mini-card"><span>Машины</span><strong>${stats.cars}/${stats.fullCatalog.cars}</strong></div>
                  <div class="mini-card"><span>Недвижка</span><strong>${stats.property}/${stats.fullCatalog.property}</strong></div>
                </div>
              </div>
            </div>

            <div class="owned-sections">
              <div class="panel-inner">
                <p class="section-label">🚗 Гараж</p>
                <div class="collection-grid">
                  ${state.ownedCars.length ? state.ownedCars.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Пока нет машин.</div>'}
                </div>
              </div>
              <div class="panel-inner">
                <p class="section-label">🏠 Недвижимость</p>
                <div class="collection-grid">
                  ${state.ownedProperty.length ? state.ownedProperty.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Пока нет недвижимости.</div>'}
                </div>
              </div>
            </div>
          </section>
        ` : ''}
      </main>

      <div class="modal ${state.showStats ? 'visible' : ''}">
        <div class="modal__content">
          <div class="modal__header">
            <div>
              <p class="section-label">Статистика</p>
              <h3>Полная статистика персонажа</h3>
            </div>
            <button class="icon-button" data-action="close-stats">✕</button>
          </div>
          <div class="modal-grid">
            <div class="mini-card"><span>Деньги</span><strong>$${formatMoney(state.money)}</strong></div>
            <div class="mini-card"><span>Уровень</span><strong>${state.level}</strong></div>
            <div class="mini-card"><span>Опыт</span><strong>${state.exp}</strong></div>
            <div class="mini-card"><span>Энергия</span><strong>${state.energy}%</strong></div>
            <div class="mini-card"><span>Рабочих действий</span><strong>${state.workClicks}</strong></div>
            <div class="mini-card"><span>Одежда</span><strong>${stats.wardrobe}</strong></div>
            <div class="mini-card"><span>Машины</span><strong>${stats.cars}</strong></div>
            <div class="mini-card"><span>Недвижка</span><strong>${stats.property}</strong></div>
          </div>
          <div class="rarity-list">
            ${Object.entries(stats.raritySummary).length
              ? Object.entries(stats.raritySummary).map(([rarity, total]) => `
                <div class="rarity-row">
                  ${rarityBadge(rarity)}
                  <strong>${total}</strong>
                </div>
              `).join('')
              : '<div class="empty-state">Коллекция ещё не собрана.</div>'}
          </div>
        </div>
      </div>
    </div>
  `;
}
