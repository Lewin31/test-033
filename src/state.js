import { getRandomItems, catalogs } from './data.js';

const STORAGE_KEY = 'life-sim-save-v1';

const defaultState = {
  money: 15000,
  exp: 0,
  level: 1,
  workClicks: 0,
  energy: 100,
  activeTab: 'shop',
  shopCategory: null,
  socialSection: null,
  inventory: [],
  ownedCars: [],
  ownedProperty: [],
  equipped: {
    head: null,
    torso: null,
    legs: null,
    feet: null,
    accessory: null
  },
  shopOffers: {
    clothing: getRandomItems('clothing', 5),
    cars: getRandomItems('cars', 5),
    property: getRandomItems('property', 5)
  },
  online: {
    status: 'connecting',
    onlineCount: 0,
    chatMessages: []
  },
  shopRefreshAt: Date.now() + 30000,
  showStats: false,
  notifications: ['Добро пожаловать в Life Sim! Начни с работы и первой покупки.']
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const saved = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...saved,
      socialSection: null,
      online: structuredClone(defaultState).online,
      equipped: { ...structuredClone(defaultState).equipped, ...(saved.equipped || {}) },
      shopOffers: { ...structuredClone(defaultState).shopOffers, ...(saved.shopOffers || {}) }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

export function saveState(state) {
  const persistedState = {
    ...state,
    socialSection: null,
    online: undefined
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
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
    return;
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
}

export function restoreEnergy(state) {
  state.energy = 100;
  addNotification(state, 'Энергия восстановлена. Можно снова работать.');
}

export function ensureFreshShop(state) {
  if (Date.now() < state.shopRefreshAt) return false;
  refreshShop(state);
  return true;
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

export function buyItem(state, itemId, category) {
  const offer = state.shopOffers[category].find((item) => item.id === itemId);
  if (!offer) return;

  if (state.money < offer.price) {
    addNotification(state, `Недостаточно денег для покупки ${offer.name}.`);
    return;
  }

  state.money -= offer.price;

  if (category === 'clothing') state.inventory.push(offer);
  if (category === 'cars') state.ownedCars.push(offer);
  if (category === 'property') state.ownedProperty.push(offer);

  state.shopOffers[category] = state.shopOffers[category].filter((item) => item.id !== itemId);
  addNotification(state, `${offer.name} теперь твой.`);
}

export function equipItem(state, itemId) {
  const itemIndex = state.inventory.findIndex((entry) => entry.id === itemId);
  if (itemIndex === -1) return;

  const [item] = state.inventory.splice(itemIndex, 1);
  const previousItem = state.equipped[item.slot];

  if (previousItem) state.inventory.unshift(previousItem);

  state.equipped[item.slot] = item;
  addNotification(state, `${item.name} экипирован.`);
}

export function unequipItem(state, slotKey) {
  const equippedItem = state.equipped[slotKey];
  if (!equippedItem) return;

  state.inventory.unshift(equippedItem);
  state.equipped[slotKey] = null;
  addNotification(state, `${equippedItem.name} снят.`);
}

export function updateOnlineStatus(state, patch) {
  state.online = {
    ...state.online,
    ...patch,
    chatMessages: patch.chatMessages ?? state.online.chatMessages
  };
}

export function appendChatMessage(state, message) {
  state.online.chatMessages = [...state.online.chatMessages.slice(-19), message];
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
