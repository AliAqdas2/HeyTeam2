import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { getSessionCookie, getToken } from './session';

const BASE_URL = 'https://portal.heyteam.ai';
const CONNECTIVITY_TEST_URL = 'https://httpbin.org/get';

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
};

type ConnectivityTestResult = {
  success: boolean;
  duration: number;
  error?: string;
  statusCode?: number;
  message?: string;
};

/**
 * Test network connectivity by making a request to httpbin.org
 * This helps diagnose if the issue is general connectivity or specific to the API server
 */
async function testConnectivity(): Promise<ConnectivityTestResult> {
  const startTime = Date.now();
  try {
    console.log('[Connectivity Test] Testing connection to httpbin.org...');
    const response = await axios.get(CONNECTIVITY_TEST_URL, {
      timeout: 10000, // 10 second timeout
    });
    const duration = Date.now() - startTime;
    console.log('[Connectivity Test] SUCCESS:', {
      status: response.status,
      duration: `${duration}ms`,
    });
    return {
      success: true,
      duration,
      statusCode: response.status,
      message: 'Internet connection is working',
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error?.message || 'Unknown error';
    const statusCode = error?.response?.status;
    
    console.error('[Connectivity Test] FAILED:', {
      error: errorMessage,
      statusCode,
      duration: `${duration}ms`,
    });
    
    return {
      success: false,
      duration,
      error: errorMessage,
      statusCode,
      message: 'Internet connection test failed',
    };
  }
}

export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  const cookie = await getSessionCookie();
  const token = await getToken();
  
  const url = `${BASE_URL}${path}`;
  const method = options.method || 'GET';
  const headers = {
      'Content-Type': 'application/json',
    'Host': 'portal.heyteam.ai',  // Explicitly set Host header for SNI support
    'Accept': 'application/json',
      ...(options.headers || {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  
  // Store request details for error logging
  const requestDetails = {
    url,
    method,
    headers: {
      ...headers,
      // Mask sensitive headers for logging
      ...(cookie ? { Cookie: '***masked***' } : {}),
      ...(token ? { Authorization: 'Bearer ***masked***' } : {}),
    },
    body: options.body,
  };
  
  try {
    console.log('[apiFetch] Making request:', {
      url,
      method,
      headers: requestDetails.headers,
      hasBody: !!options.body,
    });
    
    // Configure axios request with better SSL/TLS compatibility
    const axiosConfig: AxiosRequestConfig = {
      method: method.toLowerCase() as any,
      url,
      headers,
      data: options.body,
      timeout: 30000, // 30 second timeout
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors, we'll handle them
      maxRedirects: 5,
      decompress: true,
    };
    
    const response = await axios(axiosConfig);
    
    console.log('[apiFetch] Response received:', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    
    // Handle non-OK responses
    if (response.status >= 400) {
    let errorMessage = 'Request failed';
    try {
        const data = response.data;
        if (typeof data === 'string') {
          try {
            const json = JSON.parse(data);
      errorMessage = json.message || json.error || errorMessage;
    } catch {
            errorMessage = data || errorMessage;
          }
        } else if (data && typeof data === 'object') {
          errorMessage = data.message || data.error || errorMessage;
    }
      } catch {
        // Use default error message
      }
      
      const errorDetails = {
        message: errorMessage,
        status: response.status,
        statusText: response.statusText,
        url: `${BASE_URL}${path}`,
        request: requestDetails,
      };
      const fullError = JSON.stringify(errorDetails, null, 2);
      console.error('[apiFetch] HTTP error:', fullError);
      console.error('[apiFetch] Request details:', requestDetails);
      throw new Error(fullError);
  }

  // Handle 204 No Content responses
    if (response.status === 204) {
    return undefined as T;
  }

    // Return response data
    return response.data as T;
  } catch (error: any) {
    // Check if it's an Axios error
    const isAxiosError = error?.isAxiosError || error instanceof axios.AxiosError;
    let axiosError: AxiosError | null = null;
    
    if (isAxiosError) {
      axiosError = error as AxiosError;
    }
    
    // Run connectivity test automatically
    console.log('[apiFetch] Network error detected, running connectivity test...');
    const connectivityTest = await testConnectivity();
    
    // Extract error details
    const errorMessage = axiosError?.message || error?.message || 'Network request failed';
    const errorCode = axiosError?.code;
    const responseStatus = axiosError?.response?.status;
    const responseData = axiosError?.response?.data;
    
    // Build descriptive error message
    let errorDiagnosis = '';
    let errorType = 'Unknown Error';
    
    if (axiosError) {
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        errorType = 'Timeout Error';
        errorDiagnosis = `Request to ${url} timed out after 30 seconds.`;
      } else if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'EAI_AGAIN') {
        errorType = 'DNS Error';
        errorDiagnosis = `Cannot resolve domain for ${url}. DNS lookup failed.`;
      } else if (axiosError.code === 'ECONNREFUSED') {
        errorType = 'Connection Refused';
        errorDiagnosis = `Connection to ${url} was refused. The server may be down.`;
      } else if (axiosError.code === 'ERR_NETWORK' || axiosError.code === 'NETWORK_ERROR') {
        errorType = 'Network Error';
        errorDiagnosis = `Network error connecting to ${url}.`;
      } else if (responseStatus) {
        errorType = 'HTTP Error';
        errorDiagnosis = `HTTP ${responseStatus} error from ${url}.`;
      } else {
        errorType = 'Request Error';
        errorDiagnosis = `Request to ${url} failed: ${errorMessage}`;
      }
    } else {
      errorType = 'Unknown Error';
      errorDiagnosis = `Request to ${url} failed: ${errorMessage}`;
    }
    
    // Add connectivity test results to diagnosis
    if (connectivityTest.success) {
      errorDiagnosis += `\n\n[Connectivity Test: PASSED]`;
      errorDiagnosis += `\nInternet connection is working (${connectivityTest.duration}ms).`;
      errorDiagnosis += `\nThis suggests the issue is specific to ${url}:`;
      errorDiagnosis += `\n• Server may be down or unreachable`;
      errorDiagnosis += `\n• DNS issue with this specific domain`;
      errorDiagnosis += `\n• Firewall blocking this specific server`;
      errorDiagnosis += `\n• SSL/certificate issue with this server`;
    } else {
      errorDiagnosis += `\n\n[Connectivity Test: FAILED]`;
      errorDiagnosis += `\nInternet connection test also failed (${connectivityTest.duration}ms).`;
      errorDiagnosis += `\nThis suggests a general network problem:`;
      errorDiagnosis += `\n• No internet connection`;
      errorDiagnosis += `\n• Network is down or restricted`;
      errorDiagnosis += `\n• Device is in airplane mode`;
      errorDiagnosis += `\n• Firewall blocking all outbound connections`;
  }

    // Build detailed error object
    const detailedError = {
      message: errorType,
      diagnosis: errorDiagnosis,
      originalMessage: errorMessage,
      errorCode: errorCode,
      name: axiosError?.name || error?.name || 'NetworkError',
      status: responseStatus,
      statusText: axiosError?.response?.statusText,
      responseData: responseData,
      request: requestDetails,
      connectivityTest: connectivityTest,
      timestamp: new Date().toISOString(),
    };
    
    // Log detailed error information
    console.error('========================================');
    console.error('[apiFetch] NETWORK ERROR DETECTED');
    console.error('========================================');
    console.error('[apiFetch] Error Type:', errorType);
    console.error('[apiFetch] Error Message:', errorMessage);
    console.error('[apiFetch] Error Code:', errorCode);
    console.error('[apiFetch] Is Axios Error:', isAxiosError);
    console.error('[apiFetch] Response Status:', responseStatus);
    console.error('[apiFetch] Request URL:', url);
    console.error('[apiFetch] Request Method:', method);
    console.error('[apiFetch] Request Headers:', requestDetails.headers);
    console.error('[apiFetch] Request Body:', requestDetails.body);
    console.error('[apiFetch] Connectivity Test Result:', connectivityTest);
    console.error('[apiFetch] Error Details (JSON):', JSON.stringify(detailedError, null, 2));
    if (axiosError?.stack) {
      console.error('[apiFetch] Stack Trace:', axiosError.stack);
  }
    console.error('========================================');
    
    const fullError = JSON.stringify(detailedError, null, 2);
    throw new Error(fullError);
  }
}
