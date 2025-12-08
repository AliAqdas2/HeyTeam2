import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { getUserId } from "./userIdStorage";
import { getContactId } from "./contactApiClient";

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
 * Get authentication headers for mobile apps
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (Capacitor.isNativePlatform()) {
    // For native apps, check for userId or contactId
    const userId = getUserId();
    const contactId = getContactId();
    
    if (userId) {
      headers["X-User-ID"] = userId;
      console.log("[QueryClient] Adding X-User-ID header:", userId);
    } else if (contactId) {
      headers["X-Contact-ID"] = contactId;
      console.log("[QueryClient] Adding X-Contact-ID header:", contactId);
    }
  }
  
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // For native apps, prepend base URL if URL is relative
  const baseUrl = getApiBaseUrl();
  const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
  
  // Get auth headers for mobile apps
  const authHeaders = getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(data ? { "Content-Type": "application/json" } : {}),
  };
  
  console.log("[QueryClient] apiRequest to:", fullUrl, "with headers:", headers);
  
  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const endpoint = queryKey.join("/") as string;
    const isMobile = Capacitor.isNativePlatform();
    
    // For mobile apps, if this is /api/auth/me and we have userId, use mobile endpoint
    if (isMobile && endpoint === "/api/auth/me") {
      const userId = getUserId();
      if (userId) {
        // Use mobile endpoint with X-User-ID header
        const baseUrl = getApiBaseUrl();
        const fullUrl = `${baseUrl}/api/mobile/auth/me`;
        const authHeaders = { "X-User-ID": userId };
        
        console.log("[QueryClient] getQueryFn (mobile auth/me) to:", fullUrl, "with headers:", authHeaders);
        
        const res = await fetch(fullUrl, {
          headers: authHeaders,
          credentials: "include",
        });

        if (unauthorizedBehavior === "returnNull" && res.status === 401) {
          // Clear userId on 401
          const { removeUserId } = await import("./userIdStorage");
          removeUserId();
          return null;
        }

        if (res.status === 401) {
          // Clear userId on 401
          const { removeUserId } = await import("./userIdStorage");
          removeUserId();
        }

        await throwIfResNotOk(res);
        return await res.json();
      } else {
        // No userId on mobile - return null or throw based on behavior
        if (unauthorizedBehavior === "returnNull") {
          return null;
        }
        throw new Error("UNAUTHORIZED");
      }
    }
    
    // For native apps, prepend base URL if endpoint is relative
    const baseUrl = getApiBaseUrl();
    const fullUrl = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;
    
    // Get auth headers for mobile apps
    const authHeaders = getAuthHeaders();
    
    console.log("[QueryClient] getQueryFn to:", fullUrl, "with headers:", authHeaders);
    
    const res = await fetch(fullUrl, {
      headers: authHeaders,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      // Clear auth IDs on 401 for mobile
      if (isMobile) {
        const { removeUserId } = await import("./userIdStorage");
        const { removeContactId } = await import("./contactApiClient");
        removeUserId();
        removeContactId();
      }
      return null;
    }

    if (res.status === 401 && isMobile) {
      // Clear auth IDs on 401 for mobile
      const { removeUserId } = await import("./userIdStorage");
      const { removeContactId } = await import("./contactApiClient");
      removeUserId();
      removeContactId();
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // Make data feel live across the app instead of staying indefinitely stale.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: "always",
      staleTime: 0,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
