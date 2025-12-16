import * as apn from "apn";
import * as admin from "firebase-admin";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { randomBytes } from "crypto";

let apnProvider: apn.Provider | null = null;
let fcmInitialized = false;

/**
 * Initialize APNs provider
 */
function initializeAPNs(): apn.Provider | null {
  if (apnProvider) {
    return apnProvider;
  }

  const keyPath = process.env.APNS_KEY_PATH;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID || "ai.heyteam.portal";
  const production = true;

  if (!keyPath || !keyId || !teamId) {
    console.warn("[PushNotifications] APNs not configured - missing environment variables");
    return null;
  }

  try {
    // Resolve path - if relative, resolve from project root
    const resolvedPath = keyPath.startsWith("/") 
      ? keyPath 
      : resolve(process.cwd(), keyPath);
    const key = readFileSync(resolvedPath, "utf8");
    
    apnProvider = new apn.Provider({
      token: {
        key,
        keyId,
        teamId,
      },
      production, // Set to true for production, false for sandbox
    });

    console.log("[PushNotifications] APNs initialized successfully");
    return apnProvider;
  } catch (error) {
    console.error("[PushNotifications] Failed to initialize APNs:", error);
    return null;
  }
}

/**
 * Initialize Firebase Cloud Messaging for Android
 */
function initializeFCM(): boolean {
  if (fcmInitialized) {
    return true;
  }

  const serviceAccountPath = process.env.FCM_SERVICE_ACCOUNT_PATH;
  const fcmServerKey = process.env.FCM_SERVER_KEY;

  if (!serviceAccountPath && !fcmServerKey) {
    console.warn("[PushNotifications] FCM not configured - missing environment variables");
    return false;
  }

  try {
    if (serviceAccountPath) {
      // Initialize with service account file
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else if (fcmServerKey) {
      // For server key, we'll use it directly in HTTP requests
      // Firebase Admin SDK doesn't support server key directly
      // We'll handle FCM via HTTP API
      console.log("[PushNotifications] FCM server key provided - will use HTTP API");
    }

    fcmInitialized = true;
    console.log("[PushNotifications] FCM initialized successfully");
    return true;
  } catch (error) {
    console.error("[PushNotifications] Failed to initialize FCM:", error);
    return false;
  }
}

/**
 * Generate a unique notification ID
 */
function generateNotificationId(): string {
  return `notif_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * Send push notification to a single device token
 */
export async function sendPushNotification(
  token: string,
  platform: "ios" | "android",
  notification: {
    title: string;
    body: string;
    data?: Record<string, any>;
    notificationId?: string; // Optional - will be generated if not provided
  }
): Promise<{ success: boolean; notificationId: string }> {
  const notificationId = notification.notificationId || generateNotificationId();

  try {
    if (platform === "ios") {
      const provider = initializeAPNs();
      if (!provider) {
        console.warn("[PushNotifications] APNs provider not available");
        return { success: false, notificationId };
      }

      const bundleId = process.env.APNS_BUNDLE_ID || "ai.heyteam.portal";
      const note = new apn.Notification();

      note.alert = {
        title: notification.title,
        body: notification.body,
      };
      note.topic = bundleId;
      note.sound = "default";
      note.badge = 1;
      // Set category and threadId (using type assertion as TypeScript types may be incomplete)
      (note as any).category = "JOB_INVITATION"; // For action buttons
      (note as any).threadId = notification.data?.jobId || "default"; // Group notifications by job
      note.payload = {
        ...notification.data,
        notificationId,
        actionType: "job_invitation",
      };
      console.log("[PushNotifications] APNs notification:", note);
      const result = await provider.send(note, token);
      console.log("[PushNotifications] APNs result:", result);
      if (result.failed && result.failed.length > 0) {
        console.error("[PushNotifications] APNs send failed:", result.failed);
        // Check if token is invalid
        const failure = result.failed[0];
        if (failure.response?.reason === "BadDeviceToken" || failure.response?.reason === "Unregistered") {
          console.log("[PushNotifications] Invalid token detected, should be removed:", token);
        }
        return { success: false, notificationId };
      }

      if (result.sent && result.sent.length > 0) {
        console.log("[PushNotifications] APNs notification sent successfully to:", token, "notificationId:", notificationId);
        return { success: true, notificationId };
      }

      return { success: false, notificationId };
    } else if (platform === "android") {
      // Use Firebase Admin SDK if initialized, otherwise use HTTP API
      if (admin.apps.length > 0) {
        try {
          const message: admin.messaging.Message = {
            notification: {
              title: notification.title,
              body: notification.body,
            },
            data: {
              ...Object.fromEntries(
                Object.entries(notification.data || {}).map(([k, v]) => [k, String(v)])
              ),
              notificationId,
              actionType: "job_invitation",
            },
            token,
            android: {
              priority: "high",
              notification: {
                clickAction: "OPEN_INVITATIONS",
                sound: "default",
                channelId: "job_invitations",
              },
            },
            apns: {
              payload: {
                aps: {
                  category: "JOB_INVITATION",
                  threadId: notification.data?.jobId || "default",
                },
              },
            },
          };

          const response = await admin.messaging().send(message);
          console.log("[PushNotifications] FCM notification sent successfully:", response, "notificationId:", notificationId);
          return { success: true, notificationId };
        } catch (error: any) {
          console.error("[PushNotifications] FCM send error:", error);
          // Check if token is invalid
          if (error.code === "messaging/invalid-registration-token" || error.code === "messaging/registration-token-not-registered") {
            console.log("[PushNotifications] Invalid FCM token detected, should be removed:", token);
          }
          return { success: false, notificationId };
        }
      } else {
        // Fallback to HTTP API if Admin SDK not available
        const fcmServerKey = process.env.FCM_SERVER_KEY;
        if (!fcmServerKey) {
          console.warn("[PushNotifications] FCM server key not available");
          return { success: false, notificationId };
        }

        const response = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Authorization": `key=${fcmServerKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: token,
            notification: {
              title: notification.title,
              body: notification.body,
            },
            data: {
              ...notification.data,
              notificationId,
              actionType: "job_invitation",
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[PushNotifications] FCM HTTP API error:", errorText);
          return { success: false, notificationId };
        }

        const result = await response.json();
        if (result.success === 1) {
          console.log("[PushNotifications] FCM notification sent via HTTP API, notificationId:", notificationId);
          return { success: true, notificationId };
        } else {
          console.error("[PushNotifications] FCM HTTP API failed:", result);
          return { success: false, notificationId };
        }
      }
    }

    return { success: false, notificationId };
  } catch (error) {
    console.error("[PushNotifications] Unexpected error sending notification:", error);
    return { success: false, notificationId };
  }
}

