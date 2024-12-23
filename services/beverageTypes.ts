import i18n from './i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventEmitter from 'eventemitter3';

export interface Beverage {
  id: string;
  name: string | (() => string);
  icon: string;
  color: string;
  isCustom?: boolean;
}

const CUSTOM_BEVERAGES_KEY = 'custom_beverages';
export const beverageEventEmitter = new EventEmitter();

export const defaultBeverages: Beverage[] = [
  {
    id: 'water',
    get name() { return i18n.t('water') },
    icon: 'cup-water',
    color: '#409CFF'
  },
  {
    id: 'tea',
    get name() { return i18n.t('tea') },
    icon: 'tea',
    color: '#9370DB'
  },
  {
    id: 'coffee',
    get name() { return i18n.t('coffee') },
    icon: 'coffee',
    color: '#6F4E37'
  },
  {
    id: 'juice',
    get name() { return i18n.t('juice') },
    icon: 'bottle-soda',
    color: '#FFA500'
  }
];

export let beverages: Beverage[] = [...defaultBeverages];

export const loadCustomBeverages = async () => {
  try {
    const stored = await AsyncStorage.getItem(CUSTOM_BEVERAGES_KEY);
    const customBeverages = stored ? JSON.parse(stored) : [];
    beverages = [...defaultBeverages, ...customBeverages];
    return customBeverages;
  } catch (error) {
    console.error('Error loading custom beverages:', error);
    return [];
  }
};

export const addCustomBeverage = async (beverage: Omit<Beverage, 'isCustom'>) => {
  try {
    const stored = await AsyncStorage.getItem(CUSTOM_BEVERAGES_KEY);
    const customBeverages = stored ? JSON.parse(stored) : [];
    
    const newBeverage = { ...beverage, isCustom: true };
    customBeverages.push(newBeverage);
    
    await AsyncStorage.setItem(CUSTOM_BEVERAGES_KEY, JSON.stringify(customBeverages));
    beverages = [...defaultBeverages, ...customBeverages];
    
    beverageEventEmitter.emit('beveragesChanged');
    return newBeverage;
  } catch (error) {
    console.error('Error adding custom beverage:', error);
    throw error;
  }
};

export const removeCustomBeverage = async (id: string) => {
  try {
    const stored = await AsyncStorage.getItem(CUSTOM_BEVERAGES_KEY);
    let customBeverages = stored ? JSON.parse(stored) : [];
    
    customBeverages = customBeverages.filter((b: Beverage) => b.id !== id);
    await AsyncStorage.setItem(CUSTOM_BEVERAGES_KEY, JSON.stringify(customBeverages));
    
    beverages = [...defaultBeverages, ...customBeverages];
    beverageEventEmitter.emit('beveragesChanged');
  } catch (error) {
    console.error('Error removing custom beverage:', error);
    throw error;
  }
};

// Helper function to get beverage name
export const getBeverageName = (beverage: Beverage): string => {
  if (typeof beverage.name === 'function') {
    return beverage.name();
  }
  return beverage.name;
};

// Initialize custom beverages
loadCustomBeverages(); 