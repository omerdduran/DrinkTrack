import { StyleSheet, Animated, View, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';

import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import WaterProgress from '../../components/WaterProgress';
import { WaterStorage, DayRecord } from '../../services/waterStorage';
import { EventEmitter } from '../../services/eventEmitter';
import i18n from '../../services/i18n';
import { LanguageService } from '@/services/languageService';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [waterIntake, setWaterIntake] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(2000);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const [todayRecords, setTodayRecords] = useState<DayRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const [, setRefreshKey] = useState(0);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    loadTodayData();
    loadSettings();

    const handleSettingsChange = async (settings: any) => {
      if (settings.dailyGoal) {
        setDailyGoal(settings.dailyGoal);
        animateProgress(waterIntake / settings.dailyGoal);
      }
    };

    const handleWaterRecordChange = () => {
      loadTodayData();
    };

    EventEmitter.on('settingsChanged', handleSettingsChange);
    EventEmitter.on('waterRecordChanged', handleWaterRecordChange);

    return () => {
      EventEmitter.off('settingsChanged', handleSettingsChange);
      EventEmitter.off('waterRecordChanged', handleWaterRecordChange);
    };
  }, [waterIntake]);

  useEffect(() => {
    loadTodayRecords();
    
    const handleDataImported = () => {
      loadTodayRecords();
    };
    
    const handleSettingsChanged = () => {
      loadTodayRecords();
    };
    
    EventEmitter.on('dataImported', handleDataImported);
    EventEmitter.on('settingsChanged', handleSettingsChanged);
    
    return () => {
      EventEmitter.off('dataImported', handleDataImported);
      EventEmitter.off('settingsChanged', handleSettingsChanged);
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
      setWaterIntake(todayRecord.totalIntake);
      const settings = await WaterStorage.getSettings();
      animateProgress(todayRecord.totalIntake / settings.dailyGoal);
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
    Animated.spring(progressAnimation, {
      toValue,
      useNativeDriver: true,
      damping: 15,
      stiffness: 100,
    }).start();
  };

  const addWater = async (amount: number) => {
    try {
      await WaterStorage.addRecord(amount);
      loadTodayData();
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
      <View style={styles.content} >
        <View style={styles.progressSection}>
          <WaterProgress progress={progressAnimation} />
          <ThemedText style={styles.intakeText}>
            {waterIntake} / {dailyGoal} ml
          </ThemedText>
          <ThemedText style={styles.percentageText}>
            {Math.round((waterIntake / dailyGoal) * 100)}% {i18n.t('dailyGoal')}
          </ThemedText>
        </View>

        <View style={styles.quickAddSection}>
          <ThemedText style={styles.sectionTitle}>
            {i18n.t('addWater')}
          </ThemedText>
          <View style={styles.buttonsGrid}>
            {[100, 200, 300, 400].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.addButton,
                  { backgroundColor: colorScheme === 'dark' ? 'rgba(64,156,255,0.2)' : 'rgba(0,122,255,0.1)' }
                ]}
                onPress={() => addWater(amount)}
              >
                <MaterialCommunityIcons 
                  name="water" 
                  size={24} 
                  color={colorScheme === 'dark' ? '#409CFF' : '#007AFF'} 
                />
                <ThemedText style={[
                  styles.buttonText,
                  { color: colorScheme === 'dark' ? '#409CFF' : '#007AFF' }
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
              { backgroundColor: colorScheme === 'dark' ? '#409CFF' : '#007AFF' }
            ]}
            onPress={handleCustomAmount}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
            <ThemedText style={styles.customAddText}>
              {i18n.t('customAmount')}
            </ThemedText>
          </TouchableOpacity>
        </View>
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
});