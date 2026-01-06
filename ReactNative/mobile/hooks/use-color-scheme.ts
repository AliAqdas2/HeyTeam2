import { useTheme } from '@/lib/theme';

/**
 * Custom hook that returns the resolved color scheme (light or dark)
 * based on user preference (system, light, or dark).
 * 
 * This replaces the direct react-native useColorScheme to support
 * user-configurable theme preferences.
 */
export function useColorScheme() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme;
}
