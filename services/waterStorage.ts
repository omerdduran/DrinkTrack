import AsyncStorage from '@react-native-async-storage/async-storage';
import EventEmitter from 'eventemitter3';
import { beverages, beverageEventEmitter, Beverage } from './beverageTypes';
import { WidgetService } from './widgetService';

export interface WaterRecord {
  id: string;
  amount: number;
  timestamp: number;
  note?: string;
  beverageType: string;
}

export interface DayRecord {
  date: string;
  records: WaterRecord[];
  totalIntake: number;
  goal: number;
}

export interface WaterEntry {
  date: string;
  records: WaterRecord[];
  totalIntake: number;
  goal: number;
}

interface Settings {
  dailyGoal: number;
  notifications: boolean;
  reminderInterval: number;
  useCups: boolean;
  showWeeklyStats: boolean;
  colorScheme?: 'light' | 'dark' | 'system';
  dayResetTime: string;
  weekStartDay: 'monday' | 'sunday';
}

interface ExportedData {
  settings: Settings;
  entries: WaterEntry[];
  customBeverages: Beverage[];
}

const eventEmitter = new EventEmitter();

class WaterStorageService {
  private STORAGE_KEY = 'water_history';
  private SETTINGS_KEY = 'water_settings';
  private ENTRIES_KEY = 'water_entries';

  private defaultSettings: Settings = {
    dailyGoal: 2000,
    notifications: true,
    reminderInterval: 2,
    useCups: false,
    showWeeklyStats: true,
    dayResetTime: '00:00',
    weekStartDay: 'monday',
  };

  async addRecord(amount: number, beverageType: string = 'water', note?: string): Promise<WaterRecord> {
    const now = new Date();
    const record: WaterRecord = {
      id: now.getTime().toString(),
      amount: amount,
      timestamp: now.getTime(),
      note,
      beverageType,
    };

    try {
      const history = await this.getDayRecords(now);
      history.records.push(record);
      history.totalIntake += amount;
      
      await this.saveDayRecord(history);
      const settings = await this.getSettings();
      await WidgetService.updateWidgetData(history.totalIntake, settings.dailyGoal);
      return record;
    } catch (error) {
      console.error('Error adding water record:', error);
      throw error;
    }
  }

  async removeRecord(recordId: string, date?: string): Promise<void> {
    try {
      const targetDate = date ? new Date(date) : new Date();
      const history = await this.getDayRecords(targetDate);
      const recordIndex = history.records.findIndex(r => r.id === recordId);
      
      if (recordIndex !== -1) {
        const record = history.records[recordIndex];
        history.totalIntake -= record.amount;
        history.records.splice(recordIndex, 1);
        await this.saveDayRecord(history);
        const settings = await this.getSettings();
        await WidgetService.updateWidgetData(history.totalIntake, settings.dailyGoal);
      }
    } catch (error) {
      console.error('Error removing water record:', error);
      throw error;
    }
  }

  async getDayRecords(date: Date): Promise<DayRecord> {
    try {
      const settings = await this.getSettings();
      const dayResetTime = settings.dayResetTime || '00:00';
      const [hours, minutes] = dayResetTime.split(':').map(Number);
      
      // Create a date object for today's reset time
      const resetTime = new Date(date);
      resetTime.setHours(hours, minutes, 0, 0);
      
      // Get the current time
      const currentTime = new Date(date);
      currentTime.setMilliseconds(0);
      currentTime.setSeconds(0);
      
      // If the current time is before today's reset time, use yesterday
      let targetDate = new Date(date);
      if (currentTime.getTime() <= resetTime.getTime()) {
        targetDate.setDate(date.getDate() - 1);
      }
      
      const dateStr = this.formatDate(targetDate);
      const stored = await AsyncStorage.getItem(`${this.STORAGE_KEY}_${dateStr}`);
      
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Create new record for the requested day
      return {
        date: dateStr,
        records: [],
        totalIntake: 0,
        goal: settings.dailyGoal,
      };
    } catch (error) {
      console.error('Error getting day records:', error);
      throw error;
    }
  }

  async getAllHistory(): Promise<DayRecord[]> {
    try {
      // Get settings for day reset time
      const settings = await this.getSettings();
      const dayResetTime = settings.dayResetTime || '00:00';
      const [hours, minutes] = dayResetTime.split(':').map(Number);

      // Get current time and reset time
      const now = new Date();
      const resetTime = new Date(now);
      resetTime.setHours(hours, minutes, 0, 0);

      // Get all keys from AsyncStorage that start with STORAGE_KEY
      const allKeys = await AsyncStorage.getAllKeys();
      const historyKeys = allKeys.filter(key => key.startsWith(this.STORAGE_KEY));
      
      // Get all stored records
      const records = await AsyncStorage.multiGet(historyKeys);
      
      // Parse and sort records by date (newest first)
      const history: DayRecord[] = records
        .map(([_, value]) => JSON.parse(value!))
        .sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB.getTime() - dateA.getTime();
        });

