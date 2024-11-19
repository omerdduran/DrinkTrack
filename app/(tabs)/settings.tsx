import { StyleSheet, Switch, Alert, Share, Linking, useColorScheme } from 'react-native';
import { useState, useEffect } from 'react';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { ScrollView } from 'react-native-gesture-handler';
import { WaterStorage } from '../../services/waterStorage';
import { TouchableOpacity } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import EventEmitter from 'eventemitter3';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as StoreReview from 'expo-store-review';
import { useTheme } from '../../contexts/ThemeContext';

const eventEmitter = new EventEmitter();

type ColorScheme = 'light' | 'dark' | 'system';

export default function SettingsScreen() {
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [notifications, setNotifications] = useState(false);
  const [reminderInterval, setReminderInterval] = useState(2);
  const { colorScheme, setColorScheme, currentTheme } = useTheme();
  const systemColorScheme = useColorScheme();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await WaterStorage.getSettings();
      setDailyGoal(settings.dailyGoal);
      setNotifications(settings.notifications ?? false);
      setReminderInterval(settings.reminderInterval);
      setColorScheme(settings.colorScheme || 'system');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleDailyGoalChange = async () => {
    Alert.prompt(
      'Set Daily Goal',
      'Enter your daily water intake goal in milliliters (ml)',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Save',
          onPress: async (value) => {
            if (value) {
              const newGoal = parseInt(value);
              if (newGoal > 0) {
                try {
                  await WaterStorage.updateSettings({ dailyGoal: newGoal });
                  setDailyGoal(newGoal);
                  eventEmitter.emit('settingsChanged', { dailyGoal: newGoal });
                } catch (error) {
                  console.error('Error updating daily goal:', error);
                }
              }
            }
          },
        },
      ],
      'plain-text',
      dailyGoal.toString()
    );
  };

  const handleNotificationToggle = async (value: boolean) => {
    try {
      if (value) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings to receive reminders.'
          );
          return;
        }
      }

      await WaterStorage.updateSettings({ notifications: value });
      setNotifications(value);

      if (value) {
        scheduleNotifications();
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    }
  };

  const handleIntervalChange = async () => {
    Alert.prompt(
      'Set Reminder Interval',
      'Enter reminder interval in hours (1-12)',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Save',
          onPress: async (value) => {
            if (value) {
              const newInterval = parseInt(value);
              if (newInterval >= 1 && newInterval <= 12) {
                try {
                  await WaterStorage.updateSettings({ reminderInterval: newInterval });
                  setReminderInterval(newInterval);
                  if (notifications) {
                    scheduleNotifications();
                  }
                } catch (error) {
                  console.error('Error updating interval:', error);
                }
              }
            }
          },
        },
      ],
      'plain-text',
      reminderInterval.toString()
    );
  };

  const scheduleNotifications = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time to drink water! 💧",
        body: "Stay hydrated for better health!",
      },
      trigger: {
        seconds: reminderInterval * 3600,
        repeats: true,
        channelId: 'default'
      } as any,
    });
  };

  const handleExportData = async () => {
    try {
      const data = await WaterStorage.exportData();
      const jsonString = JSON.stringify(data, null, 2); // Pretty print JSON
      
      const fileName = `water_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      // Write to temporary file
      await FileSystem.writeAsStringAsync(fileUri, jsonString, {
        encoding: FileSystem.EncodingType.UTF8
      });

      await Share.share({
        url: fileUri,
        title: 'Water Tracker Data Export',
      }, {
        dialogTitle: 'Export Water Tracker Data',
      });

      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', 'Failed to export data');
    }
  };

  // Import data function
  const handleImportData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json'
      });
      
      if (result.assets && result.assets[0]) {
        const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
        const data = JSON.parse(fileContent);
        
        console.log('Imported data:', data);
        
        // Validate the imported data structure
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid data format');
        }

        // Check for required properties in the imported data
        const requiredProperties = ['entries', 'settings'];
        for (const prop of requiredProperties) {
          if (!(prop in data)) {
            throw new Error(`Missing required property: ${prop}`);
          }
        }

        // Validate settings object
        if (!data.settings || typeof data.settings !== 'object') {
          throw new Error('Invalid settings format');
        }

        // Validate entries array
        if (!Array.isArray(data.entries)) {
          throw new Error('Invalid entries format');
        }

        // Normalize the data before importing
        const normalizedData = {
          settings: {
            dailyGoal: Number(data.settings.dailyGoal) || 2000,
            notifications: Boolean(data.settings.notifications),
            reminderInterval: Number(data.settings.reminderInterval) || 2,
            useCups: Boolean(data.settings.useCups),
            showWeeklyStats: Boolean(data.settings.showWeeklyStats)
          },
          entries: data.entries.map((entry: { 
            date: string;
            records: Array<{
              id?: string;
              amount: number;
              timestamp: number;
              note?: string;
            }>;
            totalIntake: number;
            goal: number;
          }) => ({
            date: entry.date,
            records: Array.isArray(entry.records) ? entry.records.map(record => ({
              id: record.id || Date.now().toString(),
              amount: Number(record.amount) || 0,
              timestamp: Number(record.timestamp) || Date.now(),
              note: record.note || ''
            })) : [],
            totalIntake: Number(entry.totalIntake) || 0,
            goal: Number(entry.goal) || data.settings.dailyGoal
          }))
        };

        await WaterStorage.importData(normalizedData);
        Alert.alert('Success', 'Data imported successfully');
        loadSettings();
        eventEmitter.emit('dataImported');
      }
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert(
        'Import Error',
        error instanceof SyntaxError 
          ? 'Invalid JSON file format' 
          : error instanceof Error 
            ? error.message 
            : 'Failed to import data'
      );
    }
  };


  const handleTipJar = () => {

  };


  const handleRateApp = async () => {
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
    } else {
      Linking.openURL('https://github.com/omerdduran/DrinkTrack');
    }
  };

  const handleContactSupport = () => {
    Linking.openURL('https://github.com/omerdduran/DrinkTrack/issues');
  };


  const handleResetData = () => {
    Alert.alert(
      'Reset All Data',
      'Are you sure you want to reset all data? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await WaterStorage.resetAllData();
              loadSettings();
              eventEmitter.emit('dataImported');
              Alert.alert('Success', 'All data has been reset');
            } catch (error) {
              console.error('Reset error:', error);
              Alert.alert('Error', 'Failed to reset data');
            }
          }
        }
      ]
    );
  };

  const handleColorSchemeChange = async (newScheme: ColorScheme) => {
    try {
      await setColorScheme(newScheme);
      eventEmitter.emit('settingsChanged', { colorScheme: newScheme });
    } catch (error) {
      console.error('Error updating color scheme:', error);
    }
  };

  return (
    <ScrollView style={{
      backgroundColor: currentTheme === 'dark' ? '#000000' : '#FFFFFF',
    }}>
      <ThemedView style={styles.container}>
        <ThemedText style={styles.headerTitle}>Settings</ThemedText>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>Daily Goal</ThemedText>
          <TouchableOpacity onPress={handleDailyGoalChange}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>Target Water Intake</ThemedText>
              <ThemedText style={styles.value}>{dailyGoal}ml</ThemedText>
            </ThemedView>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>Notifications</ThemedText>
          <ThemedView style={styles.settingRow}>
            <ThemedText>Enable Reminders</ThemedText>
            <Switch
              value={notifications}
              onValueChange={handleNotificationToggle}
              trackColor={{ 
                false: colorScheme === 'dark' ? '#3A3A3C' : '#E9E9EB', 
                true: '#34C759'
              }}
              thumbColor={notifications 
                ? '#FFFFFF'
                : colorScheme === 'dark' ? '#FFFFFF' : '#FFFFFF'
              }
            />
          </ThemedView>
          {notifications && (
            <TouchableOpacity onPress={handleIntervalChange}>
              <ThemedView style={styles.settingRow}>
                <ThemedText>Reminder Interval</ThemedText>
                <ThemedText style={styles.value}>{reminderInterval}h</ThemedText>
              </ThemedView>
            </TouchableOpacity>
          )}
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>Appearance</ThemedText>
          <TouchableOpacity onPress={() => handleColorSchemeChange('light')}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>Light Mode</ThemedText>
              {colorScheme === 'light' && <ThemedText style={styles.value}>✓</ThemedText>}
            </ThemedView>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleColorSchemeChange('dark')}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>Dark Mode</ThemedText>
              {colorScheme === 'dark' && <ThemedText style={styles.value}>✓</ThemedText>}
            </ThemedView>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleColorSchemeChange('system')}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>Use System Setting</ThemedText>
              {colorScheme === 'system' && <ThemedText style={styles.value}>✓</ThemedText>}
            </ThemedView>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>Data Management</ThemedText>
          <TouchableOpacity onPress={handleExportData}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>Export Data</ThemedText>
              <ThemedText style={styles.value}>→</ThemedText>
            </ThemedView>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleImportData}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>Import Data</ThemedText>
              <ThemedText style={styles.value}>→</ThemedText>
            </ThemedView>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>Support</ThemedText>
          <TouchableOpacity onPress={handleRateApp}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>Rate Our App</ThemedText>
              <ThemedText style={styles.value}>⭐️</ThemedText>
            </ThemedView>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleContactSupport}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>Contact Support</ThemedText>
              <ThemedText style={styles.value}>📧</ThemedText>
            </ThemedView>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>About</ThemedText>
          <ThemedText style={styles.version}>DrinkTrack v1.0.0</ThemedText>
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>Danger Zone</ThemedText>
          <TouchableOpacity onPress={handleResetData}>
            <ThemedView style={[styles.settingRow, styles.resetButton]}>
              <ThemedText style={styles.resetText}>Reset All Data</ThemedText>
              <ThemedText style={styles.resetText}>🗑️</ThemedText>
            </ThemedView>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.41,
    marginBottom: 20,
    paddingTop: 20,
  },
  section: {
    padding: 20,
    marginBottom: 16,
    borderRadius: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  value: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0A84FF',
  },
  version: {
    opacity: 0.6,
  },
  resetButton: {
    backgroundColor: '#FF453A',
    borderRadius: 8,
    padding: 12,
    borderWidth: 0,
  },
  resetText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  hint: {
    fontSize: 14,
    opacity: 0.6,
    fontStyle: 'italic',
    marginTop: 8,
  },
}); 