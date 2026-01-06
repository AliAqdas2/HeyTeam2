import AsyncStorage from '@react-native-async-storage/async-storage';

const COOKIE_KEY = 'heyteam.session.cookie';
const TOKEN_KEY = 'heyteam.session.token';
const PUSH_TOKEN_KEY = 'heyteam.push.token';
const USER_TYPE_KEY = 'heyteam.user.type';

export async function saveSessionCookie(cookie: string) {
  try {
    await AsyncStorage.setItem(COOKIE_KEY, cookie);
  } catch (e) {
    console.warn('[session] Failed to save cookie', e);
  }
}

export async function getSessionCookie() {
  try {
    return await AsyncStorage.getItem(COOKIE_KEY);
  } catch (e) {
    console.warn('[session] Failed to read cookie', e);
    return null;
  }
}

export async function clearSessionCookie() {
  try {
    await AsyncStorage.removeItem(COOKIE_KEY);
  } catch (e) {
    console.warn('[session] Failed to clear cookie', e);
  }
}

export async function saveToken(token: string) {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.warn('[session] Failed to save token', e);
  }
}

export async function getToken() {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (e) {
    console.warn('[session] Failed to read token', e);
    return null;
  }
}

export async function clearToken() {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.warn('[session] Failed to clear token', e);
  }
}

// Push token management
export async function savePushToken(token: string) {
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  } catch (e) {
    console.warn('[session] Failed to save push token', e);
  }
}

export async function getPushToken() {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch (e) {
    console.warn('[session] Failed to read push token', e);
    return null;
  }
}

export async function clearPushToken() {
  try {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch (e) {
    console.warn('[session] Failed to clear push token', e);
  }
}

// User type management (contact vs admin)
export async function saveUserType(type: 'contact' | 'admin') {
  try {
    await AsyncStorage.setItem(USER_TYPE_KEY, type);
  } catch (e) {
    console.warn('[session] Failed to save user type', e);
  }
}

export async function getUserType(): Promise<'contact' | 'admin' | null> {
  try {
    const type = await AsyncStorage.getItem(USER_TYPE_KEY);
    return type as 'contact' | 'admin' | null;
  } catch (e) {
    console.warn('[session] Failed to read user type', e);
    return null;
  }
}

export async function clearUserType() {
  try {
    await AsyncStorage.removeItem(USER_TYPE_KEY);
  } catch (e) {
    console.warn('[session] Failed to clear user type', e);
  }
}

// Clear all session data
export async function clearAllSessionData() {
  await Promise.all([
    clearSessionCookie(),
    clearToken(),
    clearPushToken(),
    clearUserType(),
  ]);
}
