import AsyncStorage from '@react-native-async-storage/async-storage';
import EventEmitter from 'eventemitter3';

export interface WaterRecord {
  id: string;
  amount: number;
  timestamp: number;
  note?: string;
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
}

interface ExportedData {
  settings: Settings;
  entries: WaterEntry[];
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
  };

  async addRecord(amount: number, note?: string): Promise<WaterRecord> {
    const record: WaterRecord = {
      id: Date.now().toString(),
      amount,
      timestamp: Date.now(),
      note,
    };

    try {
      const history = await this.getDayRecords(new Date());
      history.records.push(record);
      history.totalIntake += amount;
      
      await this.saveDayRecord(history);
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
      }
    } catch (error) {
      console.error('Error removing water record:', error);
      throw error;
    }
  }

  async getDayRecords(date: Date): Promise<DayRecord> {
    const dateStr = this.formatDate(date);
    try {
      const stored = await AsyncStorage.getItem(`${this.STORAGE_KEY}_${dateStr}`);
      const settings = await this.getSettings();
      
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Sadece istenen gün için yeni kayıt oluştur
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
      // Get all keys from AsyncStorage that start with STORAGE_KEY
      const allKeys = await AsyncStorage.getAllKeys();
      const historyKeys = allKeys.filter(key => key.startsWith(this.STORAGE_KEY));
      
      // Get all stored records
      const records = await AsyncStorage.multiGet(historyKeys);
      
      // Parse and sort records by date (newest first)
      const history: DayRecord[] = records
        .map(([_, value]) => JSON.parse(value!))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    try {
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(newSettings));
      return newSettings;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  async exportData(): Promise<ExportedData> {
    try {
      const settings = await this.getSettings();
      const entries = await this.getEntries();
      return {
        settings,
        entries
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
            note: record.note || ''
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