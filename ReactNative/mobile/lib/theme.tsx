import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme as useSystemColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Theme preference options
export type ThemePreference = 'system' | 'light' | 'dark';

// Resolved theme (what's actually displayed)
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = '@heyteam_theme_preference';

interface ThemeContextType {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (theme: ThemePreference) => Promise<void>;
  isDark: boolean;
  colors: typeof lightColors;
}

// Extended color palette for light mode
export const lightColors = {
  // Backgrounds
  background: '#f5f7fb',
  backgroundSecondary: '#ffffff',
  backgroundTertiary: '#e4e7ec',
  
  // Text
  text: '#101828',
  textSecondary: '#475467',
  textTertiary: '#6b7280',
  textMuted: '#98a2b3',
  
  // Brand
  primary: 'hsl(178, 60%, 50%)',
  primaryLight: 'rgba(13, 178, 181, 0.12)',
  primaryText: '#0db2b5',
  
  // UI Elements
  border: '#e4e7ec',
  borderLight: '#d0d5dd',
  divider: '#e4e7ec',
  
  // Cards & Surfaces
  card: '#ffffff',
  cardShadow: '#000000',
  
  // Status colors
  success: '#12b76a',
  successLight: 'rgba(18, 183, 106, 0.12)',
  error: '#d92d20',
  errorLight: 'rgba(217, 45, 32, 0.12)',
  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.12)',
  info: '#3b82f6',
  infoLight: 'rgba(59, 130, 246, 0.12)',
  
  // Icons
  icon: '#6b7280',
  iconSecondary: '#98a2b3',
  
  // Tab bar
  tabBar: '#ffffff',
  tabIconDefault: '#687076',
  tabIconSelected: 'hsl(178, 60%, 50%)',
  
  // Modal
  modalBackdrop: 'rgba(0, 0, 0, 0.5)',
  modalBackground: '#ffffff',
  
  // Input
  inputBackground: '#ffffff',
  inputBorder: '#d0d5dd',
  inputText: '#0f1729',
  placeholder: '#98a2b3',
};

// Extended color palette for dark mode
export const darkColors: typeof lightColors = {
  // Backgrounds
  background: '#0d0d0d',
  backgroundSecondary: '#1a1a1a',
  backgroundTertiary: '#2a2a2a',
  
  // Text
  text: '#f5f5f5',
  textSecondary: '#a1a1a1',
  textTertiary: '#808080',
  textMuted: '#666666',
  
  // Brand
  primary: 'hsl(178, 60%, 45%)',
  primaryLight: 'rgba(13, 178, 181, 0.2)',
  primaryText: '#14c4c7',
  
  // UI Elements
  border: '#333333',
  borderLight: '#444444',
  divider: '#333333',
  
  // Cards & Surfaces
  card: '#1a1a1a',
  cardShadow: '#000000',
  
  // Status colors
  success: '#22c55e',
  successLight: 'rgba(34, 197, 94, 0.2)',
  error: '#ef4444',
  errorLight: 'rgba(239, 68, 68, 0.2)',
  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.2)',
  info: '#60a5fa',
  infoLight: 'rgba(96, 165, 250, 0.2)',
  
  // Icons
  icon: '#a1a1a1',
  iconSecondary: '#666666',
  
  // Tab bar
  tabBar: '#1a1a1a',
  tabIconDefault: '#808080',
  tabIconSelected: '#14c4c7',
  
  // Modal
  modalBackdrop: 'rgba(0, 0, 0, 0.7)',
  modalBackground: '#1a1a1a',
  
  // Input
  inputBackground: '#2a2a2a',
  inputBorder: '#444444',
  inputText: '#f5f5f5',
  placeholder: '#666666',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && ['system', 'light', 'dark'].includes(savedTheme)) {
          setThemePreferenceState(savedTheme as ThemePreference);
        }
      } catch (error) {
        console.error('[Theme] Error loading theme preference:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadThemePreference();
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      // Force re-render when system theme changes (if using system preference)
      if (themePreference === 'system') {
        // The component will re-render because systemColorScheme hook will update
      }
    });

    return () => subscription.remove();
  }, [themePreference]);

  // Save theme preference
  const setThemePreference = useCallback(async (theme: ThemePreference) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
      setThemePreferenceState(theme);
    } catch (error) {
      console.error('[Theme] Error saving theme preference:', error);
    }
  }, []);

  // Resolve the actual theme to use
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (themePreference === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themePreference;
  }, [themePreference, systemColorScheme]);

  const isDark = resolvedTheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo(
    () => ({
      themePreference,
      resolvedTheme,
      setThemePreference,
      isDark,
      colors,
    }),
    [themePreference, resolvedTheme, setThemePreference, isDark, colors]
  );

  // Don't render until theme is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Hook to access theme
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Convenience hook for just colors
export function useThemeColors() {
  const { colors } = useTheme();
  return colors;
}

