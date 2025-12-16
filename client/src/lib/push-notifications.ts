import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";

let pushToken: string | null = null;
let listenersAdded = false;

/**
 * Send log message to remote server
 */
async function sendRemoteLog(message: string, level: 'error' | 'warn' | 'info' = 'error', metadata: Record<string, any> = {}): Promise<void> {
  try {
    const baseUrl = Capacitor.isNativePlatform() 
      ? "https://portal.heyteam.ai" 
      : "";
    
    await fetch(`${baseUrl}/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        level,
        metadata: {
          ...metadata,
          platform: Capacitor.getPlatform(),
          timestamp: new Date().toISOString(),
        },
      }),
    }).catch(err => {
      // Silently fail - we don't want remote logging to break the app
      console.error('[RemoteLog] Failed to send log:', err);
    });
  } catch (error) {
    // Silently fail - we don't want remote logging to break the app
    console.error('[RemoteLog] Error sending log:', error);
  }
}

/**
 * Add all push notification listeners (following official Capacitor pattern)
 */
const addListeners = async () => {
  console.log("[PushNotifications] 📱 Adding listeners...");
  
  await PushNotifications.addListener('registration', token => {
    // Collect all log messages for remote logging
    const logMessages: string[] = [];
    
    // Log the entire token object to debug structure
    const rawTokenLog = `Raw Token Object: ${JSON.stringify(token, null, 2)}\nToken object keys: ${Object.keys(token).join(', ')}\ntoken.value type: ${typeof token.value}\ntoken.value: ${token.value}`;
    console.log('========================================');
    console.log('[PushNotifications] 🔍 Raw Token Object:', JSON.stringify(token, null, 2));
    console.log('Token object keys:', Object.keys(token));
    console.log('token.value type:', typeof token.value);
    console.log('token.value:', token.value);
    console.log('========================================');
    logMessages.push(rawTokenLog);
    
    // Get token value - Capacitor uses token.value
    // But handle case where it might be undefined or in wrong format
    const tokenValue = token.value || '';
    const tokenStr = String(tokenValue).trim().replace(/\s+/g, ''); // Remove any whitespace
    const tokenLength = tokenStr.length;
    const platform = getPlatform();
    
    // Validate token based on platform
    // iOS: 64 hexadecimal characters
    // Android: FCM token (140-160 chars, alphanumeric with colons, hyphens, underscores)
    let isValid: boolean;
    let expectedFormat: string;
    let validationRegex: RegExp;
    
    if (platform === 'ios') {
      expectedFormat = '64 hexadecimal characters';
      validationRegex = /^[0-9a-fA-F]{64}$/;
      isValid = validationRegex.test(tokenStr);
    } else {
      // Android FCM token format: alphanumeric, colons, hyphens, underscores, dots
      // Typically 140-160 characters
      expectedFormat = 'FCM token (140-160 alphanumeric characters with colons/hyphens)';
      validationRegex = /^[A-Za-z0-9:_\-\.]+$/;
      isValid = validationRegex.test(tokenStr) && tokenLength >= 140 && tokenLength <= 200;
    }
    
    const tokenInfo = `Device Token Received:\nFull Token: ${tokenStr}\nToken Length: ${tokenLength} characters\nExpected: ${expectedFormat}\nPlatform: ${platform}\nToken Valid: ${isValid ? 'YES' : 'NO'}`;
    console.log('========================================');
    console.log('[PushNotifications] ✅ Device Token Received:');
    console.log(`Full Token: ${tokenStr}`);
    console.log(`Token Length: ${tokenLength} characters`);
    console.log(`Expected: ${expectedFormat}`);
    console.log(`Platform: ${platform}`);
    console.log(`Token Valid: ${isValid ? 'YES' : 'NO'}`);
    console.log('========================================');
    logMessages.push(tokenInfo);
    
    if (!isValid) {
      let errorDetails = '';
      console.error('[PushNotifications] ⚠️  WARNING: Token format is invalid!');
      console.error(`Expected: ${expectedFormat}`);
      console.error(`Received: ${tokenLength} characters`);
      console.error(`Token value (raw): "${tokenValue}"`);
      console.error(`Token value (processed): "${tokenStr}"`);
      console.error(`Token object:`, token);
      
      errorDetails += `WARNING: Token format is invalid!\nExpected: ${expectedFormat}\nReceived: ${tokenLength} characters\nPlatform: ${platform}\nToken value (raw): "${tokenValue}"\nToken value (processed): "${tokenStr}"\n`;
      
      // If token is empty
      if (tokenLength === 0) {
        const emptyError = `ERROR: Token is empty!\nAvailable properties: ${Object.keys(token).join(', ')}\ntoken.value: ${token.value}\ntoken.value type: ${typeof token.value}${token.value === undefined ? '\ntoken.value is undefined!' : ''}${token.value === null ? '\ntoken.value is null!' : ''}`;
        console.error('[PushNotifications] ❌ ERROR: Token is empty!');
        console.error('Available properties:', Object.keys(token));
        console.error('token.value:', token.value);
        console.error('token.value type:', typeof token.value);
        if (token.value === undefined) {
          console.error('[PushNotifications] ❌ token.value is undefined!');
        }
        if (token.value === null) {
          console.error('[PushNotifications] ❌ token.value is null!');
        }
        errorDetails += emptyError;
      } else if (platform === 'ios' && tokenLength !== 64) {
        const lengthError = `ERROR: Token length incorrect for iOS! Got ${tokenLength}, expected 64\nFirst 20 chars: ${tokenStr.substring(0, 20)}\nLast 20 chars: ${tokenStr.substring(tokenStr.length - 20)}`;
        console.error(`[PushNotifications] ❌ ERROR: Token length incorrect for iOS! Got ${tokenLength}, expected 64`);
        console.error(`First 20 chars: ${tokenStr.substring(0, 20)}`);
        console.error(`Last 20 chars: ${tokenStr.substring(tokenStr.length - 20)}`);
        errorDetails += lengthError;
      } else if (platform === 'android' && (tokenLength < 140 || tokenLength > 200)) {
        const lengthError = `ERROR: Token length incorrect for Android! Got ${tokenLength}, expected 140-200\nFirst 20 chars: ${tokenStr.substring(0, 20)}\nLast 20 chars: ${tokenStr.substring(tokenStr.length - 20)}`;
        console.error(`[PushNotifications] ❌ ERROR: Token length incorrect for Android! Got ${tokenLength}, expected 140-200`);
        console.error(`First 20 chars: ${tokenStr.substring(0, 20)}`);
        console.error(`Last 20 chars: ${tokenStr.substring(tokenStr.length - 20)}`);
        errorDetails += lengthError;
      } else {
        const invalidChars = tokenStr.match(/[^A-Za-z0-9:_\-\.]/g)?.join(', ') || 'none';
        const invalidError = `ERROR: Token contains invalid characters\nToken contains invalid chars: ${invalidChars}`;
        console.error(`[PushNotifications] ❌ ERROR: Token contains invalid characters`);
        console.error(`Token contains invalid chars: ${invalidChars}`);
        errorDetails += invalidError;
      }
      
      logMessages.push(errorDetails);
      
      // Send error log to remote server
      const combinedMessage = logMessages.join('\n\n');
      sendRemoteLog(combinedMessage, 'error', {
        tokenLength,
        isValid,
        tokenValue: tokenValue.substring(0, 50), // Only send first 50 chars for privacy
        tokenStr: tokenStr.substring(0, 50),
        platform: getPlatform(),
      });
    } else {
      // Send success log to remote server
      const combinedMessage = logMessages.join('\n\n');
      sendRemoteLog(combinedMessage, 'info', {
        tokenLength,
        isValid,
        platform: getPlatform(),
      });
    }
    
    if (!tokenStr || tokenLength === 0) {
      const criticalError = 'CRITICAL: No token value found!';
      console.error('[PushNotifications] ❌ CRITICAL: No token value found!');
      logMessages.push(criticalError);
      
      const combinedMessage = logMessages.join('\n\n');
      sendRemoteLog(combinedMessage, 'error', {
        tokenLength: 0,
        isValid: false,
        platform: getPlatform(),
      });
      
      const platformName = platform === 'ios' ? 'iOS' : 'Android';
      showErrorToUser("Token Registration Failed", `Device token is empty. Please check your ${platformName} configuration.`);
      return;
    }
    
    pushToken = tokenStr;
    
    // Send token to server with logged-in contactId
    sendTokenToServer(tokenStr, getPlatform()).catch(err => {
      console.error("[PushNotifications] ❌ Failed to send token:", err);
      sendRemoteLog(`Failed to send token to server: ${err instanceof Error ? err.message : String(err)}`, 'error', {
        tokenLength: tokenStr.length,
        platform: getPlatform(),
      });
    });
  });

  await PushNotifications.addListener('registrationError', err => {
    const errorMessage = `Registration error: ${err.error || JSON.stringify(err)}`;
    console.error('[PushNotifications] ❌ Registration error:', err.error);
    
    // Send error to remote server
    sendRemoteLog(`Push Notification Registration Error\n\n${errorMessage}`, 'error', {
      error: err.error,
      errorObject: JSON.stringify(err),
      platform: getPlatform(),
    });
    
    showErrorToUser("Push Notification Registration Failed", errorMessage);
  });

  await PushNotifications.addListener('pushNotificationReceived', async notification => {
    console.log('[PushNotifications] 📬 Notification received');
    
    const data = notification.data;
    if (data?.actionType === "job_invitation" && data?.notificationId) {
      try {
        const { contactApiRequest } = await import("./contactApiClient");
        await contactApiRequest("POST", "/api/contact/push-notification/delivered", {
          notificationId: data.notificationId,
        });
        console.log('[PushNotifications] ✅ Delivery receipt sent');
      } catch (err) {
        console.error("[PushNotifications] ❌ Failed to send receipt:", err);
      }
    }
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', async action => {
    console.log(`[PushNotifications] 👆 Action: ${action.actionId}`);
    
    const data = action.notification.data;
    if (data?.actionType === "job_invitation") {
      try {
        const { contactApiRequest } = await import("./contactApiClient");
        
        if (data.notificationId) {
          await contactApiRequest("POST", "/api/contact/push-notification/delivered", {
            notificationId: data.notificationId,
          }).catch(err => console.error("[PushNotifications] ❌ Receipt failed:", err));
        }
        
        if (action.actionId === "ACCEPT" || action.actionId === "DECLINE") {
          const actionType = action.actionId === "ACCEPT" ? "accept" : "decline";
          await contactApiRequest("POST", "/api/contact/push-notification/action", {
            notificationId: data.notificationId,
            action: actionType,
            jobId: data.jobId,
          });
          console.log(`[PushNotifications] ✅ Action ${actionType} sent`);
        } else {
          window.dispatchEvent(new CustomEvent("pushNotificationTap", {
            detail: { type: data.type, jobId: data.jobId, action: data.action },
          }));
        }
      } catch (err) {
        console.error("[PushNotifications] ❌ Action error:", err);
      }
    }
  });
  
  console.log("[PushNotifications] ✅ Listeners ready");
};

/**
 * Get current push token
 */
export function getPushToken(): string | null {
  return pushToken;
}

/**
 * Get platform (ios or android)
 */
function getPlatform(): "ios" | "android" {
  if (Capacitor.getPlatform() === "ios") {
    return "ios";
  }
  return "android";
}

/**
 * Send device token to server with logged-in contactId
 * Retries if contactId is not available yet (e.g., during login)
 */
async function sendTokenToServer(token: string, platform: "ios" | "android", retryCount = 0): Promise<void> {
  try {
    const { getContactId } = await import("./contactApiClient");
    const contactId = getContactId();
    
    if (!contactId) {
      if (retryCount < 5) {
        console.log(`[PushNotifications] ⏳ Waiting for contactId... (${retryCount + 1}/5)`);
        setTimeout(() => sendTokenToServer(token, platform, retryCount + 1), 1000);
        return;
      }
      console.error(`[PushNotifications] ❌ No contactId after 5 retries`);
      showErrorToUser("Token Registration Failed", "Contact ID not available. Please log out and log back in.");
      return;
    }
    
    // Validate token format before sending based on platform
    let isValidToken: boolean;
    let expectedFormat: string;
    
    if (platform === 'ios') {
      // iOS: 64 hexadecimal characters
      expectedFormat = '64 hex characters';
      isValidToken = /^[0-9a-fA-F]{64}$/.test(token);
    } else {
      // Android: FCM token (140-200 chars, alphanumeric with colons/hyphens)
      expectedFormat = 'FCM token (140-200 alphanumeric characters)';
      isValidToken = /^[A-Za-z0-9:_\-\.]+$/.test(token) && token.length >= 140 && token.length <= 200;
    }
    
    if (!isValidToken) {
      console.error(`[PushNotifications] ❌ Invalid token format!`);
      console.error(`Token: ${token.substring(0, 50)}...`);
      console.error(`Length: ${token.length} (expected: ${expectedFormat})`);
      console.error(`Platform: ${platform}`);
      throw new Error(`Invalid device token format: expected ${expectedFormat}, got ${token.length} characters`);
    }
    
    console.log(`[PushNotifications] 📤 Sending token with contactId: ${contactId}`);
    console.log(`[PushNotifications]    Full Token: ${token}`);
    console.log(`[PushNotifications]    Token Length: ${token.length} (valid: ${isValidToken})`);
    console.log(`[PushNotifications]    Platform: ${platform}`);
    
    const { contactApiRequest } = await import("./contactApiClient");
    const response = await contactApiRequest("POST", "/api/contact/device-token", {
      token,
      platform,
    });
    
    const responseData = await response.json().catch(() => ({}));
    console.log(`[PushNotifications] ✅ Token sent successfully with contactId: ${contactId}`);
    
    window.dispatchEvent(new CustomEvent("pushNotificationSuccess", {
      detail: { message: "Push notifications enabled successfully!" }
    }));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[PushNotifications] ❌ Failed to send token: ${errorMsg}`);
    
    // Send error to remote server
    sendRemoteLog(`Failed to send token to server\n\nError: ${errorMsg}\nToken length: ${token.length}\nPlatform: ${platform}\nRetry count: ${retryCount}`, 'error', {
      error: errorMsg,
      tokenLength: token.length,
      platform,
      retryCount,
    });
    
    if (retryCount < 3 && error instanceof Error && error.message.includes("UNAUTHORIZED")) {
      console.log(`[PushNotifications] ⏳ Retrying... (${retryCount + 1}/3)`);
      setTimeout(() => sendTokenToServer(token, platform, retryCount + 1), 1000);
    } else {
      showErrorToUser("Token Registration Failed", `Failed: ${errorMsg}. Please try logging out and back in.`);
    }
  }
}

