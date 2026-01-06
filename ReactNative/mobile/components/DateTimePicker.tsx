import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { format } from 'date-fns';
// @ts-ignore - Package needs to be installed: npm install react-native-modal-datetime-picker @react-native-community/datetimepicker
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useTheme } from '@/lib/theme';

type DateTimePickerComponentProps = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  mode: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  required?: boolean;
};

export default function DateTimePicker({
  label,
  value,
  onChange,
  mode,
  minimumDate,
  maximumDate,
  required,
}: DateTimePickerComponentProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { colors } = useTheme();

  const handleConfirm = (selectedDate: Date) => {
    onChange(selectedDate);
    setIsVisible(false);
  };

  const handleCancel = () => {
    setIsVisible(false);
  };

  const displayValue = value
    ? mode === 'date'
      ? format(value, 'MMM d, yyyy')
      : mode === 'time'
        ? format(value, 'h:mm a')
        : format(value, 'MMM d, yyyy h:mm a')
    : '';

  const pickerMode = mode === 'datetime' ? 'datetime' : mode;

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: colors.text }]}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
      ) : null}
      <TouchableOpacity
        style={[styles.input, { 
          backgroundColor: colors.inputBackground || colors.card,
          borderColor: colors.border
        }]}
        onPress={() => setIsVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.inputText, 
          { color: colors.inputText },
          !value && { color: colors.placeholder }
        ]}>
          {displayValue || `Select ${mode === 'date' ? 'date' : mode === 'time' ? 'time' : 'date & time'}`}
        </Text>
        <Ionicons
          name={mode === 'date' ? 'calendar-outline' : 'time-outline'}
          size={20}
          color={colors.icon}
        />
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={isVisible}
        mode={pickerMode}
        date={value || new Date()}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        is24Hour={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  required: {
    color: '#d92d20',
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputText: {
    fontSize: 15,
    flex: 1,
  },
  placeholder: {},
});
