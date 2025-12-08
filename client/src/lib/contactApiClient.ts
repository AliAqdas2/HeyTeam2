/**
 * Contact Portal API Client
 * Handles all API requests for the contact portal using X-Contact-ID header
 */

import { Capacitor } from "@capacitor/core";

const CONTACT_ID_KEY = "heyteam_contact_id";

/**
 * Get the API base URL
 * For native apps, use the production URL
 * For web, use relative URLs (will be proxied by Vite)
 */
function getApiBaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    // For native apps, use the production API URL
    return "https://portal.heyteam.ai";
  }
  // For web, use relative URLs (Vite will proxy them)
  return "";
}

/**
 * Get stored contact ID from localStorage
 */
export function getContactId(): string | null {
  if (typeof window === "undefined") return null;
  const contactId = localStorage.getItem(CONTACT_ID_KEY);
  console.log("[ContactAPI] Retrieved contactId from storage:", contactId);
  return contactId;
}

/**
 * Store contact ID in localStorage
 */
export function setContactId(contactId: string): void {
  if (typeof window === "undefined") return;
  console.log("[ContactAPI] Storing contactId:", contactId);
  localStorage.setItem(CONTACT_ID_KEY, contactId);
  // Verify it was stored
  const stored = localStorage.getItem(CONTACT_ID_KEY);
  console.log("[ContactAPI] Verified stored contactId:", stored);
}

/**
 * Remove contact ID from localStorage
 */
export function removeContactId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CONTACT_ID_KEY);
}

/**
 * Make an authenticated API request for contact portal
 */
export async function contactApiRequest(
  method: string,
  endpoint: string,
  data?: unknown
): Promise<Response> {
  const contactId = getContactId();
  
  if (!contactId) {
    throw new Error("Not authenticated. Please log in.");
  }

  const baseUrl = getApiBaseUrl();
  const fullUrl = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Contact-ID": contactId,
  };

  const config: RequestInit = {
    method,
    headers,
    credentials: "include",
  };

  if (data && (method === "POST" || method === "PATCH" || method === "PUT")) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(fullUrl, config);

  // Handle 401 unauthorized - clear contact ID and throw
  if (response.status === 401) {
    removeContactId();
    throw new Error("UNAUTHORIZED");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Request failed with status ${response.status}`);
  }

  return response;
}

/**
 * Query function for React Query that uses contact API
 */
export const getContactQueryFn = async <T>({ queryKey }: { queryKey: string[] }): Promise<T> => {
  const contactId = getContactId();
  
  if (!contactId) {
    const error = new Error("UNAUTHORIZED") as any;
    error.status = 401;
    throw error;
  }

  const baseUrl = getApiBaseUrl();
  const endpoint = queryKey.join("/");
  const fullUrl = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;
  
  console.log("[ContactAPI] Making request to:", fullUrl);
  console.log("[ContactAPI] Using contactId:", contactId);
  
  try {
    const response = await fetch(fullUrl, {
      headers: {
        "X-Contact-ID": contactId,
      },
      credentials: "include",
    });
    
    console.log("[ContactAPI] Response status:", response.status);

    if (response.status === 401) {
      removeContactId();
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

    return await response.json();
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
};

