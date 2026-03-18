import { rarityMap, categoryMeta, caseCatalog } from './data.js';
import { getCollectionStats, getTradeableItems, getExpProgress } from './state.js';

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

const tabLabels = {
  work: 'Работа',
  shop: 'Магазин',
  cases: 'Кейсы',
  inventory: 'Инвентарь',
  social: 'Социальное'
};

const inventorySections = {
  clothing: { label: 'Одежда', icon: '🧥', empty: 'Рюкзак пуст.' },
  cars: { label: 'Машины', icon: '🚗', empty: 'Пока нет машин.' },
  property: { label: 'Недвижимость', icon: '🏠', empty: 'Пока нет недвижимости.' }
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

function caseCard(item) {
  return `
    <article class="item-tile rarity-${item.rarity} case-tile">
      <div class="item-tile__top">
        <span class="gear-icon">${item.icon}</span>
        ${rarityBadge(item.rarity)}
      </div>
      <div class="item-tile__body">
        <h3>${item.name}</h3>
        <p>${item.description}</p>
      </div>
      <div class="item-tile__footer">
        <strong class="price">$${formatMoney(item.price)}</strong>
        <button data-action="open-case" data-id="${item.id}">Открыть</button>
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
              <div class="friend-actions">
                <button class="friend-action friend-action--ghost" data-action="friend-view-inventory" data-friend-id="${friend.id}">Инвентарь</button>
                <button class="friend-action friend-action--ghost" data-action="friend-open-messages" data-friend-id="${friend.id}">ЛС</button>
                <button class="friend-action" ${activeTrade ? 'disabled' : ''} data-action="trade-request" data-user-id="${friend.id}">Трейд</button>
                <button class="friend-action friend-action--danger" data-action="friend-remove" data-friend-id="${friend.id}">Удалить</button>
              </div>
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

function workShiftModal(state) {
  if (!state.workSession.open) return '';

  const actionsToExp = state.workClicks % 5 === 0 ? 5 : 5 - (state.workClicks % 5);
  return `
    <div class="modal visible work-shift-modal">
      <div class="modal__content work-shift-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Работа грузчиком</p>
            <h3>Перетащи ящик из зоны A в зону B</h3>
          </div>
          <button class="icon-button" data-action="work-close">✕</button>
        </div>
        <div class="work-shift-summary">
          <div class="mini-card"><span>За эту смену</span><strong>${state.workSession.deliveredThisShift}</strong></div>
          <div class="mini-card"><span>Заработано</span><strong>$${formatMoney(state.workSession.shiftEarnings)}</strong></div>
          <div class="mini-card"><span>Энергия</span><strong>${state.energy}%</strong></div>
          <div class="mini-card"><span>До EXP</span><strong>${actionsToExp} ящ.</strong></div>
        </div>
        <div class="work-shift-board">
          <div class="work-zone work-zone--start" data-work-dropzone="start">
            <span class="work-zone__label">Точка A</span>
            <p>Зажми ящик и перетащи его на склад.</p>
            <button class="work-crate ${state.workSession.pendingDrop ? 'work-crate--locked' : ''}" ${state.workSession.pendingDrop ? 'disabled' : ''} data-work-crate>
              <span class="work-crate__emoji">📦</span>
              <strong>Ящик</strong>
              <small>Тяни курсором</small>
            </button>
          </div>
          <div class="work-shift-track">
            <div class="work-shift-track__line"></div>
            <span>→</span>
          </div>
          <div class="work-zone work-zone--finish" data-work-dropzone="target">
            <span class="work-zone__label">Точка B</span>
            <p>Отпусти ящик внутри этой зоны, чтобы завершить перенос.</p>
            <div class="work-drop-target ${state.workSession.pendingDrop ? 'work-drop-target--busy' : ''}">
              <span>Склад</span>
            </div>
          </div>
        </div>
        <div class="work-shift-footer">
          <p>За каждый успешно доставленный ящик начисляются деньги и тратится энергия. Каждые 5 ящиков дают опыт.</p>
          <button class="secondary-button" data-action="rest">Отдохнуть</button>
        </div>
      </div>
    </div>
  `;
}

function getInventorySectionItems(state) {
  if (state.inventorySection === 'cars') return state.ownedCars;
  if (state.inventorySection === 'property') return state.ownedProperty;
  return state.inventory;
}

function inventoryCollectionTile(item, section) {
  if (section === 'clothing') return inventoryTile(item);
  return collectionTile(item);
}

function caseOpeningModal(state) {
  if (!state.caseOpening.open) return '';

  return `
    <div class="modal visible case-opening-modal">
      <div class="modal__content case-opening-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Кейс</p>
            <h3>Прокрутка дропа</h3>
          </div>
          <button class="icon-button" data-action="case-close-modal">✕</button>
        </div>
        <div class="case-roulette">
          <div class="case-roulette__pointer"></div>
          <div class="case-roulette__viewport">
            <div class="case-roulette__track" style="transform: translateX(-${state.caseOpening.offset}px)">
              ${state.caseOpening.strip.map((item) => `
                <div class="case-roulette__card rarity-${item.rarity}">
                  <span class="gear-icon">${item.icon}</span>
                  <strong>${item.name}</strong>
                  ${rarityBadge(item.rarity)}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="case-opening-result ${state.caseOpening.reveal ? 'visible' : ''}">
          <p class="section-label">Выбито</p>
          ${state.caseOpening.reward ? collectionTile(state.caseOpening.reward) : ''}
        </div>
      </div>
    </div>
  `;
}

function friendModal(state) {
  if (!state.friendModal.open || !state.friendModal.friend) return '';

  const friend = state.friendModal.friend;
  const gameState = state.friendModal.gameState || { equipped: {}, inventory: [], ownedCars: [], ownedProperty: [] };
  return `
    <div class="modal visible friend-modal">
      <div class="modal__content friend-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Друг</p>
            <h3>${friend.username}</h3>
          </div>
          <button class="icon-button" data-action="friend-modal-close">✕</button>
        </div>
        <div class="friend-modal__tabs">
          <button class="tab ${state.friendModal.mode === 'inventory' ? 'active' : ''}" data-action="friend-modal-mode" data-mode="inventory">Инвентарь</button>
          <button class="tab ${state.friendModal.mode === 'messages' ? 'active' : ''}" data-action="friend-modal-mode" data-mode="messages">Личные сообщения</button>
        </div>
        ${state.friendModal.mode === 'inventory' ? `
          <div class="friend-modal__inventory">
            <div class="panel-inner">
              <p class="section-label">Экипировано</p>
              <div class="collection-grid">
                ${Object.values(gameState.equipped || {}).filter(Boolean).length
                  ? Object.values(gameState.equipped || {}).filter(Boolean).map((item) => collectionTile(item)).join('')
                  : '<div class="empty-state">Ничего не экипировано.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Рюкзак</p>
              <div class="collection-grid">
                ${gameState.inventory?.length ? gameState.inventory.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Рюкзак пуст.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Гараж</p>
              <div class="collection-grid">
                ${gameState.ownedCars?.length ? gameState.ownedCars.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Машин нет.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Недвижимость</p>
              <div class="collection-grid">
                ${gameState.ownedProperty?.length ? gameState.ownedProperty.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Недвижимости нет.</div>'}
              </div>
            </div>
          </div>
        ` : `
          <div class="friend-modal__messages">
            <div class="chat-feed friend-chat-feed">
              ${state.friendModal.messages.length
                ? state.friendModal.messages.map((message) => `
                  <div class="chat-message ${message.own ? 'chat-message--own' : ''}">
                    <strong>${message.author?.username || friend.username}</strong>
                    <span>${message.text}</span>
                  </div>
                `).join('')
                : '<div class="empty-state">Сообщений пока нет.</div>'}
            </div>
            <form class="chat-form" data-role="dm-form">
              <input type="text" name="dm_text" maxlength="240" placeholder="Написать сообщение другу..." />
              <button type="submit">Отправить</button>
            </form>
          </div>
        `}
      </div>
    </div>
  `;
}

  const actionsToExp = state.workClicks % 5 === 0 ? 5 : 5 - (state.workClicks % 5);
  return `
    <div class="modal visible work-shift-modal">
      <div class="modal__content work-shift-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Работа грузчиком</p>
            <h3>Перетащи ящик из зоны A в зону B</h3>
          </div>
          <button class="icon-button" data-action="work-close">✕</button>
        </div>
        <div class="work-shift-summary">
          <div class="mini-card"><span>За эту смену</span><strong>${state.workSession.deliveredThisShift}</strong></div>
          <div class="mini-card"><span>Заработано</span><strong>$${formatMoney(state.workSession.shiftEarnings)}</strong></div>
          <div class="mini-card"><span>Энергия</span><strong>${state.energy}%</strong></div>
          <div class="mini-card"><span>До EXP</span><strong>${actionsToExp} ящ.</strong></div>
        </div>
        <div class="work-shift-board">
          <div class="work-zone work-zone--start" data-work-dropzone="start">
            <span class="work-zone__label">Точка A</span>
            <p>Зажми ящик и перетащи его на склад.</p>
            <button class="work-crate ${state.workSession.pendingDrop ? 'work-crate--locked' : ''}" ${state.workSession.pendingDrop ? 'disabled' : ''} data-work-crate>
              <span class="work-crate__emoji">📦</span>
              <strong>Ящик</strong>
              <small>Тяни курсором</small>
            </button>
          </div>
          <div class="work-shift-track">
            <div class="work-shift-track__line"></div>
            <span>→</span>
          </div>
          <div class="work-zone work-zone--finish" data-work-dropzone="target">
            <span class="work-zone__label">Точка B</span>
            <p>Отпусти ящик внутри этой зоны, чтобы завершить перенос.</p>
            <div class="work-drop-target ${state.workSession.pendingDrop ? 'work-drop-target--busy' : ''}">
              <span>Склад</span>
            </div>
          </div>
        </div>
        <div class="work-shift-footer">
          <p>За каждый успешно доставленный ящик начисляются деньги и тратится энергия. Каждые 5 ящиков дают опыт.</p>
          <button class="secondary-button" data-action="rest">Отдохнуть</button>
        </div>
      </div>
    </div>
  `;
}

function getInventorySectionItems(state) {
  if (state.inventorySection === 'cars') return state.ownedCars;
  if (state.inventorySection === 'property') return state.ownedProperty;
  return state.inventory;
}

function inventoryCollectionTile(item, section) {
  if (section === 'clothing') return inventoryTile(item);
  return collectionTile(item);
}

function caseOpeningModal(state) {
  if (!state.caseOpening.open) return '';

  return `
    <div class="modal visible case-opening-modal">
      <div class="modal__content case-opening-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Кейс</p>
            <h3>Прокрутка дропа</h3>
          </div>
          <button class="icon-button" data-action="case-close-modal">✕</button>
        </div>
        <div class="case-roulette">
          <div class="case-roulette__pointer"></div>
          <div class="case-roulette__viewport">
            <div class="case-roulette__track" style="transform: translateX(-${state.caseOpening.offset}px)">
              ${state.caseOpening.strip.map((item) => `
                <div class="case-roulette__card rarity-${item.rarity}">
                  <span class="gear-icon">${item.icon}</span>
                  <strong>${item.name}</strong>
                  ${rarityBadge(item.rarity)}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="case-opening-result ${state.caseOpening.reveal ? 'visible' : ''}">
          <p class="section-label">Выбито</p>
          ${state.caseOpening.reward ? collectionTile(state.caseOpening.reward) : ''}
        </div>
      </div>
    </div>
  `;
}

function friendModal(state) {
  if (!state.friendModal.open || !state.friendModal.friend) return '';

  const friend = state.friendModal.friend;
  const gameState = state.friendModal.gameState || { equipped: {}, inventory: [], ownedCars: [], ownedProperty: [] };
  return `
    <div class="modal visible friend-modal">
      <div class="modal__content friend-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Друг</p>
            <h3>${friend.username}</h3>
          </div>
          <button class="icon-button" data-action="friend-modal-close">✕</button>
        </div>
        <div class="friend-modal__tabs">
          <button class="tab ${state.friendModal.mode === 'inventory' ? 'active' : ''}" data-action="friend-modal-mode" data-mode="inventory">Инвентарь</button>
          <button class="tab ${state.friendModal.mode === 'messages' ? 'active' : ''}" data-action="friend-modal-mode" data-mode="messages">Личные сообщения</button>
        </div>
        ${state.friendModal.mode === 'inventory' ? `
          <div class="friend-modal__inventory">
            <div class="panel-inner">
              <p class="section-label">Экипировано</p>
              <div class="collection-grid">
                ${Object.values(gameState.equipped || {}).filter(Boolean).length
                  ? Object.values(gameState.equipped || {}).filter(Boolean).map((item) => collectionTile(item)).join('')
                  : '<div class="empty-state">Ничего не экипировано.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Рюкзак</p>
              <div class="collection-grid">
                ${gameState.inventory?.length ? gameState.inventory.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Рюкзак пуст.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Гараж</p>
              <div class="collection-grid">
                ${gameState.ownedCars?.length ? gameState.ownedCars.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Машин нет.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Недвижимость</p>
              <div class="collection-grid">
                ${gameState.ownedProperty?.length ? gameState.ownedProperty.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Недвижимости нет.</div>'}
              </div>
            </div>
          </div>
        ` : `
          <div class="friend-modal__messages">
            <div class="chat-feed friend-chat-feed">
              ${state.friendModal.messages.length
                ? state.friendModal.messages.map((message) => `
                  <div class="chat-message ${message.own ? 'chat-message--own' : ''}">
                    <strong>${message.author?.username || friend.username}</strong>
                    <span>${message.text}</span>
                  </div>
                `).join('')
                : '<div class="empty-state">Сообщений пока нет.</div>'}
            </div>
            <form class="chat-form" data-role="dm-form">
              <input type="text" name="dm_text" maxlength="240" placeholder="Написать сообщение другу..." />
              <button type="submit">Отправить</button>
            </form>
          </div>
        `}
      </div>
    </div>
  `;
}

  const actionsToExp = state.workClicks % 5 === 0 ? 5 : 5 - (state.workClicks % 5);
  return `
    <div class="modal visible work-shift-modal">
      <div class="modal__content work-shift-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Работа грузчиком</p>
            <h3>Перетащи ящик из зоны A в зону B</h3>
          </div>
          <button class="icon-button" data-action="work-close">✕</button>
        </div>
        <div class="work-shift-summary">
          <div class="mini-card"><span>За эту смену</span><strong>${state.workSession.deliveredThisShift}</strong></div>
          <div class="mini-card"><span>Заработано</span><strong>$${formatMoney(state.workSession.shiftEarnings)}</strong></div>
          <div class="mini-card"><span>Энергия</span><strong>${state.energy}%</strong></div>
          <div class="mini-card"><span>До EXP</span><strong>${actionsToExp} ящ.</strong></div>
        </div>
        <div class="work-shift-board">
          <div class="work-zone work-zone--start" data-work-dropzone="start">
            <span class="work-zone__label">Точка A</span>
            <p>Зажми ящик и перетащи его на склад.</p>
            <button class="work-crate ${state.workSession.pendingDrop ? 'work-crate--locked' : ''}" ${state.workSession.pendingDrop ? 'disabled' : ''} data-work-crate>
              <span class="work-crate__emoji">📦</span>
              <strong>Ящик</strong>
              <small>Тяни курсором</small>
            </button>
          </div>
          <div class="work-shift-track">
            <div class="work-shift-track__line"></div>
            <span>→</span>
          </div>
          <div class="work-zone work-zone--finish" data-work-dropzone="target">
            <span class="work-zone__label">Точка B</span>
            <p>Отпусти ящик внутри этой зоны, чтобы завершить перенос.</p>
            <div class="work-drop-target ${state.workSession.pendingDrop ? 'work-drop-target--busy' : ''}">
              <span>Склад</span>
            </div>
          </div>
        </div>
        <div class="work-shift-footer">
          <p>За каждый успешно доставленный ящик начисляются деньги и тратится энергия. Каждые 5 ящиков дают опыт.</p>
          <button class="secondary-button" data-action="rest">Отдохнуть</button>
        </div>
      </div>
    </div>
  `;
}

function getInventorySectionItems(state) {
  if (state.inventorySection === 'cars') return state.ownedCars;
  if (state.inventorySection === 'property') return state.ownedProperty;
  return state.inventory;
}

function inventoryCollectionTile(item, section) {
  if (section === 'clothing') return inventoryTile(item);
  return collectionTile(item);
}

function caseOpeningModal(state) {
  if (!state.caseOpening.open) return '';

  return `
    <div class="modal visible case-opening-modal">
      <div class="modal__content case-opening-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Кейс</p>
            <h3>Прокрутка дропа</h3>
          </div>
          <button class="icon-button" data-action="case-close-modal">✕</button>
        </div>
        <div class="case-roulette">
          <div class="case-roulette__pointer"></div>
          <div class="case-roulette__viewport">
            <div class="case-roulette__track" style="transform: translateX(-${state.caseOpening.offset}px)">
              ${state.caseOpening.strip.map((item) => `
                <div class="case-roulette__card rarity-${item.rarity}">
                  <span class="gear-icon">${item.icon}</span>
                  <strong>${item.name}</strong>
                  ${rarityBadge(item.rarity)}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="case-opening-result ${state.caseOpening.reveal ? 'visible' : ''}">
          <p class="section-label">Выбито</p>
          ${state.caseOpening.reward ? collectionTile(state.caseOpening.reward) : ''}
        </div>
      </div>
    </div>
  `;
}

function friendModal(state) {
  if (!state.friendModal.open || !state.friendModal.friend) return '';

  const friend = state.friendModal.friend;
  const gameState = state.friendModal.gameState || { equipped: {}, inventory: [], ownedCars: [], ownedProperty: [] };
  return `
    <div class="modal visible friend-modal">
      <div class="modal__content friend-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Друг</p>
            <h3>${friend.username}</h3>
          </div>
          <button class="icon-button" data-action="friend-modal-close">✕</button>
        </div>
        <div class="friend-modal__tabs">
          <button class="tab ${state.friendModal.mode === 'inventory' ? 'active' : ''}" data-action="friend-modal-mode" data-mode="inventory">Инвентарь</button>
          <button class="tab ${state.friendModal.mode === 'messages' ? 'active' : ''}" data-action="friend-modal-mode" data-mode="messages">Личные сообщения</button>
        </div>
        ${state.friendModal.mode === 'inventory' ? `
          <div class="friend-modal__inventory">
            <div class="panel-inner">
              <p class="section-label">Экипировано</p>
              <div class="collection-grid">
                ${Object.values(gameState.equipped || {}).filter(Boolean).length
                  ? Object.values(gameState.equipped || {}).filter(Boolean).map((item) => collectionTile(item)).join('')
                  : '<div class="empty-state">Ничего не экипировано.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Рюкзак</p>
              <div class="collection-grid">
                ${gameState.inventory?.length ? gameState.inventory.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Рюкзак пуст.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Гараж</p>
              <div class="collection-grid">
                ${gameState.ownedCars?.length ? gameState.ownedCars.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Машин нет.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Недвижимость</p>
              <div class="collection-grid">
                ${gameState.ownedProperty?.length ? gameState.ownedProperty.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Недвижимости нет.</div>'}
              </div>
            </div>
          </div>
        ` : `
          <div class="friend-modal__messages">
            <div class="chat-feed friend-chat-feed">
              ${state.friendModal.messages.length
                ? state.friendModal.messages.map((message) => `
                  <div class="chat-message ${message.own ? 'chat-message--own' : ''}">
                    <strong>${message.author?.username || friend.username}</strong>
                    <span>${message.text}</span>
                  </div>
                `).join('')
                : '<div class="empty-state">Сообщений пока нет.</div>'}
            </div>
            <form class="chat-form" data-role="dm-form">
              <input type="text" name="dm_text" maxlength="240" placeholder="Написать сообщение другу..." />
              <button type="submit">Отправить</button>
            </form>
          </div>
        `}
      </div>
    </div>
  `;
}

  const actionsToExp = state.workClicks % 5 === 0 ? 5 : 5 - (state.workClicks % 5);
  return `
    <div class="modal visible work-shift-modal">
      <div class="modal__content work-shift-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Работа грузчиком</p>
            <h3>Перетащи ящик из зоны A в зону B</h3>
          </div>
          <button class="icon-button" data-action="work-close">✕</button>
        </div>
        <div class="work-shift-summary">
          <div class="mini-card"><span>За эту смену</span><strong>${state.workSession.deliveredThisShift}</strong></div>
          <div class="mini-card"><span>Заработано</span><strong>$${formatMoney(state.workSession.shiftEarnings)}</strong></div>
          <div class="mini-card"><span>Энергия</span><strong>${state.energy}%</strong></div>
          <div class="mini-card"><span>До EXP</span><strong>${actionsToExp} ящ.</strong></div>
        </div>
        <div class="work-shift-board">
          <div class="work-zone work-zone--start" data-work-dropzone="start">
            <span class="work-zone__label">Точка A</span>
            <p>Зажми ящик и перетащи его на склад.</p>
            <button class="work-crate ${state.workSession.pendingDrop ? 'work-crate--locked' : ''}" ${state.workSession.pendingDrop ? 'disabled' : ''} data-work-crate>
              <span class="work-crate__emoji">📦</span>
              <strong>Ящик</strong>
              <small>Тяни курсором</small>
            </button>
          </div>
          <div class="work-shift-track">
            <div class="work-shift-track__line"></div>
            <span>→</span>
          </div>
          <div class="work-zone work-zone--finish" data-work-dropzone="target">
            <span class="work-zone__label">Точка B</span>
            <p>Отпусти ящик внутри этой зоны, чтобы завершить перенос.</p>
            <div class="work-drop-target ${state.workSession.pendingDrop ? 'work-drop-target--busy' : ''}">
              <span>Склад</span>
            </div>
          </div>
        </div>
        <div class="work-shift-footer">
          <p>За каждый успешно доставленный ящик начисляются деньги и тратится энергия. Каждые 5 ящиков дают опыт.</p>
          <button class="secondary-button" data-action="rest">Отдохнуть</button>
        </div>
      </div>
    </div>
  `;
}

function getInventorySectionItems(state) {
  if (state.inventorySection === 'cars') return state.ownedCars;
  if (state.inventorySection === 'property') return state.ownedProperty;
  return state.inventory;
}

function inventoryCollectionTile(item, section) {
  if (section === 'clothing') return inventoryTile(item);
  return collectionTile(item);
}

function caseOpeningModal(state) {
  if (!state.caseOpening.open) return '';

  return `
    <div class="modal visible case-opening-modal">
      <div class="modal__content case-opening-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Кейс</p>
            <h3>Прокрутка дропа</h3>
          </div>
          <button class="icon-button" data-action="case-close-modal">✕</button>
        </div>
        <div class="case-roulette">
          <div class="case-roulette__pointer"></div>
          <div class="case-roulette__viewport">
            <div class="case-roulette__track" style="transform: translateX(-${state.caseOpening.offset}px)">
              ${state.caseOpening.strip.map((item) => `
                <div class="case-roulette__card rarity-${item.rarity}">
                  <span class="gear-icon">${item.icon}</span>
                  <strong>${item.name}</strong>
                  ${rarityBadge(item.rarity)}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="case-opening-result ${state.caseOpening.reveal ? 'visible' : ''}">
          <p class="section-label">Выбито</p>
          ${state.caseOpening.reward ? collectionTile(state.caseOpening.reward) : ''}
        </div>
      </div>
    </div>
  `;
}

function friendModal(state) {
  if (!state.friendModal.open || !state.friendModal.friend) return '';

  const friend = state.friendModal.friend;
  const gameState = state.friendModal.gameState || { equipped: {}, inventory: [], ownedCars: [], ownedProperty: [] };
  return `
    <div class="modal visible friend-modal">
      <div class="modal__content friend-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Друг</p>
            <h3>${friend.username}</h3>
          </div>
          <button class="icon-button" data-action="friend-modal-close">✕</button>
        </div>
        <div class="friend-modal__tabs">
          <button class="tab ${state.friendModal.mode === 'inventory' ? 'active' : ''}" data-action="friend-modal-mode" data-mode="inventory">Инвентарь</button>
          <button class="tab ${state.friendModal.mode === 'messages' ? 'active' : ''}" data-action="friend-modal-mode" data-mode="messages">Личные сообщения</button>
        </div>
        ${state.friendModal.mode === 'inventory' ? `
          <div class="friend-modal__inventory">
            <div class="panel-inner">
              <p class="section-label">Экипировано</p>
              <div class="collection-grid">
                ${Object.values(gameState.equipped || {}).filter(Boolean).length
                  ? Object.values(gameState.equipped || {}).filter(Boolean).map((item) => collectionTile(item)).join('')
                  : '<div class="empty-state">Ничего не экипировано.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Рюкзак</p>
              <div class="collection-grid">
                ${gameState.inventory?.length ? gameState.inventory.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Рюкзак пуст.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Гараж</p>
              <div class="collection-grid">
                ${gameState.ownedCars?.length ? gameState.ownedCars.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Машин нет.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Недвижимость</p>
              <div class="collection-grid">
                ${gameState.ownedProperty?.length ? gameState.ownedProperty.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Недвижимости нет.</div>'}
              </div>
            </div>
          </div>
        ` : `
          <div class="friend-modal__messages">
            <div class="chat-feed friend-chat-feed">
              ${state.friendModal.messages.length
                ? state.friendModal.messages.map((message) => `
                  <div class="chat-message ${message.own ? 'chat-message--own' : ''}">
                    <strong>${message.author?.username || friend.username}</strong>
                    <span>${message.text}</span>
                  </div>
                `).join('')
                : '<div class="empty-state">Сообщений пока нет.</div>'}
            </div>
            <form class="chat-form" data-role="dm-form">
              <input type="text" name="dm_text" maxlength="240" placeholder="Написать сообщение другу..." />
              <button type="submit">Отправить</button>
            </form>
          </div>
        `}
      </div>
    </div>
  `;
}

  const actionsToExp = state.workClicks % 5 === 0 ? 5 : 5 - (state.workClicks % 5);
  return `
    <div class="modal visible work-shift-modal">
      <div class="modal__content work-shift-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Работа грузчиком</p>
            <h3>Перетащи ящик из зоны A в зону B</h3>
          </div>
          <button class="icon-button" data-action="work-close">✕</button>
        </div>
        <div class="work-shift-summary">
          <div class="mini-card"><span>За эту смену</span><strong>${state.workSession.deliveredThisShift}</strong></div>
          <div class="mini-card"><span>Заработано</span><strong>$${formatMoney(state.workSession.shiftEarnings)}</strong></div>
          <div class="mini-card"><span>Энергия</span><strong>${state.energy}%</strong></div>
          <div class="mini-card"><span>До EXP</span><strong>${actionsToExp} ящ.</strong></div>
        </div>
        <div class="work-shift-board">
          <div class="work-zone work-zone--start" data-work-dropzone="start">
            <span class="work-zone__label">Точка A</span>
            <p>Зажми ящик и перетащи его на склад.</p>
            <button class="work-crate ${state.workSession.pendingDrop ? 'work-crate--locked' : ''}" ${state.workSession.pendingDrop ? 'disabled' : ''} data-work-crate>
              <span class="work-crate__emoji">📦</span>
              <strong>Ящик</strong>
              <small>Тяни курсором</small>
            </button>
          </div>
          <div class="work-shift-track">
            <div class="work-shift-track__line"></div>
            <span>→</span>
          </div>
          <div class="work-zone work-zone--finish" data-work-dropzone="target">
            <span class="work-zone__label">Точка B</span>
            <p>Отпусти ящик внутри этой зоны, чтобы завершить перенос.</p>
            <div class="work-drop-target ${state.workSession.pendingDrop ? 'work-drop-target--busy' : ''}">
              <span>Склад</span>
            </div>
          </div>
        </div>
        <div class="work-shift-footer">
          <p>За каждый успешно доставленный ящик начисляются деньги и тратится энергия. Каждые 5 ящиков дают опыт.</p>
          <button class="secondary-button" data-action="rest">Отдохнуть</button>
        </div>
      </div>
    </div>
  `;
}

function getInventorySectionItems(state) {
  if (state.inventorySection === 'cars') return state.ownedCars;
  if (state.inventorySection === 'property') return state.ownedProperty;
  return state.inventory;
}

function inventoryCollectionTile(item, section) {
  if (section === 'clothing') return inventoryTile(item);
  return collectionTile(item);
}

function caseOpeningModal(state) {
  if (!state.caseOpening.open) return '';

  return `
    <div class="modal visible case-opening-modal">
      <div class="modal__content case-opening-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Кейс</p>
            <h3>Прокрутка дропа</h3>
          </div>
          <button class="icon-button" data-action="case-close-modal">✕</button>
        </div>
        <div class="case-roulette">
          <div class="case-roulette__pointer"></div>
          <div class="case-roulette__viewport">
            <div class="case-roulette__track" style="transform: translateX(-${state.caseOpening.offset}px)">
              ${state.caseOpening.strip.map((item) => `
                <div class="case-roulette__card rarity-${item.rarity}">
                  <span class="gear-icon">${item.icon}</span>
                  <strong>${item.name}</strong>
                  ${rarityBadge(item.rarity)}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="case-opening-result ${state.caseOpening.reveal ? 'visible' : ''}">
          <p class="section-label">Выбито</p>
          ${state.caseOpening.reward ? collectionTile(state.caseOpening.reward) : ''}
        </div>
      </div>
    </div>
  `;
}

function friendModal(state) {
  if (!state.friendModal.open || !state.friendModal.friend) return '';

  const friend = state.friendModal.friend;
  const gameState = state.friendModal.gameState || { equipped: {}, inventory: [], ownedCars: [], ownedProperty: [] };
  return `
    <div class="modal visible friend-modal">
      <div class="modal__content friend-modal__content">
        <div class="modal__header">
          <div>
            <p class="section-label">Друг</p>
            <h3>${friend.username}</h3>
          </div>
          <button class="icon-button" data-action="friend-modal-close">✕</button>
        </div>
        <div class="friend-modal__tabs">
          <button class="tab ${state.friendModal.mode === 'inventory' ? 'active' : ''}" data-action="friend-modal-mode" data-mode="inventory">Инвентарь</button>
          <button class="tab ${state.friendModal.mode === 'messages' ? 'active' : ''}" data-action="friend-modal-mode" data-mode="messages">Личные сообщения</button>
        </div>
        ${state.friendModal.mode === 'inventory' ? `
          <div class="friend-modal__inventory">
            <div class="panel-inner">
              <p class="section-label">Экипировано</p>
              <div class="collection-grid">
                ${Object.values(gameState.equipped || {}).filter(Boolean).length
                  ? Object.values(gameState.equipped || {}).filter(Boolean).map((item) => collectionTile(item)).join('')
                  : '<div class="empty-state">Ничего не экипировано.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Рюкзак</p>
              <div class="collection-grid">
                ${gameState.inventory?.length ? gameState.inventory.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Рюкзак пуст.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Гараж</p>
              <div class="collection-grid">
                ${gameState.ownedCars?.length ? gameState.ownedCars.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Машин нет.</div>'}
              </div>
            </div>
            <div class="panel-inner">
              <p class="section-label">Недвижимость</p>
              <div class="collection-grid">
                ${gameState.ownedProperty?.length ? gameState.ownedProperty.map((item) => collectionTile(item)).join('') : '<div class="empty-state">Недвижимости нет.</div>'}
              </div>
            </div>
          </div>
        ` : `
          <div class="friend-modal__messages">
            <div class="chat-feed friend-chat-feed">
              ${state.friendModal.messages.length
                ? state.friendModal.messages.map((message) => `
                  <div class="chat-message ${message.own ? 'chat-message--own' : ''}">
                    <strong>${message.author?.username || friend.username}</strong>
                    <span>${message.text}</span>
                  </div>
                `).join('')
                : '<div class="empty-state">Сообщений пока нет.</div>'}
            </div>
            <form class="chat-form" data-role="dm-form">
              <input type="text" name="dm_text" maxlength="240" placeholder="Написать сообщение другу..." />
              <button type="submit">Отправить</button>
            </form>
          </div>
        `}
      </div>
    </div>
  `;
}

function authOverlay() {
  return '';
}

export function renderApp(root, state) {
  const stats = getCollectionStats(state);
  const activeOffers = state.shopCategory ? state.shopOffers[state.shopCategory] : [];
  const secondsLeft = Math.max(0, Math.ceil((state.shopRefreshAt - Date.now()) / 1000));
  const currentShop = state.shopCategory ? categoryMeta[state.shopCategory] : null;
  const expProgress = getExpProgress(state);

  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="brand">🌆 Life Sim</p>
          <h1>Симулятор жизни</h1>
        </div>
        <nav class="tabs">
          ${['work', 'shop', 'cases', 'inventory', 'social'].map((tab) => `
            <button class="tab ${state.activeTab === tab ? 'active' : ''}" data-action="tab" data-tab="${tab}">
              ${tabLabels[tab]}
            </button>
          `).join('')}
        </nav>
        <div class="topbar-stats topbar-stats--rich">
          <div class="money-card">
            <span class="money-card__brand">LIFE PAY</span>
            <strong>$${formatMoney(state.money)}</strong>
            <small>игровой баланс</small>
          </div>
          <div class="progress-card">
            <div class="top-chip"><span>LVL</span><strong>${state.level}</strong></div>
            <div class="progress-line-card">
              <span>Энергия</span>
              <div class="progress-line"><i style="width:${state.energy}%"></i></div>
            </div>
            <div class="progress-line-card progress-line-card--exp">
              <span>Опыт ${expProgress}/100</span>
              <div class="progress-line"><i style="width:${expProgress}%"></i></div>
            </div>
          </div>
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
              <h2>Грузчик на складе 📦</h2>
              <p>Открой смену, перетаскивай ящик из точки A в точку B и получай оплату за каждый успешный перенос.</p>
              <div class="work-actions">
                <button class="primary-button" data-action="work-open">Выйти на смену</button>
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

        ${state.activeTab === 'cases' ? `
          <section class="panel shop-panel content-panel">
            <div class="shop-header">
              <div>
                <p class="section-label">Кейсы</p>
                <h2>Автомобильные кейсы</h2>
              </div>
              <div class="refresh-box">
                <span>Всего кейсов</span>
                <strong>${caseCatalog.length}</strong>
              </div>
            </div>
            <div class="cases-grid">
              ${caseCatalog.map((item) => caseCard(item)).join('')}
            </div>
          </section>
        ` : ''}

        ${state.activeTab === 'inventory' ? `
          <section class="panel inventory-panel content-panel">
            <div class="inventory-layout">
              <div class="equipment-panel panel-inner">
                <div class="equipment-panel__header">
                  <div>
                    <p class="section-label">1 · Надето</p>
                    <h2>Экипировка персонажа</h2>
                    <p class="inventory-panel__hint">Слева — только вещи, которые сейчас надеты на персонажа.</p>
                  </div>
                  <button class="secondary-button inventory-stats-button" data-action="open-stats">Статистика</button>
                </div>
                <div class="inventory-overview">
                  <div class="inventory-overview__item">
                    <span>Экипировано</span>
                    <strong>${Object.values(state.equipped).filter(Boolean).length}/5</strong>
                  </div>
                  <div class="inventory-overview__item">
                    <span>Гардероб</span>
                    <strong>${stats.wardrobe}</strong>
                  </div>
                  <div class="inventory-overview__item">
                    <span>Транспорт</span>
                    <strong>${stats.cars}</strong>
                  </div>
                </div>
                <div class="character-frame">
                  <div class="character-stage">
                    <div class="character-avatar">🧍‍♂️</div>
                    <div class="character-stage__meta">
                      <span>Твой персонаж</span>
                      <strong>Нажми на слот, чтобы снять предмет</strong>
                    </div>
                  </div>
                  <div class="equip-grid">
                    ${Object.entries(slotLabels).map(([slotKey]) => equipTile(slotKey, state.equipped[slotKey])).join('')}
                  </div>
                </div>
              </div>

              <div class="inventory-sections-panel panel-inner">
                <div class="inventory-header">
                  <div>
                    <p class="section-label">2 · Разделы</p>
                    <h2>Переключатель категорий</h2>
                  </div>
                </div>
                <div class="inventory-section-switcher">
                  ${Object.entries(inventorySections).map(([key, meta]) => `
                    <button class="inventory-section-button ${state.inventorySection === key ? 'active' : ''}" data-action="inventory-section" data-section="${key}">
                      <span class="inventory-section-button__icon">${meta.icon}</span>
                      <span>
                        <strong>${meta.label}</strong>
                        <small>${key === 'clothing' ? stats.wardrobe : key === 'cars' ? stats.cars : stats.property}</small>
                      </span>
                    </button>
                  `).join('')}
                </div>
              </div>

              <div class="inventory-content-panel panel-inner">
                <div class="inventory-header">
                  <div>
                    <p class="section-label">3 · Содержимое</p>
                    <h2>${inventorySections[state.inventorySection].label}</h2>
                  </div>
                </div>
                <div class="${state.inventorySection === 'clothing' ? 'inventory-grid' : 'collection-grid'}">
                  ${getInventorySectionItems(state).length
                    ? getInventorySectionItems(state).map((item) => inventoryCollectionTile(item, state.inventorySection)).join('')
                    : `<div class="empty-state">${inventorySections[state.inventorySection].empty}</div>`}
                </div>
              </div>
            </div>
          </section>
        ` : ''}

        ${state.activeTab === 'social' ? `
          <section class="panel social-panel content-panel">
            ${authPanel(state)}
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
      ${friendModal(state)}
      ${tradeModal(state)}
      ${tradePickerModal(state)}
      ${workShiftModal(state)}
      ${caseOpeningModal(state)}

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
