export const rarityMap = {
  common: { label: 'Обычный', color: '#7f8ea3', glow: 'rgba(127, 142, 163, 0.35)' },
  uncommon: { label: 'Редкий', color: '#48c774', glow: 'rgba(72, 199, 116, 0.35)' },
  rare: { label: 'Эпический', color: '#4f7cff', glow: 'rgba(79, 124, 255, 0.35)' },
  epic: { label: 'Легендарный', color: '#a855f7', glow: 'rgba(168, 85, 247, 0.38)' },
  mythic: { label: 'Мифический', color: '#ff9f43', glow: 'rgba(255, 159, 67, 0.4)' }
};

export const categoryMeta = {
  clothing: { label: 'Бутик одежды', icon: '🛍️', description: 'Одежда и аксессуары для персонажа' },
  cars: { label: 'Автосалон', icon: '🚗', description: 'Машины для скорости и престижа' },
  property: { label: 'Недвижимость', icon: '🏠', description: 'Дома, квартиры и элитные объекты' }
};

const clothingPrefixes = ['Городская', 'Неоновая', 'Премиальная', 'Уличная', 'Ночная', 'Зимняя', 'Скоростная', 'Клубная', 'Деловая', 'Люксовая'];
const clothingTypes = ['куртка', 'футболка', 'худи', 'рубашка', 'пальто', 'кепка', 'кроссовки', 'джинсы', 'ботинки', 'часы'];
const clothingSlotIcons = {
  head: ['🧢', '🎩'],
  torso: ['👕', '🧥'],
  legs: ['👖'],
  feet: ['👟', '🥾'],
  accessory: ['⌚', '💍']
};
const carBrands = ['Lada', 'Toyota', 'BMW', 'Mercedes', 'Audi', 'Honda', 'Nissan', 'Hyundai', 'Porsche', 'Ford'];
const carModels = ['Spark', 'Nova', 'Pulse', 'Drift', 'Eclipse', 'Titan', 'Falcon', 'Storm', 'Vision', 'Prime'];
const carIcons = ['🚗', '🚘', '🚙', '🏎️'];
const propertyPrefixes = ['Уютная', 'Современная', 'Элитная', 'Панорамная', 'Загородная', 'Центральная', 'Клубная', 'Семейная', 'Тихая', 'Престижная'];
const propertyTypes = ['студия', 'квартира', 'дача', 'таунхаус', 'дом', 'пентхаус', 'вилла', 'лофт', 'коттедж', 'резиденция'];
const propertyIcons = ['🏠', '🏡', '🏢', '🏘️'];
const equipmentSlots = ['head', 'torso', 'legs', 'feet', 'accessory'];

function rarityByIndex(index) {
  if (index % 19 === 0) return 'mythic';
  if (index % 11 === 0) return 'epic';
  if (index % 7 === 0) return 'rare';
  if (index % 3 === 0) return 'uncommon';
  return 'common';
}

function priceByRarity(base, rarity) {
  const multipliers = { common: 1, uncommon: 1.35, rare: 1.8, epic: 2.5, mythic: 3.4 };
  return Math.round(base * multipliers[rarity]);
}

function clothingIconForSlot(slot, index) {
  const icons = clothingSlotIcons[slot];
  return icons[index % icons.length];
}

export const clothingCatalog = Array.from({ length: 100 }, (_, index) => {
  const rarity = rarityByIndex(index + 1);
  const prefix = clothingPrefixes[index % clothingPrefixes.length];
  const type = clothingTypes[index % clothingTypes.length];
  const slot = equipmentSlots[index % equipmentSlots.length];

  return {
    id: `cloth-${index + 1}`,
    category: 'clothing',
    icon: clothingIconForSlot(slot, index),
    name: `${prefix} ${type} ${index + 1}`,
    rarity,
    price: priceByRarity(1200 + index * 55, rarity),
    slot,
    stats: {
      style: 2 + (index % 8),
      comfort: 1 + (index % 6),
      incomeBonus: Number((0.01 * ((index % 5) + 1)).toFixed(2))
    }
  };
});

export const carCatalog = Array.from({ length: 50 }, (_, index) => {
  const rarity = rarityByIndex(index + 5);
  return {
    id: `car-${index + 1}`,
    category: 'cars',
    icon: carIcons[index % carIcons.length],
    name: `${carBrands[index % carBrands.length]} ${carModels[index % carModels.length]} ${index + 1}`,
    rarity,
    price: priceByRarity(18000 + index * 3500, rarity),
    stats: {
      speed: 120 + index * 4,
      comfort: 3 + (index % 7),
      prestige: 2 + (index % 9)
    }
  };
});

export const propertyCatalog = Array.from({ length: 20 }, (_, index) => {
  const rarity = rarityByIndex(index + 2);
  return {
    id: `property-${index + 1}`,
    category: 'property',
    icon: propertyIcons[index % propertyIcons.length],
    name: `${propertyPrefixes[index % propertyPrefixes.length]} ${propertyTypes[index % propertyTypes.length]} ${index + 1}`,
    rarity,
    price: priceByRarity(55000 + index * 15000, rarity),
    stats: {
      capacity: 2 + index,
      prestige: 4 + (index % 10),
      passiveIncome: 120 + index * 35
    }
  };
});

export const catalogs = {
  clothing: clothingCatalog,
  cars: carCatalog,
  property: propertyCatalog
};

export function getRandomItems(category, count) {
  const pool = [...catalogs[category]];
  const result = [];

  while (result.length < count && pool.length) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(randomIndex, 1)[0]);
  }

  return result;
}


const caseThemes = [
  ['turbo', 'Турбо-кейс', '🏁'],
  ['street', 'Street-кейс', '🛞'],
  ['track', 'Трек-кейс', '🏎️'],
  ['retro', 'Ретро-кейс', '📼'],
  ['drift', 'Дрифт-кейс', '💨'],
  ['muscle', 'Muscle-кейс', '💪'],
  ['import', 'Import-кейс', '🌃'],
  ['night', 'Ночной кейс', '🌙'],
  ['garage', 'Гаражный кейс', '🧰'],
  ['chrome', 'Chrome-кейс', '✨'],
  ['legend', 'Legend-кейс', '👑'],
  ['sport', 'Sport-кейс', '⚡'],
  ['premium', 'Premium-кейс', '💎'],
  ['nitro', 'Nitro-кейс', '🔥'],
  ['rally', 'Rally-кейс', '🗺️'],
  ['monster', 'Monster-кейс', '🦾'],
  ['midnight', 'Midnight-кейс', '🌌'],
  ['urban', 'Urban-кейс', '🏙️'],
  ['velocity', 'Velocity-кейс', '🚀'],
  ['diamond', 'Diamond-кейс', '💠']
];

export const caseCatalog = caseThemes.map(([id, name, icon], index) => ({
  id: `case-${id}`,
  icon,
  name,
  rarity: index > 16 ? 'mythic' : index > 12 ? 'epic' : index > 7 ? 'rare' : index > 3 ? 'uncommon' : 'common',
  price: 4500 + index * 2200,
  rewardCount: 4 + (index % 4),
  description: `Автомобильный кейс с ${4 + (index % 4)} возможными машинами.`
}));

export function getCaseRewards(caseId) {
  const index = caseCatalog.findIndex((entry) => entry.id === caseId);
  if (index === -1) return [];

  const start = (index * 2) % Math.max(1, carCatalog.length - 8);
  return carCatalog.slice(start, start + 8);
}
