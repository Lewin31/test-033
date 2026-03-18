import { getRandomItems, catalogs, caseCatalog, getCaseRewards } from './data.js';

const STORAGE_KEY = 'life-sim-save-v3';
const EQUIP_SLOTS = ['head', 'torso', 'legs', 'feet', 'accessory'];

function cloneValue(value) {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function createInstanceId(itemId = 'item') {
  return `${itemId}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(16).slice(2)}`;
}

function normalizeItem(item) {
  if (!item || typeof item !== 'object') return null;

  return {
    ...item,
    id: String(item.id || 'item'),
    instanceId: String(item.instanceId || createInstanceId(item.id || 'item')),
    category: String(item.category || 'clothing'),
    name: String(item.name || 'Предмет'),
    rarity: String(item.rarity || 'common'),
    icon: String(item.icon || '📦'),
    price: Number(item.price || 0),
    stats: item.stats && typeof item.stats === 'object' ? { ...item.stats } : {},
    ...(item.slot ? { slot: String(item.slot) } : {})
  };
}

function normalizeCollection(items) {
  return Array.isArray(items) ? items.map(normalizeItem).filter(Boolean) : [];
}

function normalizeEquipped(equipped = {}) {
  return EQUIP_SLOTS.reduce((result, slotKey) => {
    result[slotKey] = normalizeItem(equipped[slotKey]);
    return result;
  }, {});
}

export function createDefaultPlayerState() {
  return {
    money: 15000,
    exp: 0,
    level: 1,
    workClicks: 0,
    energy: 100,
    inventory: [],
    ownedCars: [],
    ownedProperty: [],
    equipped: normalizeEquipped()
  };
}

const defaultState = {
  ...createDefaultPlayerState(),
  activeTab: 'shop',
  shopCategory: null,
  socialSection: null,
  tradeModalOpen: false,
  friendModal: {
    open: false,
    mode: 'inventory',
    friend: null,
    gameState: null,
    messages: []
  },
  inventorySection: 'clothing',
  workSession: {
    open: false,
    deliveredThisShift: 0,
    shiftEarnings: 0,
    pendingDrop: false
  },
  caseOpening: {
    open: false,
    caseId: '',
    reward: null,
    strip: [],
    offset: 0,
    reveal: false,
    spinning: false,
    rewardIndex: 0
  },
  tradePicker: {
    slotIndex: null
  },
  shopOffers: {
    clothing: getRandomItems('clothing', 5),
    cars: getRandomItems('cars', 5),
    property: getRandomItems('property', 5)
  },
  auth: {
    token: '',
    user: null,
    error: ''
  },
  online: {
    status: 'connecting',
    onlineCount: 0,
    chatMessages: []
  },
  social: {
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    incomingTradeRequests: [],
    outgoingTradeRequests: [],
    activeTrade: null,
    tradeHistory: []
  },
  shopRefreshAt: Date.now() + 30000,
  showStats: false,
  notifications: ['Добро пожаловать в Life Sim! Начни с работы и первой покупки.']
};

function normalizeSavedState(saved = {}) {
  return {
    ...cloneValue(defaultState),
    ...saved,
    ...extractGameState({ ...cloneValue(defaultState), ...saved }),
    socialSection: null,
    tradeModalOpen: false,
    friendModal: cloneValue(defaultState).friendModal,
    workSession: cloneValue(defaultState).workSession,
    caseOpening: cloneValue(defaultState).caseOpening,
    tradePicker: cloneValue(defaultState).tradePicker,
    online: cloneValue(defaultState).online,
    social: cloneValue(defaultState).social,
    auth: { ...cloneValue(defaultState).auth, ...(saved.auth || {}) },
    shopOffers: { ...cloneValue(defaultState).shopOffers, ...(saved.shopOffers || {}) }
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneValue(defaultState);
    return normalizeSavedState(JSON.parse(raw));
  } catch {
    return cloneValue(defaultState);
  }
}

export function saveState(state) {
  const persistedState = {
    ...state,
    socialSection: null,
    tradeModalOpen: false,
    friendModal: cloneValue(defaultState).friendModal,
    workSession: cloneValue(defaultState).workSession,
    caseOpening: cloneValue(defaultState).caseOpening,
    tradePicker: cloneValue(defaultState).tradePicker,
    online: undefined,
    social: undefined,
    auth: { token: state.auth.token, user: state.auth.user, error: '' }
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
}

export function extractGameState(state) {
  return {
    money: Number(state.money || 0),
    exp: Number(state.exp || 0),
    level: Number(state.level || 1),
    workClicks: Number(state.workClicks || 0),
    energy: Number(state.energy || 0),
    inventory: normalizeCollection(state.inventory),
    ownedCars: normalizeCollection(state.ownedCars),
    ownedProperty: normalizeCollection(state.ownedProperty),
    equipped: normalizeEquipped(state.equipped)
  };
}

export function applyGameState(state, gameState = {}) {
  const normalized = {
    ...createDefaultPlayerState(),
    ...gameState,
    inventory: normalizeCollection(gameState.inventory),
    ownedCars: normalizeCollection(gameState.ownedCars),
    ownedProperty: normalizeCollection(gameState.ownedProperty),
    equipped: normalizeEquipped(gameState.equipped)
  };

  Object.assign(state, normalized);
}

export function addNotification(state, message) {
  state.notifications = [message, ...state.notifications].slice(0, 4);
}

export function calculateLevel(exp) {
  return Math.floor(exp / 100) + 1;
}

export function getIncomeMultiplier(state) {
  return Object.values(state.equipped)
    .filter(Boolean)
    .reduce((sum, item) => sum + (item.stats.incomeBonus || 0), 1);
}

export function performWork(state) {
  if (state.energy <= 0) {
    addNotification(state, 'Нужен отдых: энергия на нуле.');
    return 0;
  }

  state.workClicks += 1;
  state.energy = Math.max(0, state.energy - 2);
  const income = Math.round((250 + state.level * 45) * getIncomeMultiplier(state));
  state.money += income;

  if (state.workClicks % 5 === 0) {
    state.exp += 20;
    state.level = calculateLevel(state.exp);
    addNotification(state, `Ты получил опыт за смену. Уровень: ${state.level}.`);
  } else {
    addNotification(state, `Работа выполнена. +$${income}.`);
  }

  return income;
}

export function restoreEnergy(state) {
  state.energy = 100;
  addNotification(state, 'Энергия восстановлена. Можно снова работать.');
  return true;
}

export function ensureFreshShop(state) {
  if (Date.now() < state.shopRefreshAt) return false;
  refreshShop(state);
  return true;
}

export function getExpProgress(state) {
  return state.exp % 100;
}

export function refreshShop(state) {
  state.shopOffers = {
    clothing: getRandomItems('clothing', 5),
    cars: getRandomItems('cars', 5),
    property: getRandomItems('property', 5)
  };
  state.shopRefreshAt = Date.now() + 30000;
  addNotification(state, 'В магазине новый завоз предметов.');
}

export function openCase(state, caseId) {
  const caseItem = caseCatalog.find((entry) => entry.id === caseId);
  if (!caseItem) return null;
  if (state.money < caseItem.price) {
    addNotification(state, `Недостаточно денег для открытия ${caseItem.name}.`);
    return null;
  }

  const rewards = getCaseRewards(caseId).map((item) => normalizeItem(item));
  if (!rewards.length) return null;

  const rewardIndex = 22;
  const strip = Array.from({ length: 28 }, () => {
    const sample = rewards[Math.floor(Math.random() * rewards.length)];
    return normalizeItem(sample);
  });
  const reward = normalizeItem(strip[rewardIndex]);

  state.money -= caseItem.price;
  state.ownedCars.unshift(reward);
  state.caseOpening = {
    open: true,
    caseId,
    reward,
    strip,
    offset: 0,
    reveal: false,
    spinning: false,
    rewardIndex
  };
  addNotification(state, `${caseItem.name}: тебе выпала ${reward.name}.`);
  return reward;
}

export function buyItem(state, itemId, category) {
  const offer = state.shopOffers[category].find((item) => item.id === itemId);
  if (!offer) return false;

  if (state.money < offer.price) {
    addNotification(state, `Недостаточно денег для покупки ${offer.name}.`);
    return false;
  }

  const ownedItem = normalizeItem(offer);
  state.money -= offer.price;

  if (category === 'clothing') state.inventory.push(ownedItem);
  if (category === 'cars') state.ownedCars.push(ownedItem);
  if (category === 'property') state.ownedProperty.push(ownedItem);

  state.shopOffers[category] = state.shopOffers[category].filter((item) => item.id !== itemId);
  addNotification(state, `${offer.name} теперь твой.`);
  return true;
}

export function equipItem(state, itemInstanceId) {
  const itemIndex = state.inventory.findIndex((entry) => entry.instanceId === itemInstanceId || entry.id === itemInstanceId);
  if (itemIndex === -1) return false;

  const [item] = state.inventory.splice(itemIndex, 1);
  const previousItem = state.equipped[item.slot];
  if (previousItem) state.inventory.unshift(previousItem);
  state.equipped[item.slot] = item;
  addNotification(state, `${item.name} экипирован.`);
  return true;
}

export function unequipItem(state, slotKey) {
  const equippedItem = state.equipped[slotKey];
  if (!equippedItem) return false;
  state.inventory.unshift(equippedItem);
  state.equipped[slotKey] = null;
  addNotification(state, `${equippedItem.name} снят.`);
  return true;
}

export function updateOnlineStatus(state, patch) {
  state.online = {
    ...state.online,
    ...patch,
    chatMessages: patch.chatMessages ?? state.online.chatMessages
  };
}

export function appendChatMessage(state, message) {
  state.online.chatMessages = [...state.online.chatMessages.slice(-29), message];
}

export function setAuth(state, authPatch) {
  state.auth = {
    ...state.auth,
    ...authPatch
  };
}

export function setSocialData(state, socialPatch) {
  state.social = {
    ...state.social,
    ...socialPatch
  };
}

export function resetSocialState(state) {
  state.social = cloneValue(defaultState).social;
  state.tradeModalOpen = false;
  state.friendModal = cloneValue(defaultState).friendModal;
  state.caseOpening = cloneValue(defaultState).caseOpening;
  state.tradePicker = cloneValue(defaultState).tradePicker;
  state.online.chatMessages = [];
}

export function openTradePicker(state, slotIndex) {
  state.tradePicker.slotIndex = Number.isInteger(slotIndex) ? slotIndex : null;
}

export function closeTradePicker(state) {
  state.tradePicker.slotIndex = null;
}

export function openWorkSession(state) {
  state.workSession = {
    open: true,
    deliveredThisShift: 0,
    shiftEarnings: 0,
    pendingDrop: false
  };
}

export function closeWorkSession(state) {
  state.workSession = {
    ...cloneValue(defaultState).workSession,
    open: false
  };
}

export function setWorkSessionPending(state, pending) {
  state.workSession.pendingDrop = Boolean(pending);
}

export function registerWorkDelivery(state) {
  const income = performWork(state);
  if (!income) return 0;

  state.workSession.deliveredThisShift += 1;
  state.workSession.shiftEarnings += income;
  state.workSession.pendingDrop = false;
  return income;
}

export function getTradeableItems(state) {
  return [
    ...state.inventory.map((item) => ({ ...item, collectionLabel: 'Рюкзак' })),
    ...state.ownedCars.map((item) => ({ ...item, collectionLabel: 'Гараж' })),
    ...state.ownedProperty.map((item) => ({ ...item, collectionLabel: 'Недвижимость' }))
  ];
}

export function getCollectionStats(state) {
  const allItems = [...state.inventory, ...Object.values(state.equipped).filter(Boolean), ...state.ownedCars, ...state.ownedProperty];
  const raritySummary = allItems.reduce((acc, item) => {
    acc[item.rarity] = (acc[item.rarity] || 0) + 1;
    return acc;
  }, {});

  return {
    wardrobe: state.inventory.length + Object.values(state.equipped).filter(Boolean).length,
    cars: state.ownedCars.length,
    property: state.ownedProperty.length,
    raritySummary,
    fullCatalog: {
      clothing: catalogs.clothing.length,
      cars: catalogs.cars.length,
      property: catalogs.property.length
    }
  };
}


export function openFriendModal(state, { mode = 'inventory', friend = null, gameState = null, messages = [] } = {}) {
  state.friendModal = {
    open: true,
    mode,
    friend,
    gameState,
    messages
  };
}

export function closeFriendModal(state) {
  state.friendModal = cloneValue(defaultState).friendModal;
}

export function setFriendModalMode(state, mode) {
  state.friendModal.mode = mode;
}

export function setFriendMessages(state, messages) {
  state.friendModal.messages = messages;
}

export function appendFriendMessage(state, message) {
  state.friendModal.messages = [...state.friendModal.messages, message].slice(-80);
}


export function updateCaseOpening(state, patch) {
  state.caseOpening = {
    ...state.caseOpening,
    ...patch
  };
}

export function closeCaseOpening(state) {
  state.caseOpening = cloneValue(defaultState).caseOpening;
}

export function setInventorySection(state, section) {
  state.inventorySection = ['clothing', 'cars', 'property'].includes(section) ? section : 'clothing';
}
