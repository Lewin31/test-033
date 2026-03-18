import { rarityMap, categoryMeta } from './data.js';
import { getCollectionStats, getTradeableItems } from './state.js';

const slotLabels = {
  head: 'Голова',
  torso: 'Тело',
  legs: 'Ноги',
  feet: 'Обувь',
  accessory: 'Аксессуар'
};

const slotIcons = {
  head: '🧢',
  torso: '👕',
  legs: '👖',
  feet: '👟',
  accessory: '⌚'
};

const socialMeta = {
  friends: { label: 'Друзья', icon: '🫂' },
  trade: { label: 'Обмен', icon: '🤝' },
  chat: { label: 'Чат', icon: '💬' }
};

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function rarityBadge(rarity) {
  const config = rarityMap[rarity] || rarityMap.common;
  return `<span class="rarity-badge" style="--rarity:${config.color};--rarity-glow:${config.glow}">${config.label}</span>`;
}

function renderStats(stats) {
  return Object.entries(stats)
    .map(([key, value]) => `<span>${key}: <strong>${value}</strong></span>`)
    .join('');
}

function itemIcon(item, slotKey = null) {
  return item?.icon || (slotKey ? slotIcons[slotKey] : '📦');
}

function shopCard(item) {
  return `
    <article class="item-tile rarity-${item.rarity}">
      <div class="item-tile__top">
        <span class="gear-icon">${itemIcon(item)}</span>
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
    <button class="inventory-slot rarity-${item.rarity}" data-action="equip" data-id="${item.instanceId}">
      <span class="gear-icon">${itemIcon(item, item.slot)}</span>
      <span class="inventory-slot__name">${item.name}</span>
      ${rarityBadge(item.rarity)}
    </button>
  `;
}

function collectionTile(item) {
  return `
    <div class="collection-tile rarity-${item.rarity}">
      <span class="gear-icon">${itemIcon(item)}</span>
      <strong>${item.name}</strong>
      ${rarityBadge(item.rarity)}
    </div>
  `;
}

function equipTile(slotKey, item) {
  return `
    <button class="equip-slot-card ${item ? `rarity-${item.rarity}` : ''}" data-action="${item ? 'unequip' : 'noop'}" data-slot="${slotKey}">
      <span class="equip-slot-card__label">${slotLabels[slotKey]}</span>
      <span class="gear-icon">${itemIcon(item, slotKey)}</span>
      <strong>${item?.name || 'Пусто'}</strong>
    </button>
  `;
}

function authPanel(state) {
  if (state.auth.user) {
    return `
      <div class="auth-box auth-box--logged">
        <div>
          <p class="section-label">Аккаунт</p>
          <h3>${state.auth.user.username}</h3>
        </div>
        <button class="secondary-button" data-action="logout">Выйти</button>
      </div>
    `;
  }

  return `
    <div class="auth-grid">
      <form class="auth-box" data-role="register-form">
        <p class="section-label">Регистрация</p>
        <input name="username" placeholder="Логин" minlength="3" maxlength="24" required />
        <input name="password" type="password" placeholder="Пароль" minlength="4" required />
        <button type="submit">Создать аккаунт</button>
      </form>
      <form class="auth-box" data-role="login-form">
        <p class="section-label">Вход</p>
        <input name="username" placeholder="Логин" minlength="3" maxlength="24" required />
        <input name="password" type="password" placeholder="Пароль" minlength="4" required />
        <button type="submit">Войти</button>
      </form>
    </div>
  `;
}

