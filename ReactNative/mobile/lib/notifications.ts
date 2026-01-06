/**
 * Push Notifications Module
 * 
 * Handles all push notification logic including:
 * - Permission requesting
 * - Token registration/removal
 * - Notification handling (foreground, background, response)
 * - Notification categories with action buttons
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { apiFetch } from './api';
import { savePushToken, getPushToken, clearPushToken } from './session';

// Types
export type NotificationData = {
  type?: string;
  jobId?: string;
  availabilityId?: string;
  action?: string;
  notificationId?: string;
  actionType?: string;
};

// Track if notification handler has been initialized
let notificationHandlerInitialized = false;

/**
 * Initialize notification handler
 * Must be called after app startup, not at module load time
 */
export function setupNotificationHandler(): void {
  if (notificationHandlerInitialized) {
    return;
  }

  try {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        try {
          const data = notification.request.content.data as NotificationData;
          
          // Always show notification when app is in foreground
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          };
        } catch (error) {
          console.error('[Notifications] Error in notification handler:', error);
          // Return default behavior on error
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          };
        }
      },
    });
    notificationHandlerInitialized = true;
  } catch (error) {
    console.error('[Notifications] Error setting notification handler:', error);
    // App should continue even if notification handler setup fails
  }
}

/**
 * Set up notification categories with action buttons
 * Called once on app initialization
 */
export async function setupNotificationCategories(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      try {
        await Notifications.setNotificationCategoryAsync('JOB_INVITATION', [
          {
            identifier: 'accept',
            buttonTitle: 'Accept',
            options: {
              opensAppToForeground: false,
            },
          },
          {
            identifier: 'decline',
            buttonTitle: 'Decline',
            options: {
              opensAppToForeground: false,
              isDestructive: true,
            },
          },
          {
            identifier: 'maybe',
            buttonTitle: 'Maybe',
            options: {
              opensAppToForeground: false,
            },
          },
        ]);
      } catch (error) {
        console.error('[Notifications] Error setting up iOS notification categories:', error);
      }
    }

    if (Platform.OS === 'android') {
      try {
        // Set up notification category with action buttons for Android
        await Notifications.setNotificationCategoryAsync('JOB_INVITATION', [
          {
            identifier: 'accept',
            buttonTitle: 'Accept',
            options: {
              opensAppToForeground: false,
            },
          },
          {
            identifier: 'decline',
            buttonTitle: 'Decline',
            options: {
              opensAppToForeground: false,
              isDestructive: true,
            },
          },
        ]);
      } catch (error) {
        console.error('[Notifications] Error setting up Android notification categories:', error);
      }

      try {
        // Create notification channel for job invitations
        await Notifications.setNotificationChannelAsync('job_invitations', {
          name: 'Job Invitations',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0db2b5',
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
        });
      } catch (error) {
        console.error('[Notifications] Error creating job_invitations channel:', error);
      }

      try {
        // Create default notification channel
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0db2b5',
          sound: 'default',
        });
      } catch (error) {
        console.error('[Notifications] Error creating default channel:', error);
      }

      try {
        // Create messages channel
        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Messages',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0db2b5',
          sound: 'default',
        });
      } catch (error) {
        console.error('[Notifications] Error creating messages channel:', error);
      }
    }
  } catch (error) {
    console.error('[Notifications] Error in setupNotificationCategories:', error);
    // Don't throw - allow app to continue even if categories fail to set up
  }
}

/**
 * Request notification permissions
 * Returns true if permissions granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (!Device.isDevice) {
      console.log('[Notifications] Must use physical device for push notifications');
      return false;
    }

    let existingStatus;
    try {
      const permissions = await Notifications.getPermissionsAsync();
      existingStatus = permissions.status;
    } catch (error) {
      console.error('[Notifications] Error getting permissions:', error);
      return false;
    }

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      } catch (error) {
        console.error('[Notifications] Error requesting permissions:', error);
        return false;
      }
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Notifications] Error in requestNotificationPermissions:', error);
    return false;
  }
}

/**
 * Get the device push token
 * Returns the native device token (APNs for iOS, FCM for Android)
 */
export async function getDevicePushToken(): Promise<{ token: string; platform: 'ios' | 'android' } | null> {
  try {
    if (!Device.isDevice) {
      console.log('[Notifications] Must use physical device for push notifications');
      return null;
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[Notifications] No permission to get push token');
      return null;
    }

    // Get native device token (APNs for iOS, FCM for Android)
    let tokenData;
    try {
      tokenData = await Notifications.getDevicePushTokenAsync();
    } catch (error) {
      console.error('[Notifications] Error calling getDevicePushTokenAsync:', error);
      return null;
    }

    if (!tokenData || !tokenData.data) {
      console.error('[Notifications] Invalid token data received');
      return null;
    }

    const platform = Platform.OS as 'ios' | 'android';

    console.log(`[Notifications] Got ${platform} device token:`, tokenData.data);

    return {
      token: tokenData.data,
      platform,
    };
  } catch (error) {
    console.error('[Notifications] Error getting push token:', error);
    return null;
  }
}

/**
 * Register device token with the server
 * Called after successful login
 */
