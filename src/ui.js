import { rarityMap } from './data.js';
import { getCollectionStats } from './state.js';

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function rarityBadge(rarity) {
  const config = rarityMap[rarity];
  return `<span class="rarity-badge" style="--rarity:${config.color};--rarity-glow:${config.glow}">${config.label}</span>`;
}

function shopCard(item, category) {
  return `
    <article class="card rarity-${item.rarity}">
      <div class="card__top">
        <div>
          <p class="card__eyebrow">${category === 'clothing' ? 'Одежда' : category === 'cars' ? 'Машина' : 'Недвижимость'}</p>
          <h3>${item.name}</h3>
        </div>
        ${rarityBadge(item.rarity)}
      </div>
      <div class="card__stats">
        ${Object.entries(item.stats)
          .map(([key, value]) => `<span>${key}: <strong>${value}</strong></span>`)
          .join('')}
      </div>
      <div class="card__footer">
        <strong class="price">$${formatMoney(item.price)}</strong>
        <button data-action="buy" data-category="${category}" data-id="${item.id}">Купить</button>
      </div>
    </article>
  `;
}

function inventoryCard(item) {
  return `
    <button class="inventory-item rarity-${item.rarity}" data-action="equip" data-id="${item.id}">
      <span>${item.name}</span>
      ${rarityBadge(item.rarity)}
    </button>
  `;
}

export function renderApp(root, state) {
  const stats = getCollectionStats(state);
  const activeOffers = state.shopOffers[state.shopCategory];
  const secondsLeft = Math.max(0, Math.ceil((state.shopRefreshAt - Date.now()) / 1000));

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
              <h2>Курьер в мегаполисе</h2>
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
                <h2>Свежий завоз каждые 30 секунд</h2>
              </div>
              <div class="refresh-box">
                <span>Следующий завоз через</span>
                <strong>${secondsLeft} сек.</strong>
              </div>
            </div>
            <div class="subtabs">
              ${[
                ['clothing', 'Одежда'],
                ['cars', 'Машины'],
                ['property', 'Недвижка']
              ].map(([key, label]) => `
                <button class="subtab ${state.shopCategory === key ? 'active' : ''}" data-action="shop-category" data-category="${key}">${label}</button>
              `).join('')}
            </div>
            <div class="shop-grid">
              ${activeOffers.map((item) => shopCard(item, state.shopCategory)).join('')}
            </div>
          </section>
        ` : ''}

        ${state.activeTab === 'inventory' ? `
          <section class="panel inventory-panel">
            <div class="inventory-layout">
              <div class="equipment-zone">
                <p class="section-label">Экипировка</p>
                <div class="character-silhouette">
                  <div class="silhouette"></div>
                  <div class="equip-slot head">${state.equipped.head?.name || 'Голова'}</div>
                  <div class="equip-slot torso">${state.equipped.torso?.name || 'Тело'}</div>
                  <div class="equip-slot accessory">${state.equipped.accessory?.name || 'Аксессуар'}</div>
                  <div class="equip-slot legs">${state.equipped.legs?.name || 'Ноги'}</div>
                  <div class="equip-slot feet">${state.equipped.feet?.name || 'Обувь'}</div>
                </div>
              </div>
              <div class="inventory-zone">
                <div class="inventory-header">
                  <div>
                    <p class="section-label">Инвентарь</p>
                    <h2>Блоки с вещами и коллекцией</h2>
                  </div>
                  <button class="secondary-button" data-action="open-stats">Статистика</button>
                </div>
                <div class="inventory-grid">
                  ${state.inventory.length
                    ? state.inventory.map((item) => inventoryCard(item)).join('')
                    : '<div class="empty-state">Пока пусто. Купи одежду в магазине.</div>'}
                </div>
                <div class="collection-row">
                  <div class="mini-card"><span>Одежда</span><strong>${stats.wardrobe}/${stats.fullCatalog.clothing}</strong></div>
                  <div class="mini-card"><span>Машины</span><strong>${stats.cars}/${stats.fullCatalog.cars}</strong></div>
                  <div class="mini-card"><span>Недвижка</span><strong>${stats.property}/${stats.fullCatalog.property}</strong></div>
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
