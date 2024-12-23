import { StyleSheet, Animated, View, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Linking } from 'react-native';

// Notification configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#007AFF',
  });
}

import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import WaterProgress from '../../components/WaterProgress';
import { WaterStorage, DayRecord } from '../../services/waterStorage';
import { EventEmitter } from '../../services/eventEmitter';
import i18n from '../../services/i18n';
import { LanguageService } from '@/services/languageService';
import { beverages, Beverage, getBeverageName } from '../../services/beverageTypes';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [waterIntake, setWaterIntake] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(2000);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const [todayRecords, setTodayRecords] = useState<DayRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const [selectedBeverage, setSelectedBeverage] = useState<Beverage>(beverages[0]);
  const [showBeverageModal, setShowBeverageModal] = useState(false);
  const [, setRefreshKey] = useState(0);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    loadTodayData();
    loadSettings();

    const handleSettingsChange = () => {
      loadTodayData();
      loadSettings();
      loadTodayRecords();
    };

    const handleWaterRecordChange = () => {
      loadTodayData();
      loadTodayRecords();
    };

    EventEmitter.on('settingsChanged', handleSettingsChange);
    EventEmitter.on('waterRecordChanged', handleWaterRecordChange);
    EventEmitter.on('dataImported', handleSettingsChange);

    return () => {
      EventEmitter.off('settingsChanged', handleSettingsChange);
      EventEmitter.off('waterRecordChanged', handleWaterRecordChange);
      EventEmitter.off('dataImported', handleSettingsChange);
    };
  }, []);

  useEffect(() => {
    LanguageService.initialize();
    
    const handleLanguageChange = () => {
      forceUpdate({});
    };
    
    EventEmitter.on('languageChanged', handleLanguageChange);
    return () => {
      EventEmitter.off('languageChanged', handleLanguageChange);
    };
  }, []);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const requestNotificationPermission = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert(
          i18n.t('permissionRequired'),
          i18n.t('enableNotificationsMessage'),
          [
            {
              text: i18n.t('cancel'),
              style: 'cancel'
            },
            {
              text: i18n.t('settings'),
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await WaterStorage.getSettings();
      setDailyGoal(settings.dailyGoal);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadTodayData = async () => {
    try {
      const todayRecord = await WaterStorage.getDayRecords(new Date());
      const settings = await WaterStorage.getSettings();
      setWaterIntake(todayRecord.totalIntake);
      setDailyGoal(settings.dailyGoal);
      const progress = todayRecord.totalIntake / settings.dailyGoal;
      progressAnimation.setValue(progress);
    } catch (error) {
      console.error('Error loading today data:', error);
    }
  };

  const loadTodayRecords = async () => {
    try {
      const records = await WaterStorage.getDayRecords(new Date());
      setTodayRecords(records);
    } catch (error) {
      console.error('Error loading today records:', error);
    }
  };

  const animateProgress = (toValue: number) => {
    progressAnimation.setValue(toValue);
  };

  const addWater = async (amount: number) => {
    try {
      await WaterStorage.addRecord(amount, selectedBeverage.id);
      const todayRecord = await WaterStorage.getDayRecords(new Date());
      const settings = await WaterStorage.getSettings();
      setWaterIntake(todayRecord.totalIntake);
      const progress = todayRecord.totalIntake / settings.dailyGoal;
      animateProgress(progress);
      EventEmitter.emit('waterRecordChanged');
    } catch (error) {
      console.error('Error adding water:', error);
    }
  };

  const handleCustomAmount = () => {
    Alert.prompt(
      i18n.t('customAmount'),
      i18n.t('enterAmount'),
      [
        {
          text: i18n.t('cancel'),
          style: 'cancel'
        },
        {
          text: i18n.t('add'),
          onPress: (amount) => {
            const numAmount = parseInt(amount || '0', 10);
            if (isNaN(numAmount) || numAmount <= 0) {
              Alert.alert(
                i18n.t('invalidAmount'),
                i18n.t('invalidAmountMessage')
              );
              return;
            }
            if (numAmount > 2000) {
              Alert.alert(
                i18n.t('warning'),
                i18n.t('tooMuchWater'),
                [
                  {
                    text: i18n.t('cancel'),
                    style: 'cancel'
                  },
                  {
                    text: i18n.t('yes'),
                    onPress: () => addWater(numAmount)
                  }
                ]
              );
              return;
            }
            addWater(numAmount);
          }
        }
      ],
      'plain-text',
      ''
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadTodayData();
      await loadTodayRecords();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.progressSection}>
          <WaterProgress 
            progress={progressAnimation}
          />
          <ThemedText style={styles.intakeText}>
            {waterIntake} / {dailyGoal} ml
          </ThemedText>
          <ThemedText style={styles.percentageText}>
            {Math.round((waterIntake / dailyGoal) * 100)}% {i18n.t('dailyGoal')}
          </ThemedText>
        </View>

        <View style={styles.quickAddSection}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              {i18n.t('addWater')}
            </ThemedText>
            <TouchableOpacity 
              onPress={() => setShowBeverageModal(true)}
              style={styles.beverageSelector}
            >
              <MaterialCommunityIcons 
                name={selectedBeverage.icon as any} 
                size={24} 
                color={selectedBeverage.color} 
              />
              <ThemedText style={[styles.beverageName, { color: selectedBeverage.color }]}>
                {getBeverageName(selectedBeverage)}
              </ThemedText>
              <MaterialCommunityIcons 
                name="chevron-down" 
                size={24} 
                color={selectedBeverage.color} 
              />
            </TouchableOpacity>
          </View>
          <View style={styles.buttonsGrid}>
            {[100, 200, 300, 400].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.addButton,
                  { backgroundColor: colorScheme === 'dark' ? `${selectedBeverage.color}33` : `${selectedBeverage.color}1A` }
                ]}
                onPress={() => addWater(amount)}
              >
                <MaterialCommunityIcons 
                  name={selectedBeverage.icon as any}
                  size={24} 
                  color={selectedBeverage.color}
                />
                <ThemedText style={[
                  styles.buttonText,
                  { color: selectedBeverage.color }
                ]}>
                  {amount}ml
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.customAddSection}>
          <TouchableOpacity 
            style={[
              styles.customAddButton,
              { backgroundColor: selectedBeverage.color }
            ]}
            onPress={handleCustomAmount}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
            <ThemedText style={styles.customAddText}>
              {i18n.t('customAmount')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showBeverageModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowBeverageModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1} 
            onPress={() => setShowBeverageModal(false)}
          >
            <ThemedView style={[styles.modalContent]}>
              <ThemedText style={styles.modalTitle}>{i18n.t('selectBeverage')}</ThemedText>
              {beverages.map((beverage) => (
                <TouchableOpacity
                  key={beverage.id}
                  style={[
                    styles.beverageOption,
                    { borderBottomColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                  ]}
                  onPress={() => {
                    setSelectedBeverage(beverage);
                    setShowBeverageModal(false);
                  }}
                >
                  <View style={styles.beverageOptionContent}>
                    <MaterialCommunityIcons 
                      name={beverage.icon as any} 
                      size={24} 
                      color={beverage.color} 
                    />
                    <ThemedText style={styles.beverageOptionText}>
                      {getBeverageName(beverage)}
                    </ThemedText>
                  </View>
                  {selectedBeverage.id === beverage.id && (
                    <MaterialCommunityIcons 
                      name="check" 
                      size={24} 
                      color={beverage.color} 
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ThemedView>
          </TouchableOpacity>
        </Modal>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  progressSection: {
    alignItems: 'center',
    paddingVertical: 0,
  },
  intakeText: {
    fontSize: 32,
    fontWeight: '700',
    paddingTop: 40,
  },
  percentageText: {
    fontSize: 16,
    opacity: 0.6,
    marginTop: 8,
  },
  quickAddSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  buttonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  addButton: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  customAddSection: {
    padding: 20,
    paddingTop: 0,
  },
  customAddButton: {
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  customAddText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  beverageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  beverageName: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  beverageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  beverageOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  beverageOptionText: {
    fontSize: 17,
    fontWeight: '500',
  },
});