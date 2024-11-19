import { StyleSheet, Alert, TouchableOpacity, ScrollView, Dimensions, Animated, Platform, View } from 'react-native';
import { useEffect, useState, useMemo } from 'react';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { WaterStorage, DayRecord, WaterRecord } from '../../services/waterStorage';
import { Ionicons } from '@expo/vector-icons';
import { EventEmitter } from '../../services/eventEmitter';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import DateTimePicker from '@react-native-community/datetimepicker';
import React from 'react';
import { BarChart } from "react-native-chart-kit";
import { RefreshControl } from 'react-native';

export default function HistoryScreen() {
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadRecords();
    
    const handleWaterRecordChange = () => {
      loadRecords();
    };
    
    EventEmitter.on('waterRecordChanged', handleWaterRecordChange);
    
    return () => {
      EventEmitter.off('waterRecordChanged', handleWaterRecordChange);
    };
  }, []);

  const loadRecords = async () => {
    try {
      const allRecords = await WaterStorage.getAllHistory();
      setRecords(allRecords);
    } catch (error) {
      console.error('Error loading records:', error);
    }
  };

  const handleDeleteRecord = async (dayRecord: DayRecord, record: WaterRecord) => {
    Alert.alert(
      'Delete Record',
      `Are you sure you want to delete ${record.amount}ml record?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await WaterStorage.removeRecord(record.id, dayRecord.date);
              loadRecords(); // Reload history after deletion
              EventEmitter.emit('waterRecordChanged');
            } catch (error) {
              console.error('Error deleting record:', error);
            }
          },
        },
      ]
    );
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 1) return '#4CAF50';
    if (percentage >= 0.7) return '#007AFF';
    return '#FF9500';
  };

  const calculateStats = () => {
    if (records.length === 0) return null;

    const avgIntake = records.reduce((sum, day) => sum + day.totalIntake, 0) / records.length;
    const maxDay = records.reduce((max, day) => 
      day.totalIntake > max.totalIntake ? day : max, records[0]);
    const minDay = records.reduce((min, day) => 
      day.totalIntake < min.totalIntake ? day : min, records[0]);

    return { avgIntake, maxDay, minDay };
  };

  const calculateWeeklyAverage = () => {
    if (records.length === 0) return [];
    
    const weeklyData: { week: string; average: number }[] = [];
    const groupedByWeek = records.reduce((acc, day) => {
      const date = new Date(day.date);
      const week = `${date.getFullYear()}-W${Math.ceil((date.getDate() + date.getDay()) / 7)}`;
      
      if (!acc[week]) {
        acc[week] = { total: 0, count: 0 };
      }
      acc[week].total += day.totalIntake;
      acc[week].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    Object.entries(groupedByWeek).forEach(([week, data]) => {
      weeklyData.push({
        week,
        average: Math.round(data.total / data.count)
      });
    });

    return weeklyData.slice(-4); 
  };

  const calculateHourlyDistribution = () => {
    const hourlyData = new Array(24).fill(0);
    
    records.forEach(day => {
      day.records.forEach(record => {
        const hour = new Date(record.timestamp).getHours();
        hourlyData[hour] += record.amount;
      });
    });

    return hourlyData;
  };

  const getFilteredRecords = () => {
    let filtered = [...records];
    const now = new Date();

    switch (selectedPeriod) {
      case 'today':
        filtered = filtered.filter(record => 
          new Date(record.date).toDateString() === now.toDateString()
        );
        break;
      case 'week':
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        filtered = filtered.filter(record => 
          new Date(record.date) >= weekAgo
        );
        break;
      case 'month':
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        filtered = filtered.filter(record => 
          new Date(record.date) >= monthAgo
        );
        break;
    }
    return filtered;
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadRecords();
    setIsRefreshing(false);
  };

  const filteredRecords = useMemo(() => getFilteredRecords(), [records, selectedPeriod]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="rgba(0,122,255,0.8)"
          />
        }
      >
        <ThemedView style={styles.periodSelector}>
          {['today', 'week', 'month', 'all'].map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period as 'today' | 'week' | 'month' | 'all')}>
              <ThemedText style={[
                styles.periodButtonText,
                selectedPeriod === period && styles.periodButtonTextActive
              ]}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>

        <ThemedView style={styles.summaryCard}>
          <ThemedText style={styles.summaryTitle}>
            {selectedPeriod === 'today' ? "Today's Summary" : 
             selectedPeriod === 'week' ? "This Week's Summary" :
             selectedPeriod === 'month' ? "This Month's Summary" : "Overall Summary"}
          </ThemedText>
          <View style={styles.summaryContent}>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryValue}>
                {filteredRecords.length > 0 
                  ? `${filteredRecords.reduce((sum, day) => sum + day.totalIntake, 0)}ml`
                  : '0ml'}
              </ThemedText>
              <ThemedText style={styles.summaryLabel}>Total Intake</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryValue}>
                {filteredRecords.length > 0 
                  ? `${Math.round(filteredRecords.reduce((sum, day) => sum + day.totalIntake, 0) / 
                      filteredRecords.length)}ml`
                  : '0ml'}
              </ThemedText>
              <ThemedText style={styles.summaryLabel}>Daily Average</ThemedText>
            </View>
          </View>
        </ThemedView>

        {filteredRecords.length > 0 ? (
          filteredRecords.map((dayRecord) => (
            <Animated.View key={dayRecord.date}>
              <ThemedView style={styles.dayCard}>
                <View style={styles.dateContainer}>
                  <ThemedText style={styles.dateTitle}>
                    {new Date(dayRecord.date).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </ThemedText>
                  <ThemedText style={[styles.percentage, { color: getProgressColor(dayRecord.totalIntake / dayRecord.goal) }]}>
                    {Math.round((dayRecord.totalIntake / dayRecord.goal) * 100)}%
                  </ThemedText>
                </View>

                <View style={styles.progressContainer}>
                  <ThemedView style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(dayRecord.totalIntake / dayRecord.goal * 100, 100)}%`,
                          backgroundColor: getProgressColor(dayRecord.totalIntake / dayRecord.goal),
                        },
                      ]}
                    />
                  </ThemedView>
                  <ThemedText style={styles.progressText}>
                    {dayRecord.totalIntake}ml / {dayRecord.goal}ml
                  </ThemedText>
                </View>

                <View style={styles.recordsList}>
                  {dayRecord.records.map((record) => (
                    <TouchableOpacity
                      key={record.id}
                      style={styles.recordItem}
                      onPress={() => handleDeleteRecord(dayRecord, record)}>
                      <View style={styles.recordInfo}>
                        <MaterialCommunityIcons name="water" size={20} color="rgba(0,122,255,0.8)" />
                        <ThemedText style={styles.recordAmount}>+{record.amount}ml</ThemedText>
                        <ThemedText style={styles.recordTime}>{formatTime(record.timestamp)}</ThemedText>
                      </View>
                      <Ionicons name="trash-outline" size={20} color="rgba(255,59,48,0.8)" />
                    </TouchableOpacity>
                  ))}
                </View>
              </ThemedView>
            </Animated.View>
          ))
        ) : (
          <ThemedView style={styles.emptyState}>
            <MaterialCommunityIcons name="water-off" size={48} color="rgba(0,122,255,0.8)" />
            <ThemedText style={styles.emptyStateText}>
              No records found for this period
            </ThemedText>
            <ThemedText style={styles.emptyStateSubtext}>
              Start tracking your water intake to see your progress!
            </ThemedText>
          </ThemedView>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
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
  dayCard: {
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0,122,255,0.1)',
    marginBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  percentage: {
    fontSize: 17,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 15,
    opacity: 0.6,
  },
  recordsList: {
    gap: 8,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(0,122,255,0.05)',
    borderRadius: 12,
  },
  recordInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordAmount: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  recordTime: {
    fontSize: 15,
    opacity: 0.6,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 15,
    opacity: 0.6,
    textAlign: 'center',
  },
  filterContainer: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterButton: {
    padding: 8,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 8,
  },
  statsContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  viewModeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: 'rgba(0,122,255,0.1)',
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  viewModeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  viewModeButtonActive: {
    backgroundColor: '#007AFF',
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  weeklyContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  weeklyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  weeklyAverage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(0,122,255,0.1)',
    marginHorizontal: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: 'white',
  },
  summaryCard: {
    margin: 16,
    padding: 16,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(0,122,255,0.8)',
  },
  summaryLabel: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 4,
  },
}); 