      // If current time is before reset time, adjust the display date
      if (now < resetTime) {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = this.formatDate(yesterday);
        const todayStr = this.formatDate(now);

        // Find and adjust today's records if they exist
        const todayIndex = history.findIndex(record => record.date === todayStr);
        if (todayIndex !== -1) {
          history[todayIndex].date = yesterdayStr;
        }
      }

      return history;
    } catch (error) {
      console.error('Error getting history:', error);
      throw error;
    }
  }

  private async saveDayRecord(record: DayRecord): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${this.STORAGE_KEY}_${record.date}`,
        JSON.stringify(record)
      );
    } catch (error) {
      console.error('Error saving day record:', error);
      throw error;
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  async getSettings(): Promise<Settings> {
    try {
      const stored = await AsyncStorage.getItem(this.SETTINGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return this.defaultSettings;
    } catch (error) {
      console.error('Error getting settings:', error);
      return this.defaultSettings;
    }
  }

  async updateSettings(settings: Partial<Settings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(updatedSettings));
      
      // Update widget data with new settings
      const today = new Date();
      const dayRecord = await this.getDayRecords(today);
      await WidgetService.updateWidgetData(dayRecord.totalIntake, updatedSettings.dailyGoal);
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  async exportData(): Promise<ExportedData> {
    try {
      const settings = await this.getSettings();
      const entries = await this.getEntries();
      const stored = await AsyncStorage.getItem('custom_beverages');
      const customBeverages = stored ? JSON.parse(stored) : [];
      
      return {
        settings,
        entries,
        customBeverages
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async importData(data: ExportedData): Promise<void> {
    try {
      // Validate the imported data structure
      if (!data.settings || !data.entries) {
        throw new Error('Invalid data format');
      }

      // Import settings
      await this.updateSettings(data.settings);

      // Import custom beverages if they exist
      if (Array.isArray(data.customBeverages)) {
        await AsyncStorage.setItem('custom_beverages', JSON.stringify(data.customBeverages));
        beverageEventEmitter.emit('beveragesChanged');
      }

      // Clear existing records for the dates we're importing
      const dates = data.entries.map(entry => entry.date);
      for (const date of dates) {
        await AsyncStorage.removeItem(`${this.STORAGE_KEY}_${date}`);
      }

      // Import entries
      for (const entry of data.entries) {
        // Ensure the entry has all required fields
        const validEntry: DayRecord = {
          date: entry.date,
          records: Array.isArray(entry.records) ? entry.records.map(record => ({
            id: record.id || Date.now().toString(),
            amount: Number(record.amount) || 0,
            timestamp: Number(record.timestamp) || Date.now(),
            note: record.note || '',
            beverageType: record.beverageType || 'water'
          })) : [],
          totalIntake: Number(entry.totalIntake) || 0,
          goal: Number(entry.goal) || data.settings.dailyGoal
        };
        await this.saveDayRecord(validEntry);
      }

      // Use the eventEmitter instance
      eventEmitter.emit('dataImported');
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  async getEntries(): Promise<WaterEntry[]> {
    try {
      return await this.getAllHistory();
    } catch (error) {
      console.error('Error getting entries:', error);
      throw error;
    }
  }

  // Add method to subscribe to events
  public on(event: string, callback: (...args: any[]) => void) {
    eventEmitter.on(event, callback);
  }

  public off(event: string, callback: (...args: any[]) => void) {
    eventEmitter.off(event, callback);
  }

  async resetAllData(): Promise<void> {
    try {
      // Get all keys from AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      
      // Filter keys that belong to our app
      const appKeys = keys.filter(key => 
        key.startsWith(this.STORAGE_KEY) || 
        key === this.SETTINGS_KEY || 
        key === this.ENTRIES_KEY
      );
      
      // Remove all data
      await AsyncStorage.multiRemove(appKeys);
      
      // Reset settings to default
      await this.updateSettings(this.defaultSettings);
      
      // Emit event for UI update
      eventEmitter.emit('dataImported');
    } catch (error) {
      console.error('Error resetting data:', error);
      throw error;
    }
  }
}

export const WaterStorage = new WaterStorageService(); 