/**
 * Send push notifications to multiple contacts
 * Returns arrays of contact IDs that succeeded and failed, plus notification IDs
 */
export async function sendPushNotificationsToContacts(
  deviceTokens: Array<{ contactId: string; token: string; platform: "ios" | "android" }>,
  notification: {
    title: string;
    body: string;
    data?: Record<string, any>;
  }
): Promise<{ success: string[]; failed: string[]; notificationIds: Array<{ contactId: string; notificationId: string; token: string }> }> {
  const success: string[] = [];
  const failed: string[] = [];
  const notificationIds: Array<{ contactId: string; notificationId: string; token: string }> = [];

  // Send notifications in parallel
  const results = await Promise.allSettled(
    deviceTokens.map(async ({ contactId, token, platform }) => {
      const result = await sendPushNotification(token, platform, notification);
      return { contactId, token, success: result.success, notificationId: result.notificationId };
    })
  );

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      if (result.value.success) {
        success.push(result.value.contactId);
        notificationIds.push({ 
          contactId: result.value.contactId, 
          notificationId: result.value.notificationId,
          token: result.value.token
        });
      } else {
        failed.push(result.value.contactId);
      }
    } else {
      failed.push(deviceTokens[index].contactId);
    }
  });

  return { success, failed, notificationIds };
}

// Initialize on module load
initializeAPNs();
initializeFCM();