/**
 * Remove device token from server (on logout)
 */
export async function removeDeviceToken(): Promise<void> {
  if (!pushToken) {
    return;
  }

  try {
    const { contactApiRequest } = await import("./contactApiClient");
    await contactApiRequest("DELETE", "/api/contact/device-token", {
      token: pushToken,
    });
    console.log("[PushNotifications] Token removed from server");
    pushToken = null;
  } catch (error) {
    console.error("[PushNotifications] Failed to remove token from server:", error);
  }
}

/**
 * Register for push notifications (following official Capacitor pattern)
 */
const registerNotifications = async () => {
  console.log("[PushNotifications] 🔐 Checking permissions...");
  
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    console.log("[PushNotifications] 📋 Requesting permissions...");
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== 'granted') {
    console.error("[PushNotifications] ❌ Permission denied");
    showErrorToUser("Push Notification Permission Denied", "User denied permissions!");
    throw new Error("User denied permissions!");
  }

  console.log("[PushNotifications] ✅ Permission granted, registering...");
  await PushNotifications.register();
  console.log("[PushNotifications] ⏳ Waiting for token...");
};

/**
 * Initialize push notifications (call this on app start for contacts)
 * Following official Capacitor pattern
 */
export async function initializePushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log("[PushNotifications] ⏭️  Not native, skipping");
    return;
  }

  console.log("[PushNotifications] 🚀 Initializing push notifications...");
  
  try {
    if (pushToken) {
      console.log("[PushNotifications] ♻️  Token exists, resending to server...");
      await sendTokenToServer(pushToken, getPlatform());
      return;
    }

    if (!listenersAdded) {
      await addListeners();
      listenersAdded = true;
    }

    await registerNotifications();
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[PushNotifications] ❌ Error: ${errorMsg}`);
    
    // Send error to remote server
    sendRemoteLog(`Push Notification Initialization Error\n\nError: ${errorMsg}`, 'error', {
      error: errorMsg,
      platform: getPlatform(),
    });
    
    showErrorToUser("Push Notification Error", `Failed: ${errorMsg}`);
  }
}

/**
 * Show error message to user via toast or alert
 */
function showErrorToUser(title: string, message: string): void {
  console.error(`[PushNotifications] ${title}: ${message}`);
  
  // Dispatch custom event for toast (if toast system is available)
  try {
    window.dispatchEvent(new CustomEvent("pushNotificationError", {
      detail: { title, message }
    }));
  } catch (e) {
    // Fallback to alert
    if (typeof window !== "undefined") {
      alert(`${title}\n\n${message}`);
    }
  }
}

