import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, ThemePreference } from '@/lib/theme';

interface ThemeOptionProps {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isSelected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function ThemeOption({ value, label, icon, isSelected, onPress, colors }: ThemeOptionProps) {
  return (
    <TouchableOpacity
      style={[
        styles.option,
        {
          backgroundColor: isSelected ? colors.primaryLight : colors.backgroundTertiary,
          borderColor: isSelected ? colors.primary : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon}
        size={24}
        color={isSelected ? colors.primaryText : colors.icon}
      />
      <Text
        style={[
          styles.optionLabel,
          {
            color: isSelected ? colors.primaryText : colors.text,
            fontWeight: isSelected ? '600' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function ThemeToggle() {
  const { themePreference, setThemePreference, colors } = useTheme();

  const options: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
    { value: 'light', label: 'Light', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];

  return (
    <View style={styles.container}>
      {options.map((option) => (
        <ThemeOption
          key={option.value}
          value={option.value}
          label={option.label}
          icon={option.icon}
          isSelected={themePreference === option.value}
          onPress={() => setThemePreference(option.value)}
          colors={colors}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    gap: 6,
  },
  optionLabel: {
    fontSize: 13,
  },
});

