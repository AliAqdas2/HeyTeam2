import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/lib/theme';
import {
  setupNotificationHandler,
  setupNotificationCategories,
  setupNotificationListeners,
  getLastNotificationResponse,
  handleNotificationResponse,
} from '@/lib/notifications';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { resolvedTheme, isDark } = useTheme();
  const notificationListenerCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Initialize notification system
    // Delay initialization to ensure native modules are ready
    async function initNotifications() {
      try {
        // Wait a bit to ensure native bridge is fully initialized
        await new Promise(resolve => setTimeout(resolve, 100));

        // Set up notification handler first (must be done before other calls)
        try {
          setupNotificationHandler();
        } catch (error) {
          console.error('[Notifications] Failed to setup handler:', error);
          // Continue anyway - handler is optional
        }

        // Set up notification categories (for action buttons)
        // This should not crash if it fails - categories are optional
        await setupNotificationCategories().catch((error) => {
          console.error('[Notifications] Failed to setup categories:', error);
        });

        // Set up notification listeners
        // This should not crash if it fails - listeners are optional
        try {
          notificationListenerCleanup.current = setupNotificationListeners();
        } catch (error) {
          console.error('[Notifications] Failed to setup listeners:', error);
          notificationListenerCleanup.current = null;
        }

        // Handle app launch from notification
        // Wait a bit longer to ensure router is fully initialized
        // This should not crash if it fails
        try {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second for router to be ready
          const lastResponse = await getLastNotificationResponse();
          if (lastResponse) {
            console.log('[Notifications] App launched from notification');
            handleNotificationResponse(lastResponse);
          }
        } catch (error) {
          console.error('[Notifications] Failed to get last notification response:', error);
        }
      } catch (error) {
        console.error('[Notifications] Error initializing:', error);
        // Don't crash the app - notifications are optional
      }
    }

    // Initialize notifications asynchronously, don't block app startup
    // Use a small delay to ensure React Native bridge is ready
    const timeoutId = setTimeout(() => {
      initNotifications().catch((error) => {
        console.error('[Notifications] Fatal error in initNotifications:', error);
      });
    }, 200);

    // Cleanup listeners on unmount
    return () => {
      clearTimeout(timeoutId);
      try {
        if (notificationListenerCleanup.current) {
          notificationListenerCleanup.current();
        }
      } catch (error) {
        console.error('[Notifications] Error during cleanup:', error);
      }
    };
  }, []);

  return (
    <NavigationThemeProvider value={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="contact" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutNav />
    </ThemeProvider>
  );
}
