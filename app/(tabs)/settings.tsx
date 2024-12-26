import { StyleSheet, Switch, Alert, Share, Linking, useColorScheme, View, Platform, ScrollView, Modal, TextInput, Text, TouchableOpacity as RNTouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { WaterStorage, WaterEntry } from '../../services/waterStorage';
import { TouchableOpacity } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { TimeIntervalTriggerInput } from 'expo-notifications';
import EventEmitter from 'eventemitter3';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as StoreReview from 'expo-store-review';
import { useTheme } from '../../contexts/ThemeContext';
import { LanguageService } from '../../services/languageService';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SupportedLanguages } from '../../translations/types';
import i18n from '../../services/i18n';
import { useLanguageContext } from '../../contexts/LanguageContext';
import { Picker } from '@react-native-picker/picker';
import { beverages, addCustomBeverage, removeCustomBeverage, beverageEventEmitter, Beverage, getBeverageName } from '../../services/beverageTypes';
import ChangeIcon from 'react-native-change-icon';

const eventEmitter = new EventEmitter();

type ColorScheme = 'light' | 'dark' | 'system';

const WEEK_START_DAYS = [
  { code: 'monday', name: () => i18n.t('monday') },
  { code: 'sunday', name: () => i18n.t('sunday') },
] as const;

const APP_ICONS = [
  { id: 'default', name: 'Default', icon: 'water' },
  { id: 'dark', name: 'Dark', icon: 'water-outline' },
  { id: 'pride', name: 'Pride', icon: 'pride' },
];