function friendsWindow(state) {
  const activeTrade = state.social.activeTrade;

  return `
    <div class="social-window panel-inner">
      <div class="social-window__header">
        <div>
          <p class="section-label">🫂 Друзья</p>
          <h3>Список друзей и заявки</h3>
        </div>
        <button class="secondary-button" data-action="close-social">Закрыть</button>
      </div>
      <form class="inline-form" data-role="friend-form">
        <input type="text" name="friend_username" placeholder="Логин игрока" required />
        <button type="submit">Добавить</button>
      </form>
      <div class="social-columns">
        <div class="social-list">
          <p class="section-label">Друзья</p>
          ${(state.social.friends.length ? state.social.friends : []).map((friend) => `
            <div class="social-card action-card">
              <div class="social-card__title-row">
                <strong>${friend.username}</strong>
                <span>${friend.online ? 'онлайн' : 'оффлайн'}</span>
              </div>
              <button ${activeTrade ? 'disabled' : ''} data-action="trade-request" data-user-id="${friend.id}">Запросить трейд</button>
            </div>
          `).join('') || '<div class="empty-state">Друзей пока нет.</div>'}
        </div>
        <div class="social-list">
          <p class="section-label">Входящие</p>
          ${(state.social.incomingRequests.length ? state.social.incomingRequests : []).map((request) => `
            <div class="social-card action-card">
              <strong>${request.from.username}</strong>
              <div class="action-row">
                <button data-action="friend-accept" data-id="${request.id}">Принять</button>
                <button data-action="friend-decline" data-id="${request.id}">Отклонить</button>
              </div>
            </div>
          `).join('') || '<div class="empty-state">Нет входящих заявок.</div>'}
        </div>
        <div class="social-list">
          <p class="section-label">Исходящие</p>
          ${(state.social.outgoingRequests.length ? state.social.outgoingRequests : []).map((request) => `
            <div class="social-card"><strong>${request.to.username}</strong><span>ожидает</span></div>
          `).join('') || '<div class="empty-state">Нет исходящих заявок.</div>'}
        </div>
      </div>
    </div>
  `;
}

function tradeRequestCard(request, incoming) {
  return `
    <div class="social-card action-card">
      <strong>${incoming ? request.from.username : request.to.username}</strong>
      <span>${incoming ? 'хочет начать обмен' : 'ждёт подтверждения обмена'}</span>
      ${incoming ? `
        <div class="action-row">
          <button data-action="trade-accept" data-id="${request.id}">Принять</button>
          <button data-action="trade-decline" data-id="${request.id}">Отклонить</button>
        </div>
      ` : ''}
    </div>
  `;
}

function tradeSlot(item, { slotIndex, editable }) {
  return `
    <button class="trade-slot ${item ? `rarity-${item.rarity}` : ''}" ${editable ? `data-action="trade-open-slot" data-slot="${slotIndex}"` : 'disabled'}>
      <span class="gear-icon">${itemIcon(item)}</span>
      <strong>${item?.name || 'Пустой слот'}</strong>
      <span class="trade-slot__hint">${item ? 'Нажми, чтобы заменить' : 'Выбрать предмет'}</span>
    </button>
  `;
}

function tradeBoard(state) {
  const trade = state.social.activeTrade;
  if (!trade) return '';

  return `
    <div class="trade-board trade-modal-board">
      <div class="social-window__header">
        <div>
          <p class="section-label">🤝 Активный трейд</p>
          <h3>${trade.partner.username}</h3>
          <p class="trade-board__status">Твои слоты слева, слоты друга справа. После выбора оба подтверждают сделку.</p>
        </div>
        <div class="action-row">
          <button class="secondary-button" data-action="trade-close-modal">Свернуть</button>
          <button class="secondary-button" data-action="trade-cancel">Отменить обмен</button>
        </div>
      </div>
      <div class="trade-status-row">
        <div class="trade-status-chip ${trade.ownConfirmed ? 'ready' : ''}">Ты: ${trade.ownConfirmed ? 'подтвердил' : 'ожидает подтверждения'}</div>
        <div class="trade-status-chip ${trade.partnerConfirmed ? 'ready' : ''}">${trade.partner.username}: ${trade.partnerConfirmed ? 'подтвердил' : 'ожидает подтверждения'}</div>
      </div>
      <div class="trade-board__shell">
        <div class="trade-board__half">
          <div class="trade-board__title">Твои предметы</div>
          <div class="trade-grid">
            ${trade.ownSlots.map((item, slotIndex) => tradeSlot(item, { slotIndex, editable: true })).join('')}
          </div>
        </div>
        <div class="trade-board__divider"></div>
        <div class="trade-board__half">
          <div class="trade-board__title">Предметы друга</div>
          <div class="trade-grid trade-grid--readonly">
            ${trade.partnerSlots.map((item, slotIndex) => tradeSlot(item, { slotIndex, editable: false })).join('')}
          </div>
        </div>
      </div>
      <div class="trade-board__actions">
        <button class="primary-button" data-action="trade-confirm" ${trade.ownSlots.every((item) => !item) ? 'disabled' : ''}>Подтвердить сделку</button>
        <span class="trade-board__note">Если кто-то меняет слот, подтверждения сбрасываются автоматически.</span>
      </div>
    </div>
  `;
}

