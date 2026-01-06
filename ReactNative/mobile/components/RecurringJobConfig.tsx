import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@/components/DateTimePicker';
import { useTheme } from '@/lib/theme';

export type RecurrencePattern = {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  daysOfWeek?: number[];
  endDate?: string;
};

type Props = {
  isRecurring: boolean;
  onRecurringChange: (value: boolean) => void;
  pattern: RecurrencePattern | null;
  onPatternChange: (pattern: RecurrencePattern | null) => void;
};

const DAYS_OF_WEEK = [
  { index: 0, label: 'Sun' },
  { index: 1, label: 'Mon' },
  { index: 2, label: 'Tue' },
  { index: 3, label: 'Wed' },
  { index: 4, label: 'Thu' },
  { index: 5, label: 'Fri' },
  { index: 6, label: 'Sat' },
];

export default function RecurringJobConfig({
  isRecurring,
  onRecurringChange,
  pattern,
  onPatternChange,
}: Props) {
  const [endDate, setEndDate] = useState<Date | null>(
    pattern?.endDate ? new Date(pattern.endDate) : null
  );
  const { colors } = useTheme();

  const handleToggle = (value: boolean) => {
    onRecurringChange(value);
    if (!value) {
      onPatternChange(null);
      setEndDate(null);
    } else if (!pattern) {
      // Initialize with default pattern
      onPatternChange({
        type: 'daily',
        interval: 1,
      });
    }
  };

  const handleTypeChange = (type: 'daily' | 'weekly' | 'monthly') => {
    const newPattern: RecurrencePattern = {
      ...pattern,
      type,
      interval: pattern?.interval || 1,
    };
    if (type === 'weekly' && !newPattern.daysOfWeek) {
      newPattern.daysOfWeek = [];
    }
    if (type !== 'weekly') {
      delete newPattern.daysOfWeek;
    }
    onPatternChange(newPattern);
  };

  const handleIntervalChange = (value: string) => {
    const interval = parseInt(value, 10) || 1;
    if (pattern) {
      onPatternChange({
        ...pattern,
        interval: Math.max(1, interval),
      });
    }
  };

  const handleDayToggle = (dayIndex: number) => {
    if (!pattern) return;
    const currentDays = pattern.daysOfWeek || [];
    const newDays = currentDays.includes(dayIndex)
      ? currentDays.filter((d) => d !== dayIndex)
      : [...currentDays, dayIndex].sort((a, b) => a - b);
    onPatternChange({
      ...pattern,
      daysOfWeek: newDays,
    });
  };

  const handleEndDateChange = (date: Date | null) => {
    setEndDate(date);
    if (pattern) {
      onPatternChange({
        ...pattern,
        endDate: date ? date.toISOString() : undefined,
      });
    }
  };

  const getIntervalLabel = () => {
    if (!pattern) return '';
    const interval = pattern.interval || 1;
    switch (pattern.type) {
      case 'daily':
        return interval === 1 ? 'day' : 'days';
      case 'weekly':
        return interval === 1 ? 'week' : 'weeks';
      case 'monthly':
        return interval === 1 ? 'month' : 'months';
      default:
        return '';
    }
  };

  return (
    <View style={[styles.container, { 
      backgroundColor: colors.card,
      borderColor: colors.border 
    }]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="repeat" size={20} color={colors.primary} />
          <View style={styles.headerText}>
            <Text style={[styles.label, { color: colors.text }]}>Recurring Job</Text>
            <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
              Create multiple instances based on a schedule
            </Text>
          </View>
        </View>
        <Switch
          value={isRecurring}
          onValueChange={handleToggle}
          trackColor={{ false: colors.borderLight, true: colors.primaryLight }}
          thumbColor={isRecurring ? colors.primary : colors.backgroundTertiary}
        />
      </View>

      {isRecurring && pattern && (
        <View style={[styles.configContainer, { borderTopColor: colors.border }]}>
          {/* Recurrence Type */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Recurrence Type</Text>
            <View style={styles.typeButtons}>
              {(['daily', 'weekly', 'monthly'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    { 
                      backgroundColor: colors.inputBackground || colors.backgroundSecondary,
                      borderColor: colors.border 
                    },
                    pattern.type === type && {
                      borderColor: colors.primary,
                      backgroundColor: colors.primaryLight,
                    },
                  ]}
                  onPress={() => handleTypeChange(type)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      { color: colors.textSecondary },
                      pattern.type === type && { color: colors.primary },
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Interval */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Interval</Text>
            <View style={styles.intervalRow}>
              <Text style={[styles.intervalText, { color: colors.text }]}>Every</Text>
              <TextInput
                style={[styles.intervalInput, { 
                  backgroundColor: colors.inputBackground || colors.backgroundSecondary,
                  borderColor: colors.border,
                  color: colors.inputText
                }]}
                value={(pattern.interval || 1).toString()}
                onChangeText={handleIntervalChange}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={[styles.intervalText, { color: colors.text }]}>{getIntervalLabel()}</Text>
            </View>
          </View>

          {/* Days of Week (for weekly) */}
          {pattern.type === 'weekly' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Days of Week</Text>
              <View style={styles.daysRow}>
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = pattern.daysOfWeek?.includes(day.index);
                  return (
                    <TouchableOpacity
                      key={day.index}
                      style={[
                        styles.dayButton,
                        { 
                          backgroundColor: colors.inputBackground || colors.backgroundSecondary,
                          borderColor: colors.border 
                        },
                        isSelected && {
                          borderColor: colors.primary,
                          backgroundColor: colors.primary,
                        },
                      ]}
                      onPress={() => handleDayToggle(day.index)}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          { color: colors.textSecondary },
                          isSelected && { color: '#fff' },
                        ]}
                      >
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* End Date */}
          <View style={styles.inputGroup}>
            <DateTimePicker
              label="End Date (Optional)"
              value={endDate}
              onChange={handleEndDateChange}
              mode="date"
              minimumDate={new Date()}
            />
            <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
              Leave empty to create recurring jobs indefinitely (up to 1000 instances)
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  sublabel: {
    fontSize: 12,
    marginTop: 2,
  },
  configContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeButtonActive: {},
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  typeButtonTextActive: {},
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  intervalText: {
    fontSize: 15,
  },
  intervalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    width: 60,
    textAlign: 'center',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonActive: {},
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayButtonTextActive: {},
  inputHint: {
    fontSize: 12,
    marginTop: 6,
  },
});