export default function SettingsScreen() {
  const { setLanguage } = useLanguageContext();
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [notifications, setNotifications] = useState(false);
  const [reminderInterval, setReminderInterval] = useState(2);
  const [dayResetTime, setDayResetTime] = useState('00:00');
  const { colorScheme, setColorScheme, currentTheme } = useTheme();
  const systemColorScheme = useColorScheme();
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguages>('en');
  const [showAddBeverage, setShowAddBeverage] = useState(false);
  const [newBeverageName, setNewBeverageName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('cup');
  const [selectedColor, setSelectedColor] = useState('#409CFF');
  const [customBeverages, setCustomBeverages] = useState<Beverage[]>([]);
  const [weekStartDay, setWeekStartDay] = useState<'monday' | 'sunday'>('monday');
  const [currentAppIcon, setCurrentAppIcon] = useState<string>('default');
  const [showIconModal, setShowIconModal] = useState(false);

  useEffect(() => {
    loadSettings();
    setSelectedLanguage(LanguageService.getLanguage());
    const loadBeverages = () => {
      const customs = beverages.filter(b => b.isCustom);
      setCustomBeverages(customs);
    };

    loadBeverages();
    beverageEventEmitter.on('beveragesChanged', loadBeverages);

    return () => {
      beverageEventEmitter.off('beveragesChanged', loadBeverages);
    };
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await WaterStorage.getSettings();
      setDailyGoal(settings.dailyGoal);
      setNotifications(settings.notifications ?? false);
      setReminderInterval(settings.reminderInterval);
      setColorScheme(settings.colorScheme || 'system');
      setDayResetTime(settings.dayResetTime);
      setWeekStartDay(settings.weekStartDay || 'monday');
      setCurrentAppIcon(settings.appIcon || 'default');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleDailyGoalChange = async () => {
    Alert.prompt(
      i18n.t('setDailyGoal'),
      i18n.t('enterDailyGoal'),
      [
        {
          text: i18n.t('cancel'),
          style: 'cancel',
        },
        {
          text: i18n.t('save'),
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
            i18n.t('permissionRequired'),
            i18n.t('enableNotificationsMessage'),
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
      i18n.t('setReminderInterval'),
      i18n.t('enterReminderInterval'),
      [
        {
          text: i18n.t('cancel'),
          style: 'cancel',
        },
        {
          text: i18n.t('save'),
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
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      // Get notification permission status
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      // Schedule notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t('timeToHydrate'),
          body: i18n.t('stayHydratedMessage'),
          sound: true,
          badge: 1,
        },
        trigger: {
          seconds: reminderInterval * 3600,
          repeats: true,
          type: 'timeInterval'
        } as TimeIntervalTriggerInput,
      });

      // Save notification settings
      await WaterStorage.updateSettings({ 
        notifications: true,
        reminderInterval 
      });
    } catch (error) {
      console.error('Error scheduling notifications:', error);
    }
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

        // Validate custom beverages if present
        if (data.customBeverages && !Array.isArray(data.customBeverages)) {
          throw new Error('Invalid custom beverages format');
        }

        const normalizedData = {
          settings: {
            dailyGoal: Number(data.settings.dailyGoal) || 2000,
            notifications: Boolean(data.settings.notifications),
            reminderInterval: Number(data.settings.reminderInterval) || 2,
            useCups: Boolean(data.settings.useCups),
            showWeeklyStats: Boolean(data.settings.showWeeklyStats),
            dayResetTime: data.settings.dayResetTime || '00:00',
            weekStartDay: data.settings.weekStartDay || 'monday',
          },
          entries: data.entries.map((entry: {
            date: string;
            records: Array<{
              id?: string;
              amount: number;
              timestamp: number;
              note?: string;
              beverageType?: string;
            }>;
            totalIntake: number;
            goal: number;
          }) => ({
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
          })),
          customBeverages: Array.isArray(data.customBeverages) ? data.customBeverages.map((beverage: Partial<Beverage>) => ({
            id: beverage.id || Date.now().toString(),
            name: beverage.name || '',
            icon: beverage.icon || 'cup-water',
            color: beverage.color || '#409CFF',
            isCustom: true
          })) : []
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
      i18n.t('resetConfirmation'),
      i18n.t('resetConfirmationMessage'),
      [
        {
          text: i18n.t('cancel'),
          style: 'cancel'
        },
        {
          text: i18n.t('reset'),
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

  const handleLanguageChange = async (languageCode: SupportedLanguages) => {
    await setLanguage(languageCode);
    setSelectedLanguage(languageCode);
  };

  const handleAddBeverage = async () => {
    if (!newBeverageName.trim()) {
      Alert.alert(i18n.t('error'), i18n.t('beverageNameRequired'));
      return;
    }

    try {
      await addCustomBeverage({
        id: Date.now().toString(),
        name: newBeverageName.trim(),
        icon: selectedIcon,
        color: selectedColor,
      });

      setShowAddBeverage(false);
      setNewBeverageName('');
      setSelectedIcon('cup');
      setSelectedColor('#409CFF');
    } catch (error) {
      Alert.alert(i18n.t('error'), i18n.t('errorAddingBeverage'));
    }
  };

  const handleDeleteBeverage = (beverage: Beverage) => {
    Alert.alert(
      i18n.t('deleteBeverage'),
      i18n.t('deleteBeverageConfirm', { name: beverage.name }),
      [
        {
          text: i18n.t('cancel'),
          style: 'cancel',
        },
        {
          text: i18n.t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCustomBeverage(beverage.id);
            } catch (error) {
              Alert.alert(i18n.t('error'), i18n.t('errorDeletingBeverage'));
            }
          },
        },
      ]
    );
  };

  const handleDayResetTimeChange = async () => {
    Alert.prompt(
      i18n.t('setDayResetTime'),
      i18n.t('enterDayResetTime'),
      [
        {
          text: i18n.t('cancel'),
          style: 'cancel',
        },
        {
          text: i18n.t('save'),
          onPress: async (value) => {
            if (value) {
              // Validate time format (HH:mm)
              const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
              if (timeRegex.test(value)) {
                try {
                  await WaterStorage.updateSettings({ dayResetTime: value });
                  setDayResetTime(value);
                } catch (error) {
                  console.error('Error updating day reset time:', error);
                }
              } else {
                Alert.alert(i18n.t('error'), i18n.t('invalidTimeFormat'));
              }
            }
          },
        },
      ],
      'plain-text',
      dayResetTime
    );
  };

  const handleWeekStartDayChange = async (newStartDay: 'monday' | 'sunday') => {
    try {
      await WaterStorage.updateSettings({ weekStartDay: newStartDay });
      setWeekStartDay(newStartDay);
      eventEmitter.emit('settingsChanged');
    } catch (error) {
      console.error('Error updating week start day:', error);
    }
  };

  const handleChangeAppIcon = async (iconId: string) => {
    try {
      if (Platform.OS === 'ios') {
        await ChangeIcon.changeIcon(iconId);
        await WaterStorage.updateSettings({ appIcon: iconId });
        setCurrentAppIcon(iconId);
        setShowIconModal(false);
      } else {
        Alert.alert(
          i18n.t('notSupported'),
          i18n.t('featureOnlyAvailableOniOS')
        );
      }
    } catch (error) {
      console.error('Error changing app icon:', error);
      Alert.alert(
        i18n.t('error'),
        i18n.t('errorChangingIcon')
      );
    }
  };

  const availableIcons = [
    'cup', 
    'bottle-soda', 
    'beer', 
    'glass-wine', 
    'glass-mug', 
    'coffee', 
    'tea', 
    'cup-water',
    'bottle-wine',
    'glass-cocktail',
    'bottle-tonic',
    'bottle-tonic-plus',
    'bottle-tonic-skull',
    'coffee-outline',
    'tea-outline',
    'water',
    'water-outline',
    'fruit-citrus',
    'food-apple',
    'fruit-watermelon',
    'fruit-grapes',
    'bottle-soda-classic',
    'cup-outline'
  ];

  const availableColors = [
    '#409CFF', 
    '#8B4513', 
    '#6F4E37', 
    '#FFA500', 
    '#FF4500', 
    '#32CD32', 
    '#9370DB', 
    '#FF69B4', 
    '#20B2AA', 
    '#FFD700', 
    '#FF6347', 
    '#4B0082', 
    '#00CED1', 
    '#FF1493', 
    '#1E90FF', 
    '#98FB98', 
    '#DDA0DD', 
    '#F08080', 
    '#E6E6FA', 
    '#7B68EE'  
  ];

  return (
    <ScrollView style={{
      backgroundColor: currentTheme === 'dark' ? '#000000' : '#FFFFFF',
    }}>
      <ThemedView style={styles.container}>
        <ThemedText style={styles.headerTitle}>{i18n.t('settings')}</ThemedText>


        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>{i18n.t('customBeverages')}</ThemedText>
          
          <RNTouchableOpacity
            style={[styles.settingRow, {
              backgroundColor: currentTheme === 'dark' ? 'rgba(0,122,255,0.1)' : 'rgba(0,122,255,0.05)',
              borderRadius: 12,
              padding: 12,
            }]}
            onPress={() => setShowAddBeverage(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="plus" size={24} color="#007AFF" />
              <ThemedText style={{ marginLeft: 8, fontSize: 16 }}>{i18n.t('addBeverage')}</ThemedText>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#007AFF" />
          </RNTouchableOpacity>

          {customBeverages.map((beverage) => (
            <View key={beverage.id} style={[styles.settingRow, {
              backgroundColor: currentTheme === 'dark' ? 'rgba(0,122,255,0.05)' : 'rgba(0,122,255,0.02)',
              borderRadius: 12,
              padding: 12,
              marginTop: 8,
            }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name={beverage.icon as any} size={24} color={beverage.color} />
                <ThemedText style={{ marginLeft: 12, fontSize: 16 }}>{getBeverageName(beverage)}</ThemedText>
              </View>
              <RNTouchableOpacity onPress={() => handleDeleteBeverage(beverage)}>
                <MaterialCommunityIcons name="delete" size={24} color="rgba(255,59,48,0.8)" />
              </RNTouchableOpacity>
            </View>
          ))}
        </ThemedView>


        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>{i18n.t('language')}</ThemedText>
          {Platform.OS === 'ios' ? (
            <RNTouchableOpacity 
              onPress={() => {
                const languages = LanguageService.getSupportedLanguages();
                Alert.alert(
                  i18n.t('language'),
                  '',
                  [
                    ...languages.map(({ code, name }) => ({
                      text: name,
                      onPress: () => handleLanguageChange(code),
                      style: 'default' as const
                    })),
                    {
                      text: i18n.t('cancel'),
                      style: 'cancel' as const,
                    },
                  ]
                );
              }}
              style={[styles.languageButton, {
                backgroundColor: currentTheme === 'dark' ? '#2C2C2E' : '#FFFFFF',
              }]}
            >
              <ThemedText>{LanguageService.getSupportedLanguages().find(l => l.code === selectedLanguage)?.name}</ThemedText>
              <MaterialCommunityIcons
                name="chevron-down"
                size={24}
                color={currentTheme === 'dark' ? '#FFFFFF' : '#000000'}
              />
            </RNTouchableOpacity>
          ) : (
            <View style={[styles.pickerContainer, {
              backgroundColor: currentTheme === 'dark' ? '#2C2C2E' : '#FFFFFF',
            }]}>
              <Picker
                selectedValue={selectedLanguage}
                onValueChange={handleLanguageChange}
                style={[styles.picker, {
                  color: currentTheme === 'dark' ? '#FFFFFF' : '#000000',
                }]}
                dropdownIconColor={currentTheme === 'dark' ? '#FFFFFF' : '#000000'}
              >
                {LanguageService.getSupportedLanguages().map(({ code, name }) => (
                  <Picker.Item 
                    key={code} 
                    label={name} 
                    value={code}
                    color={currentTheme === 'dark' ? '#FFFFFF' : '#000000'}
                  />
                ))}
              </Picker>
            </View>
          )}
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>{i18n.t('weekStartDay')}</ThemedText>
          {Platform.OS === 'ios' ? (
            <RNTouchableOpacity 
              onPress={() => {
                Alert.alert(
                  i18n.t('weekStartDay'),
                  '',
                  [
                    ...WEEK_START_DAYS.map(({ code, name }) => ({
                      text: name(),
                      onPress: () => handleWeekStartDayChange(code),
                      style: 'default' as const
                    })),
                    {
                      text: i18n.t('cancel'),
                      style: 'cancel' as const,
                    },
                  ]
                );
              }}
              style={[styles.languageButton, {
                backgroundColor: currentTheme === 'dark' ? '#2C2C2E' : '#FFFFFF',
              }]}
            >
              <ThemedText>{WEEK_START_DAYS.find(d => d.code === weekStartDay)?.name()}</ThemedText>
              <MaterialCommunityIcons
                name="chevron-down"
                size={24}
                color={currentTheme === 'dark' ? '#FFFFFF' : '#000000'}
              />
            </RNTouchableOpacity>
          ) : (
            <View style={[styles.pickerContainer, {
              backgroundColor: currentTheme === 'dark' ? '#2C2C2E' : '#FFFFFF',
            }]}>
              <Picker
                selectedValue={weekStartDay}
                onValueChange={handleWeekStartDayChange}
                style={[styles.picker, {
                  color: currentTheme === 'dark' ? '#FFFFFF' : '#000000',
                }]}
                dropdownIconColor={currentTheme === 'dark' ? '#FFFFFF' : '#000000'}
              >
                {WEEK_START_DAYS.map(({ code, name }) => (
                  <Picker.Item 
                    key={code} 
                    label={name()} 
                    value={code}
                    color={currentTheme === 'dark' ? '#FFFFFF' : '#000000'}
                  />
                ))}
              </Picker>
            </View>
          )}
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>{i18n.t('dailyGoal')}</ThemedText>
          <RNTouchableOpacity onPress={handleDailyGoalChange}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>{i18n.t('targetWaterIntake')}</ThemedText>
              <ThemedText style={styles.value}>{dailyGoal}ml</ThemedText>
            </ThemedView>
          </RNTouchableOpacity>
          <RNTouchableOpacity onPress={handleDayResetTimeChange}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>{i18n.t('dayResetTime')}</ThemedText>
              <ThemedText style={styles.value}>{dayResetTime}</ThemedText>
            </ThemedView>
          </RNTouchableOpacity>
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>{i18n.t('notifications')}</ThemedText>
          <ThemedView style={styles.settingRow}>
            <ThemedText>{i18n.t('enableReminders')}</ThemedText>
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
            <RNTouchableOpacity onPress={handleIntervalChange}>
              <ThemedView style={styles.settingRow}>
                <ThemedText>{i18n.t('reminderInterval')}</ThemedText>
                <ThemedText style={styles.value}>{reminderInterval}h</ThemedText>
              </ThemedView>
            </RNTouchableOpacity>
          )}
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>{i18n.t('appearance')}</ThemedText>
          <RNTouchableOpacity onPress={() => handleColorSchemeChange('light')}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>{i18n.t('lightMode')}</ThemedText>
              {colorScheme === 'light' && <ThemedText style={styles.value}>✓</ThemedText>}
            </ThemedView>
          </RNTouchableOpacity>
          <RNTouchableOpacity onPress={() => handleColorSchemeChange('dark')}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>{i18n.t('darkMode')}</ThemedText>
              {colorScheme === 'dark' && <ThemedText style={styles.value}>✓</ThemedText>}
            </ThemedView>
          </RNTouchableOpacity>
          <RNTouchableOpacity onPress={() => handleColorSchemeChange('system')}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>{i18n.t('useSystemSetting')}</ThemedText>
              {colorScheme === 'system' && <ThemedText style={styles.value}>✓</ThemedText>}
            </ThemedView>
          </RNTouchableOpacity>
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>{i18n.t('dataManagement')}</ThemedText>
          <RNTouchableOpacity onPress={handleExportData}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>{i18n.t('exportData')}</ThemedText>
              <ThemedText style={styles.value}>→</ThemedText>
            </ThemedView>
          </RNTouchableOpacity>
          <RNTouchableOpacity onPress={handleImportData}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>{i18n.t('importData')}</ThemedText>
              <ThemedText style={styles.value}>→</ThemedText>
            </ThemedView>
          </RNTouchableOpacity>
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>{i18n.t('support')}</ThemedText>
          <RNTouchableOpacity onPress={handleRateApp}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>{i18n.t('rateOurApp')}</ThemedText>
              <ThemedText style={styles.value}>⭐️</ThemedText>
            </ThemedView>
          </RNTouchableOpacity>
          <RNTouchableOpacity onPress={handleContactSupport}>
            <ThemedView style={styles.settingRow}>
              <ThemedText>{i18n.t('contactSupport')}</ThemedText>
              <ThemedText style={styles.value}>📧</ThemedText>
            </ThemedView>
          </RNTouchableOpacity>
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>{i18n.t('about')}</ThemedText>
          <ThemedText style={styles.version}>{i18n.t('appVersion', { version: '1.0.0' })}</ThemedText>
        </ThemedView>

        <ThemedView style={[styles.section, {
          backgroundColor: currentTheme === 'dark' ? '#1C1C1E' : '#F2F2F7',
        }]}>
          <ThemedText style={styles.sectionTitle}>{i18n.t('dangerZone')}</ThemedText>
          <RNTouchableOpacity onPress={handleResetData}>
            <ThemedView style={[styles.settingRow, styles.resetButton]}>
              <ThemedText style={styles.resetText}>{i18n.t('resetAllData')}</ThemedText>
              <ThemedText style={styles.resetText}>🗑️</ThemedText>
            </ThemedView>
          </RNTouchableOpacity>
        </ThemedView>

        {Platform.OS === 'ios' && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{i18n.t('appIcon')}</ThemedText>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => setShowIconModal(true)}
            >
              <View style={styles.settingContent}>
                <MaterialCommunityIcons
                  name={APP_ICONS.find(icon => icon.id === currentAppIcon)?.icon || 'water'}
                  size={24}
                  color="#007AFF"
                />
                <ThemedText style={styles.settingText}>
                  {APP_ICONS.find(icon => icon.id === currentAppIcon)?.name || 'Default'}
                </ThemedText>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="gray" />
            </TouchableOpacity>
          </View>
        )}

        <Modal
          visible={showAddBeverage}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddBeverage(false)}>
          <RNTouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowAddBeverage(false)}
          >
            <View style={[styles.modalContainer, { backgroundColor: 'transparent' }]}>
              <ThemedView style={styles.modalContent}>
                <ThemedText style={styles.modalTitle}>{i18n.t('addNewBeverage')}</ThemedText>
                
                <TextInput
                  style={[styles.input, {
                    borderColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    color: currentTheme === 'dark' ? '#FFFFFF' : '#000000',
                    backgroundColor: currentTheme === 'dark' ? '#2C2C2E' : '#FFFFFF',
                  }]}
                  value={newBeverageName}
                  onChangeText={setNewBeverageName}
                  placeholder={i18n.t('beverageName')}
                  placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                />

                <ThemedText style={styles.label}>{i18n.t('selectIcon')}</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconList}>
                  {availableIcons.map((icon) => (
                    <RNTouchableOpacity
                      key={icon}
                      style={[
                        styles.iconOption,
                        selectedIcon === icon && styles.selectedIcon,
                        {
                          backgroundColor: selectedIcon === icon 
                            ? '#007AFF'
                            : currentTheme === 'dark' ? '#2C2C2E' : '#FFFFFF',
                          borderColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.2)' : '#007AFF',
                        }
                      ]}
                      onPress={() => setSelectedIcon(icon)}>
                      <MaterialCommunityIcons 
                        name={icon as any} 
                        size={24} 
                        color={selectedIcon === icon ? '#FFFFFF' : '#007AFF'} 
                      />
                    </RNTouchableOpacity>
                  ))}
                </ScrollView>

                <ThemedText style={styles.label}>{i18n.t('selectColor')}</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorList}>
                  {availableColors.map((color) => (
                    <RNTouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        selectedColor === color && styles.selectedColor,
                        {
                          borderColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                        }
                      ]}
                      onPress={() => setSelectedColor(color)}
                    />
                  ))}
                </ScrollView>

                <View style={styles.modalButtons}>
                  <RNTouchableOpacity
                    style={[styles.modalButton, { backgroundColor: currentTheme === 'dark' ? '#2C2C2E' : '#E5E5EA' }]}
                    onPress={() => setShowAddBeverage(false)}>
                    <Text style={{ color: currentTheme === 'dark' ? '#FFFFFF' : '#000000', fontSize: 16, fontWeight: '600' }}>
                      {i18n.t('cancel')}
                    </Text>
                  </RNTouchableOpacity>
                  <RNTouchableOpacity
                    style={[styles.modalButton, { backgroundColor: '#007AFF' }]}
                    onPress={handleAddBeverage}>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                      {i18n.t('add')}
                    </Text>
                  </RNTouchableOpacity>
                </View>
              </ThemedView>
            </View>
          </RNTouchableOpacity>
        </Modal>

        <Modal
          visible={showIconModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowIconModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1} 
            onPress={() => setShowIconModal(false)}
          >
            <ThemedView style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>{i18n.t('selectAppIcon')}</ThemedText>
              {APP_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon.id}
                  style={styles.iconOption}
                  onPress={() => handleChangeAppIcon(icon.id)}
                >
                  <View style={styles.iconOptionContent}>
                    <MaterialCommunityIcons 
                      name={icon.icon} 
                      size={24} 
                      color="#007AFF" 
                    />
                    <ThemedText style={styles.iconOptionText}>
                      {icon.name}
                    </ThemedText>
                  </View>
                  {currentAppIcon === icon.id && (
                    <MaterialCommunityIcons 
                      name="check" 
                      size={24} 
                      color="#007AFF" 
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ThemedView>
          </TouchableOpacity>
        </Modal>
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
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  pickerContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  picker: {
    width: '100%',
    height: 50,
  },
  languageButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 12,
    marginBottom: 16,
  },
  addButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  beverageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(0,122,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
  },
  beverageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  beverageName: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    padding: 20,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  iconList: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  selectedIcon: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  iconOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconOptionText: {
    fontSize: 17,
    fontWeight: '500',
  },
  colorList: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  selectedColor: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    marginTop: 8,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
  },
}); 