function activeTradeSummary(state) {
  const trade = state.social.activeTrade;
  if (!trade) return '';

  return `
    <div class="social-card trade-active-card">
      <div>
        <p class="section-label">Активный трейд</p>
        <strong>${trade.partner.username}</strong>
        <span>Обмен открыт в отдельном окне поверх интерфейса.</span>
      </div>
      <button data-action="trade-open-modal">Открыть окно обмена</button>
    </div>
  `;
}

function tradePickerModal(state) {
  const trade = state.social.activeTrade;
  const slotIndex = state.tradePicker.slotIndex;
  if (!trade || !Number.isInteger(slotIndex)) return '';

  const currentItem = trade.ownSlots[slotIndex] || null;
  const selectedIds = new Set(trade.ownSlots.filter(Boolean).map((item) => item.instanceId));
  const items = getTradeableItems(state)
    .filter((item) => item.instanceId === currentItem?.instanceId || !selectedIds.has(item.instanceId));

  return `
    <div class="modal visible trade-picker-modal">
      <div class="modal__content trade-picker-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Выбор предмета</p>
            <h3>Слот ${slotIndex + 1}</h3>
          </div>
          <button class="icon-button" data-action="trade-close-picker">✕</button>
        </div>
        <div class="trade-picker-list">
          ${items.length ? items.map((item) => `
            <button class="trade-picker-item rarity-${item.rarity}" data-action="trade-select-item" data-instance-id="${item.instanceId}">
              <span class="gear-icon">${item.icon}</span>
              <span>
                <strong>${item.name}</strong>
                <small>${item.collectionLabel}</small>
              </span>
              ${rarityBadge(item.rarity)}
            </button>
          `).join('') : '<div class="empty-state">Нет доступных предметов для обмена.</div>'}
        </div>
        ${currentItem ? '<button class="secondary-button trade-picker-clear" data-action="trade-clear-slot">Убрать предмет из слота</button>' : ''}
      </div>
    </div>
  `;
}

function tradesWindow(state) {
  return `
    <div class="social-window panel-inner trade-window-layout">
      <div class="social-window__header">
        <div>
          <p class="section-label">🤝 Обмен</p>
          <h3>Запрос → принятие → выбор предметов → подтверждение</h3>
        </div>
        <button class="secondary-button" data-action="close-social">Закрыть</button>
      </div>
      ${activeTradeSummary(state)}
      <div class="social-columns trade-requests-columns">
        <div class="social-list">
          <p class="section-label">Входящие запросы</p>
          ${state.social.incomingTradeRequests.length
            ? state.social.incomingTradeRequests.map((request) => tradeRequestCard(request, true)).join('')
            : '<div class="empty-state">Нет входящих запросов на обмен.</div>'}
        </div>
        <div class="social-list">
          <p class="section-label">Исходящие запросы</p>
          ${state.social.outgoingTradeRequests.length
            ? state.social.outgoingTradeRequests.map((request) => tradeRequestCard(request, false)).join('')
            : '<div class="empty-state">Нет исходящих запросов на обмен.</div>'}
        </div>
        <div class="social-list">
          <p class="section-label">История</p>
          ${state.social.tradeHistory.length
            ? state.social.tradeHistory.map((trade) => `
              <div class="social-card">
                <strong>${trade.partner.username}</strong>
                <span>Статус: ${trade.statusLabel}</span>
              </div>
            `).join('')
            : '<div class="empty-state">История обменов пуста.</div>'}
        </div>
      </div>
    </div>
  `;
}