export async function registerDeviceToken(): Promise<boolean> {
  try {
    const tokenInfo = await getDevicePushToken();
    if (!tokenInfo) {
      console.log('[Notifications] No token to register');
      return false;
    }

    // Save token locally
    await savePushToken(tokenInfo.token);

    // Send to server
    await apiFetch('/api/contact/device-token', {
      method: 'POST',
      body: {
        token: tokenInfo.token,
        platform: tokenInfo.platform,
      },
    });

    console.log('[Notifications] Device token registered successfully');
    return true;
  } catch (error) {
    console.error('[Notifications] Error registering device token:', error);
    return false;
  }
}

/**
 * Remove device token from server
 * Called on logout
 */
export async function unregisterDeviceToken(): Promise<void> {
  try {
    const token = await getPushToken();
    if (!token) {
      console.log('[Notifications] No token to unregister');
      return;
    }

    await apiFetch('/api/contact/device-token', {
      method: 'DELETE',
      body: { token },
    });

    await clearPushToken();
    console.log('[Notifications] Device token unregistered successfully');
  } catch (error) {
    console.error('[Notifications] Error unregistering device token:', error);
    // Clear local token anyway
    await clearPushToken();
  }
}

/**
 * Handle notification action button press
 * Called when user presses Accept/Decline/Maybe on a notification
 */
async function handleNotificationAction(
  actionIdentifier: string,
  data: NotificationData
): Promise<void> {
  console.log('[Notifications] Action pressed:', actionIdentifier, data);

  // Only handle accept and decline actions (maybe is not supported by the action endpoint)
  if (actionIdentifier !== 'accept' && actionIdentifier !== 'decline') {
    console.log('[Notifications] Action not supported:', actionIdentifier);
    return;
  }

  if (!data.jobId) {
    console.log('[Notifications] No job ID in notification data');
    return;
  }

  if (!data.notificationId) {
    console.log('[Notifications] No notification ID in notification data');
    return;
  }

  try {
    // Use the push notification action endpoint for accept/decline
    await apiFetch('/api/contact/push-notification/action', {
      method: 'POST',
      body: {
        notificationId: data.notificationId,
        action: actionIdentifier, // 'accept' or 'decline'
        jobId: data.jobId,
      },
    });
    console.log(`[Notifications] Action ${actionIdentifier} processed successfully`);
  } catch (error) {
    console.error('[Notifications] Error handling notification action:', error);
  }
}

/**
 * Handle notification response (when user taps or presses action)
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): void {
  const { notification, actionIdentifier } = response;
  const data = notification.request.content.data as NotificationData;

  console.log('[Notifications] Response received:', {
    actionIdentifier,
    data,
  });

  // Handle action button press (Accept, Decline, Maybe)
  if (actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    handleNotificationAction(actionIdentifier, data);
    return;
  }

  // Handle default tap (open app)
  // Send acknowledgement for notification delivery
  if (data.notificationId) {
    apiFetch('/api/contact/push-notification/delivered', {
      method: 'POST',
      body: { notificationId: data.notificationId },
    }).catch((error) => {
      console.error('[Notifications] Error sending acknowledgement:', error);
      // Ignore errors - acknowledgement is best effort
    });
  }

  // Navigate to the appropriate screen
  // Use setTimeout to ensure router is ready (especially when app is launched from closed state)
  setTimeout(() => {
    try {
  if (data.type === 'job_invitation') {
    // Navigate to invitations screen
    router.push('/contact/invitations');
  } else if (data.type === 'message' || data.type === 'job_cancellation' || data.type === 'job_update') {
    // Navigate to messages screen for all message types
    router.push('/contact/messages');
  } else {
    // Default: go to dashboard
    router.push('/contact/dashboard');
  }
    } catch (error) {
      console.error('[Notifications] Error navigating:', error);
      // Fallback: try to navigate to dashboard
      try {
        router.push('/contact/dashboard');
      } catch (fallbackError) {
        console.error('[Notifications] Fallback navigation also failed:', fallbackError);
      }
    }
  }, 500); // Small delay to ensure router is ready
}

/**
 * Handle notification received while app is in foreground
 */
export function handleNotificationReceived(
  notification: Notifications.Notification
): void {
  const data = notification.request.content.data as NotificationData;
  console.log('[Notifications] Notification received in foreground:', data);

  // Report notification as delivered
  if (data.notificationId) {
    apiFetch('/api/contact/push-notification/delivered', {
      method: 'POST',
      body: { notificationId: data.notificationId },
    }).catch(() => {
      // Ignore errors
    });
  }
}

/**
 * Set up notification listeners
 * Returns cleanup function to remove listeners
 */
export function setupNotificationListeners(): () => void {
  try {
    // Handle notifications received while app is in foreground
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      handleNotificationReceived
    );

    // Handle notification response (tap or action button)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    // Return cleanup function
    return () => {
      try {
        receivedSubscription.remove();
        responseSubscription.remove();
      } catch (error) {
        console.error('[Notifications] Error removing listeners:', error);
      }
    };
  } catch (error) {
    console.error('[Notifications] Error setting up listeners:', error);
    // Return empty cleanup function if setup fails
    return () => {};
  }
}

/**
 * Get last notification response (for handling app launch from notification)
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch (error) {
    console.error('[Notifications] Error getting last notification response:', error);
    return null;
  }
}

/**
 * Clear all notifications from notification center
 */
export async function clearAllNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('[Notifications] Error clearing notifications:', error);
  }
}

/**
 * Set badge count (iOS only)
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('[Notifications] Error setting badge count:', error);
  }
}

/**
 * Get current badge count
 */
export async function getBadgeCount(): Promise<number> {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    console.error('[Notifications] Error getting badge count:', error);
    return 0;
  }
}

