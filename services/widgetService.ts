import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const WIDGET_DATA_KEY = '@widget_data';
const isExpoGo = Constants.appOwnership === 'expo';

export interface WidgetData {
  totalIntake: number;
  dailyGoal: number;
  lastUpdate: string;
  percentage: number;
}

export class WidgetService {
  static async updateWidgetData(totalIntake: number, dailyGoal: number): Promise<void> {
    try {
      const widgetData: WidgetData = {
        totalIntake,
        dailyGoal,
        lastUpdate: new Date().toISOString(),
        percentage: Math.round((totalIntake / dailyGoal) * 100),
      };

      // In Expo Go, only use AsyncStorage
      if (isExpoGo) {
        await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(widgetData));
        return;
      }

      // In production builds, try to use native widget storage
      if (Platform.OS === 'ios') {
        const SharedGroupPreferences = require('react-native-shared-group-preferences').default;
        const GROUP_IDENTIFIER = 'group.com.drinktrack.widget';
        await SharedGroupPreferences.setItem('widgetData', widgetData, GROUP_IDENTIFIER);
      } else if (Platform.OS === 'android' && NativeModules.SharedStorage) {
        await NativeModules.SharedStorage.set('widgetData', JSON.stringify(widgetData));
      }

      // Always save to AsyncStorage as backup
      await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(widgetData));
    } catch (error) {
      // In development, just log the error and continue
      if (isExpoGo) {
        console.log('Widget data saved to AsyncStorage only (Expo development)');
      } else {
        console.error('Error updating widget data:', error);
      }
    }
  }

  static async getWidgetData(): Promise<WidgetData | null> {
    try {
      // In Expo Go, only use AsyncStorage
      if (isExpoGo) {
        const data = await AsyncStorage.getItem(WIDGET_DATA_KEY);
        return data ? JSON.parse(data) : null;
      }

      // In production builds, try to use native widget storage first
      let data = null;
      if (Platform.OS === 'ios') {
        const SharedGroupPreferences = require('react-native-shared-group-preferences').default;
        const GROUP_IDENTIFIER = 'group.com.drinktrack.widget';
        data = await SharedGroupPreferences.getItem('widgetData', GROUP_IDENTIFIER);
      } else if (Platform.OS === 'android' && NativeModules.SharedStorage) {
        data = await new Promise((resolve) => {
          NativeModules.SharedStorage.get('widgetData', resolve);
        });
      }

      if (data) {
        return typeof data === 'string' ? JSON.parse(data) : data;
      }

      // Fallback to AsyncStorage
      const asyncData = await AsyncStorage.getItem(WIDGET_DATA_KEY);
      return asyncData ? JSON.parse(asyncData) : null;
    } catch (error) {
      // In development, just log the error and try AsyncStorage
      if (isExpoGo) {
        const data = await AsyncStorage.getItem(WIDGET_DATA_KEY);
        return data ? JSON.parse(data) : null;
      }
      console.error('Error getting widget data:', error);
      return null;
    }
  }
} 