function tradeModal(state) {
  if (!state.social.activeTrade || !state.tradeModalOpen) return '';

  return `
    <div class="modal visible trade-session-modal">
      <div class="modal__content trade-session-modal__content">
        ${tradeBoard(state)}
      </div>
    </div>
  `;
}

function chatWindow(state) {
  return `
    <div class="social-window panel-inner">
      <div class="social-window__header">
        <div>
          <p class="section-label">💬 Чат</p>
          <h3>Глобальный чат сервера</h3>
        </div>
        <button class="secondary-button" data-action="close-social">Закрыть</button>
      </div>
      <div class="chat-feed">
        ${(state.online.chatMessages.length ? state.online.chatMessages : [{ author: 'Система', text: 'Чат готов. Войди в аккаунт и напиши сообщение.' }]).map((message) => `
          <div class="chat-message">
            <strong>${message.author}</strong>
            <span>${message.text}</span>
          </div>
        `).join('')}
      </div>
      ${state.auth.user ? `
        <form class="chat-form" data-role="chat-form">
          <input type="text" name="message" maxlength="180" placeholder="Написать в чат..." />
          <button type="submit">Отправить</button>
        </form>
      ` : '<div class="empty-state">Сначала зарегистрируйся или войди.</div>'}
    </div>
  `;
}

function renderSocialWindow(state) {
  if (!state.auth.user) return '<div class="social-placeholder panel-inner"><div class="empty-state">Авторизуйся, чтобы пользоваться онлайном.</div></div>';
  if (!state.socialSection) return '<div class="social-placeholder panel-inner"></div>';
  if (state.socialSection === 'friends') return friendsWindow(state);
  if (state.socialSection === 'trade') return tradesWindow(state);
  return chatWindow(state);
}

function authOverlay(state) {
  if (state.auth.user) return '';
  return `
    <div class="auth-overlay">
      <div class="auth-overlay__content panel-inner">
        <div>
          <p class="section-label">Добро пожаловать</p>
          <h2>Сначала зарегистрируйся или войди</h2>
          <p class="auth-overlay__text">Это стартовый вход в игру. После авторизации заработают онлайн, чат, трейды и друзья.</p>
        </div>
        ${authPanel(state)}
        ${state.auth.error ? `<div class="auth-error">${state.auth.error}</div>` : ''}
      </div>
    </div>
  `;
}

