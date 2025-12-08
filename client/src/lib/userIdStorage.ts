/**
 * User ID Storage for Mobile Apps
 * Handles storing and retrieving userId for mobile authentication
 */

import { Capacitor } from "@capacitor/core";

const USER_ID_KEY = "heyteam_user_id";

/**
 * Get stored user ID from localStorage
 */
export function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  const userId = localStorage.getItem(USER_ID_KEY);
  console.log("[UserIdStorage] Retrieved userId from storage:", userId);
  return userId;
}

/**
 * Store user ID in localStorage
 */
export function setUserId(userId: string): void {
  if (typeof window === "undefined") return;
  console.log("[UserIdStorage] Storing userId:", userId);
  localStorage.setItem(USER_ID_KEY, userId);
  // Verify it was stored
  const stored = localStorage.getItem(USER_ID_KEY);
  console.log("[UserIdStorage] Verified stored userId:", stored);
}

/**
 * Remove user ID from localStorage
 */
export function removeUserId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_ID_KEY);
}

/**
 * Get the API base URL
 * For native apps, use the production URL
 * For web, use relative URLs (will be proxied by Vite)
 */
function getApiBaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return "https://portal.heyteam.ai";
  }
  return "";
}

/**
 * Query function for React Query that uses mobile user API
 * For mobile users, uses /api/mobile/auth/me with X-User-ID header
 */
export const getUserQueryFn = async <T>({ queryKey }: { queryKey: string[] }): Promise<T> => {
  const userId = getUserId();
  const isMobile = Capacitor.isNativePlatform();
  
  // For mobile apps, we MUST have userId
  if (isMobile) {
    if (!userId) {
      console.error("[UserAPI] No userId found for mobile request!");
      const error = new Error("UNAUTHORIZED") as any;
      error.status = 401;
      throw error;
    }
    
    const baseUrl = getApiBaseUrl();
    const endpoint = "/api/mobile/auth/me";
    const fullUrl = `${baseUrl}${endpoint}`;
    
    console.log("[UserAPI] Making mobile request to:", fullUrl);
    console.log("[UserAPI] Using userId:", userId);
    
    try {
      const response = await fetch(fullUrl, {
        headers: {
          "X-User-ID": userId,
        },
        credentials: "include",
      });
      
      console.log("[UserAPI] Response status:", response.status);

      if (response.status === 401) {
        console.log("[UserAPI] 401 response - clearing userId");
        removeUserId();
        const error = new Error("UNAUTHORIZED") as any;
        error.status = 401;
        throw error;
      }

      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If JSON parsing fails, use default message
        }
        const error = new Error(errorMessage) as any;
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      console.log("[UserAPI] Successfully fetched user data");
      return data;
    } catch (error: any) {
      // If it's already an error we created, re-throw it
      if (error.status === 401 || error.message === "UNAUTHORIZED") {
        throw error;
      }
      // For network errors, wrap them
      const wrappedError = new Error(error.message || "Network error") as any;
      wrappedError.status = error.status || 0;
      throw wrappedError;
    }
  }
  
  // For web or when no userId, use regular endpoint (will be handled by default queryFn)
  const baseUrl = getApiBaseUrl();
  const endpoint = queryKey.join("/");
  const fullUrl = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;
  
  const response = await fetch(fullUrl, {
    credentials: "include",
  });

  if (response.status === 401) {
    return null as T;
  }

  if (!response.ok) {
    const text = (await response.text()) || response.statusText;
    throw new Error(`${response.status}: ${text}`);
  }

  return await response.json();
};