export function renderApp(root, state) {
  const stats = getCollectionStats(state);
  const activeOffers = state.shopCategory ? state.shopOffers[state.shopCategory] : [];
  const secondsLeft = Math.max(0, Math.ceil((state.shopRefreshAt - Date.now()) / 1000));
  const currentShop = state.shopCategory ? categoryMeta[state.shopCategory] : null;

  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="brand">🌆 Life Sim</p>
          <h1>Симулятор жизни</h1>
        </div>
        <nav class="tabs">
          ${['work', 'shop', 'inventory', 'social'].map((tab) => `
            <button class="tab ${state.activeTab === tab ? 'active' : ''}" data-action="tab" data-tab="${tab}">
              ${tab === 'work' ? 'Работа' : tab === 'shop' ? 'Магазин' : tab === 'inventory' ? 'Инвентарь' : 'Социальное'}
            </button>
          `).join('')}
        </nav>
        <div class="topbar-stats">
          <div class="top-chip"><span>$</span><strong>${formatMoney(state.money)}</strong></div>
          <div class="top-chip"><span>LVL</span><strong>${state.level}</strong></div>
          <div class="top-chip"><span>ENG</span><strong>${state.energy}%</strong></div>
          <div class="top-chip online ${state.online.status}"><span>ONLINE</span><strong>${state.online.onlineCount}</strong></div>
        </div>
      </header>

      <main class="layout">
        <aside class="panel notifications compact-panel">
          <p class="section-label">Лента</p>
          ${state.notifications.map((message) => `<div class="notification">${message}</div>`).join('')}
        </aside>

        ${state.activeTab === 'work' ? `
          <section class="panel work-panel content-panel">
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
          <section class="panel shop-panel content-panel">
            <div class="shop-header">
              <div>
                <p class="section-label">Магазин</p>
                <h2>Выбери один из 3 магазинов</h2>
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
                </button>
              `).join('')}
            </div>
            ${currentShop ? `
              <div class="shop-window panel-inner">
                <div class="shop-showcase__header">
                  <div>
                    <p class="section-label">${currentShop.icon} ${currentShop.label}</p>
                    <h3>Предметы магазина</h3>
                  </div>
                  <button class="secondary-button" data-action="close-shop">Закрыть</button>
                </div>
                <div class="shop-grid">
                  ${activeOffers.map((item) => shopCard(item)).join('')}
                </div>
              </div>
            ` : '<div class="shop-window panel-inner empty-window"></div>'}
          </section>
        ` : ''}

        ${state.activeTab === 'inventory' ? `
          <section class="panel inventory-panel content-panel">
            <div class="inventory-main-grid">
              <div class="equipment-panel panel-inner">
                <div class="equipment-panel__header">
                  <div>
                    <p class="section-label">Экипировка</p>
                    <h2>Снаряжение</h2>
                  </div>
                  <button class="secondary-button" data-action="open-stats">Статистика</button>
                </div>
                <div class="character-frame">
                  <div class="character-avatar">🧍</div>
                  <div class="equip-grid">
                    ${Object.entries(slotLabels).map(([slotKey]) => equipTile(slotKey, state.equipped[slotKey])).join('')}
                  </div>
                </div>
              </div>
              <div class="backpack-panel panel-inner">
                <div class="inventory-header">
                  <div>
                    <p class="section-label">Рюкзак</p>
                    <h2>Предметы</h2>
                  </div>
                </div>
                <div class="inventory-grid">
                  ${state.inventory.length ? state.inventory.map((item) => inventoryTile(item)).join('') : '<div class="empty-state">Рюкзак пуст.</div>'}
                </div>
              </div>
            </div>
            <div class="owned-sections">
              <div class="panel-inner owned-panel">
                <p class="section-label">🚗 Гараж</p>
                <div class="collection-grid">
                  ${state.ownedCars.length ? state.ownedCars.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Пока нет машин.</div>'}
                </div>
              </div>
              <div class="panel-inner owned-panel">
                <p class="section-label">🏠 Недвижимость</p>
                <div class="collection-grid">
                  ${state.ownedProperty.length ? state.ownedProperty.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Пока нет недвижимости.</div>'}
                </div>
              </div>
            </div>
          </section>
        ` : ''}

        ${state.activeTab === 'social' ? `
          <section class="panel social-panel content-panel">
            ${state.auth.user ? authPanel(state) : ''}
            <div class="shop-header">
              <div>
                <p class="section-label">Социальное</p>
                <h2>Регистрация, друзья, трейды и чат</h2>
              </div>
              <div class="refresh-box">
                <span>Статус сервера</span>
                <strong>${state.online.status}</strong>
              </div>
            </div>
            <div class="shop-selector social-selector">
              ${Object.entries(socialMeta).map(([key, meta]) => `
                <button class="store-card ${state.socialSection === key ? 'active' : ''}" data-action="social-section" data-section="${key}">
                  <span class="store-card__icon">${meta.icon}</span>
                  <strong>${meta.label}</strong>
                </button>
              `).join('')}
            </div>
            ${renderSocialWindow(state)}
          </section>
        ` : ''}
      </main>

      ${authOverlay(state)}
      ${tradeModal(state)}
      ${tradePickerModal(state)}

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
