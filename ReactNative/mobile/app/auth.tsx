import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
  Modal,
  FlatList,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { saveSessionCookie, clearSessionCookie, saveToken, clearToken, saveUserType } from '@/lib/session';
import { registerDeviceToken } from '@/lib/notifications';
import { useTheme } from '@/lib/theme';

// Country data with flag emoji, name, dial code, and ISO code
const COUNTRIES = [
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷' },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', dialCode: '+32', flag: '🇧🇪' },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹' },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', dialCode: '+358', flag: '🇫🇮' },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪' },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
  { code: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱' },
  { code: 'CZ', name: 'Czech Republic', dialCode: '+420', flag: '🇨🇿' },
  { code: 'GR', name: 'Greece', dialCode: '+30', flag: '🇬🇷' },
  { code: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺' },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷' },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳' },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰' },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾' },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭' },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩' },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳' },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦' },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait', dialCode: '+965', flag: '🇰🇼' },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪' },
  { code: 'GH', name: 'Ghana', dialCode: '+233', flag: '🇬🇭' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽' },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷' },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴' },
  { code: 'PE', name: 'Peru', dialCode: '+51', flag: '🇵🇪' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿' },
  { code: 'IL', name: 'Israel', dialCode: '+972', flag: '🇮🇱' },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', dialCode: '+380', flag: '🇺🇦' },
  { code: 'RO', name: 'Romania', dialCode: '+40', flag: '🇷🇴' },
  { code: 'HU', name: 'Hungary', dialCode: '+36', flag: '🇭🇺' },
];

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
  password: string;
  confirmPassword: string;
};

export default function AuthScreen() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loginForm, setLoginForm] = useState<LoginPayload>({
    email: '',
    password: '',
  });
  const [registerForm, setRegisterForm] = useState<RegisterPayload>({
    username: '',
    firstName: '',
    lastName: '',
    email: '',
    countryCode: 'GB',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const { colors } = useTheme();

  // Get selected country data
  const selectedCountry = useMemo(() => {
    return COUNTRIES.find(c => c.code === registerForm.countryCode) || COUNTRIES[0];
  }, [registerForm.countryCode]);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const search = countrySearch.toLowerCase();
    return COUNTRIES.filter(
      c => c.name.toLowerCase().includes(search) || 
           c.dialCode.includes(search) ||
           c.code.toLowerCase().includes(search)
    );
  }, [countrySearch]);

  const handleChange = useCallback(<T extends object>(
    updater: React.Dispatch<React.SetStateAction<T>>,
    key: keyof T,
    value: string,
  ) => {
    updater((prev) => ({ ...prev, [key]: value }));
  }, []);

  const canSubmit = useMemo(() => {
    if (activeTab === 'login') {
      return loginForm.email.trim() !== '' && loginForm.password.trim() !== '';
    }
    return (
      registerForm.username.trim().length >= 2 &&
      registerForm.firstName.trim() !== '' &&
      registerForm.lastName.trim() !== '' &&
      registerForm.email.trim() !== '' &&
      registerForm.countryCode.trim() !== '' &&
      registerForm.mobileNumber.trim() !== '' &&
      registerForm.password.trim().length >= 6 &&
      registerForm.password === registerForm.confirmPassword
    );
  }, [activeTab, loginForm, registerForm]);

  const formatError = useCallback((e: any, requestInfo?: { url?: string; method?: string; body?: any }): string => {
    console.error('========================================');
    console.error('[Auth] ERROR HANDLER CALLED');
    console.error('========================================');
    console.error('[Auth] Raw Error Object:', e);
    console.error('[Auth] Error Type:', e?.constructor?.name);
    console.error('[Auth] Error Keys:', Object.keys(e || {}));
    
    // Log request information if available
    if (requestInfo) {
      console.error('[Auth] Request URL:', requestInfo.url);
      console.error('[Auth] Request Method:', requestInfo.method);
      console.error('[Auth] Request Body:', requestInfo.body);
      console.error('[Auth] Full Request Object:', requestInfo);
    }
    
    // Try to parse JSON error message
    try {
      const parsed = JSON.parse(e?.message || '{}');
      console.error('[Auth] Parsed Error:', parsed);
      
      // Log all parsed error properties
      console.error('[Auth] Parsed Error Keys:', Object.keys(parsed));
      console.error('[Auth] Parsed Error Message:', parsed.message);
      console.error('[Auth] Parsed Error Name:', parsed.name);
      console.error('[Auth] Error Code:', parsed.errorCode);
      console.error('[Auth] Status:', parsed.status);
      
      // Log connectivity test results
      if (parsed.connectivityTest) {
        console.error('[Auth] Connectivity Test Result:', parsed.connectivityTest);
        console.error('[Auth] Connectivity Test Success:', parsed.connectivityTest.success);
        console.error('[Auth] Connectivity Test Duration:', parsed.connectivityTest.duration + 'ms');
        if (parsed.connectivityTest.error) {
          console.error('[Auth] Connectivity Test Error:', parsed.connectivityTest.error);
        }
      }
      
      // Use the descriptive error message and diagnosis
      let message = '';
      
      // Start with error type
      if (parsed.message) {
        message = parsed.message;
      } else {
        message = 'Request failed';
      }
      
      // Add diagnosis if available (it includes connectivity test results)
      if (parsed.diagnosis) {
        message = parsed.diagnosis;
      } else {
        // Build message from available info
        if (parsed.request?.url) {
          message += ` to ${parsed.request.url}`;
        }
        
        // Add connectivity test results if available
        if (parsed.connectivityTest) {
          const test = parsed.connectivityTest;
          message += '\n\n[Connectivity Test]';
          if (test.success) {
            message += ` PASSED (${test.duration}ms)`;
            message += '\nInternet is working, issue is with the server.';
          } else {
            message += ` FAILED (${test.duration}ms)`;
            message += '\nNo internet connection detected.';
            if (test.error) {
              message += `\nError: ${test.error}`;
            }
          }
        }
        
        // Add error code information
        if (parsed.errorCode) {
          message += `\n\nError Code: ${parsed.errorCode}`;
          if (parsed.errorCode === 'ECONNABORTED' || parsed.errorCode === 'ETIMEDOUT') {
            message += '\nRequest timed out.';
          } else if (parsed.errorCode === 'ENOTFOUND' || parsed.errorCode === 'EAI_AGAIN') {
            message += '\nDNS lookup failed.';
          } else if (parsed.errorCode === 'ECONNREFUSED') {
            message += '\nConnection refused by server.';
          } else if (parsed.errorCode === 'ERR_NETWORK') {
            message += '\nNetwork error occurred.';
          }
        }
      }
      
      // Add request URL for context if not already in message
      if (parsed.request?.url && !message.includes(parsed.request.url)) {
        message = `Failed: ${parsed.request.url}\n\n${message}`;
      }
      
      // Log request details from parsed error
      if (parsed.request) {
        console.error('[Auth] Request from error:', parsed.request);
        console.error('[Auth] Request URL:', parsed.request.url);
        console.error('[Auth] Request Method:', parsed.request.method);
        console.error('[Auth] Request Headers:', parsed.request.headers);
        console.error('[Auth] Request Body:', parsed.request.body);
      }
      
      // Add status code if available
      if (parsed.status) {
        message += ` (HTTP ${parsed.status}${parsed.statusText ? `: ${parsed.statusText}` : ''})`;
      }
      
      // Add error type if available
      if (parsed.name && parsed.name !== 'Error') {
        message += ` [${parsed.name}]`;
      }
      
      // Add URL if available
      if (parsed.url || parsed.request?.url) {
        message += `\nURL: ${parsed.url || parsed.request.url}`;
      }
      
      // Add method if available
      if (parsed.request?.method) {
        message += `\nMethod: ${parsed.request.method}`;
      }
      
      // Add stack trace for debugging (first few lines)
      if (parsed.stack) {
        const stackLines = parsed.stack.split('\n').slice(0, 3).join('\n');
        message += `\n\nStack:\n${stackLines}`;
      }
      
      console.error('[Auth] Formatted Error Message:', message);
      console.error('========================================');
      
      return message;
    } catch (parseError) {
      // If not JSON, format the error object
      console.error('[Auth] Failed to parse error as JSON:', parseError);
      console.error('[Auth] Original error message:', e?.message);
      
      let message = e?.message || 'Request failed';
      
      // Add error name if different
      if (e?.name && e.name !== 'Error') {
        message += ` [${e.name}]`;
      }
      
      // Add string representation if available
      if (e?.toString && e.toString() !== `Error: ${message}`) {
        message += `\n${e.toString()}`;
      }
      
      // Add full error object as JSON for debugging
      try {
        const errorJson = JSON.stringify(e, Object.getOwnPropertyNames(e), 2);
        if (errorJson && errorJson !== '{}') {
          console.error('[Auth] Full Error JSON:', errorJson);
          message += `\n\nFull error:\n${errorJson}`;
        }
      } catch (stringifyError) {
        console.error('[Auth] Failed to stringify error:', stringifyError);
      }
      
      console.error('========================================');
      
      return message;
    }
  }, []);

  const handleLogin = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const requestInfo = {
      url: 'https://portal.heyteam.ai/api/mobile/auth/login',
      method: 'POST',
      body: loginForm,
    };
    try {
      const data = await apiFetch<any>('/api/mobile/auth/login', {
        method: 'POST',
        body: loginForm,
      });

      if (data?._sessionCookie) await saveSessionCookie(data._sessionCookie);
      else await clearSessionCookie();

      if (data?.token) await saveToken(data.token);
      else await clearToken();

      // Save user type for later use
      const userType = data?.type === 'contact' ? 'contact' : 'admin';
      await saveUserType(userType);

      setSuccess('Login successful');

      // Register device for push notifications (for contacts)
      // Do this after saving session so API calls are authenticated
      if (data?.type === 'contact') {
        // Register in background, don't block navigation
        registerDeviceToken().catch((err) => {
          console.log('[Auth] Failed to register device token:', err);
        });
        router.replace('/contact/dashboard');
      } else {
        router.replace('/admin/dashboard');
      }
    } catch (e: any) {
      setError(formatError(e, requestInfo));
    } finally {
      setLoading(false);
    }
  }, [loginForm, formatError]);

  const handleRegister = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const requestInfo = {
      url: 'https://portal.heyteam.ai/api/mobile/auth/register',
      method: 'POST',
      body: registerForm,
    };
    try {
      const reg = await apiFetch<any>('/api/mobile/auth/register', {
        method: 'POST',
        body: registerForm,
      });

      if (reg?.token) await saveToken(reg.token);
      if (reg?._sessionCookie) await saveSessionCookie(reg._sessionCookie);

      setSuccess('Registration successful');
      setActiveTab('login');
    } catch (e: any) {
      setError(formatError(e, requestInfo));
    } finally {
      setLoading(false);
    }
  }, [registerForm, formatError]);

  const handleOpenLink = useCallback(async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Failed to open link:', error);
    }
  }, []);

  const renderInput = (
    label: string,
    value: string,
    onChange: (text: string) => void,
    secure = false,
    keyboardType: 'default' | 'email-address' | 'phone-pad' = 'default',
    toggleSecure?: () => void,
    isPasswordVisible?: boolean,
  ) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputWrapper, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          style={[styles.input, { color: colors.inputText }]}
          secureTextEntry={secure && !(isPasswordVisible ?? false)}
          autoCapitalize="none"
          keyboardType={keyboardType}
          placeholderTextColor={colors.placeholder}
        />
        {secure && toggleSecure && (
          <TouchableOpacity style={styles.eyeButton} onPress={toggleSecure}>
            <Ionicons name={(isPasswordVisible ?? false) ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.icon} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Image source={require('@/assets/images/splash-icon.png')} style={styles.logo} />
          <Text style={[styles.heading, { color: colors.text }]}>{activeTab === 'login' ? 'Sign in' : 'Sign up'}</Text>
          <Text style={[styles.subheading, { color: colors.textTertiary }]}>
            {activeTab === 'login'
              ? 'Welcome back! Please enter your details'
              : 'Create an account to continue'}
          </Text>

          {error && (
            <ScrollView 
              style={[styles.errorContainer, { backgroundColor: colors.error + '20' }]}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <Text 
                style={[styles.error, { color: colors.error }]}
                selectable
              >
                {error}
              </Text>
            </ScrollView>
          )}
          {success && <Text style={[styles.success, { color: colors.success }]}>{success}</Text>}

          {activeTab === 'login' ? (
            <>
              {renderInput('Email Address', loginForm.email, (t) => handleChange(setLoginForm, 'email', t), false, 'email-address')}
              {renderInput('Password', loginForm.password, (t) => handleChange(setLoginForm, 'password', t), true, 'default', () => setShowPassword((p) => !p), showPassword)}
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }, !canSubmit || loading ? styles.buttonDisabled : null]}
                disabled={!canSubmit || loading}
                onPress={handleLogin}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
              </TouchableOpacity>
              <Text style={[styles.footerText, { color: colors.textTertiary }]}>
                Don't have an account?{' '}
                <Text style={[styles.linkText, { color: colors.primaryText }]} onPress={() => setActiveTab('register')}>
                  Sign up
                </Text>
              </Text>
              <View style={styles.legalLinks}>
                <Text style={[styles.legalText, { color: colors.textTertiary }]}>
                  By signing in, you agree to our{' '}
                  <Text style={[styles.legalLink, { color: colors.primaryText }]} onPress={() => handleOpenLink('https://heyteam.ai/termsandconditions')}>
                    Terms and Conditions
                  </Text>
                  {' '}and{' '}
                  <Text style={[styles.legalLink, { color: colors.primaryText }]} onPress={() => handleOpenLink('https://heyteam.ai/privacypolicy')}>
                    Privacy Policy
                  </Text>
                </Text>
              </View>
            </>
          ) : (
            <>
              {renderInput('Company name', registerForm.username, (t) => handleChange(setRegisterForm, 'username', t))}
              {renderInput('First name', registerForm.firstName, (t) => handleChange(setRegisterForm, 'firstName', t))}
              {renderInput('Last name', registerForm.lastName, (t) => handleChange(setRegisterForm, 'lastName', t))}
              {renderInput('Email', registerForm.email, (t) => handleChange(setRegisterForm, 'email', t), false, 'email-address')}
              
              {/* Phone number with country picker */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Mobile number</Text>
                <View style={styles.phoneRow}>
                  {/* Country code picker button */}
                  <TouchableOpacity
                    style={[styles.countryPickerButton, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
                    onPress={() => setShowCountryPicker(true)}
                  >
                    <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                    <Text style={[styles.countryDialCode, { color: colors.inputText }]}>{selectedCountry.dialCode}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.icon} />
                  </TouchableOpacity>
                  
                  {/* Phone number input */}
                  <View style={[styles.phoneInputWrapper, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
                    <TextInput
                      value={registerForm.mobileNumber}
                      onChangeText={(t) => handleChange(setRegisterForm, 'mobileNumber', t)}
                      style={[styles.input, { color: colors.inputText }]}
                      keyboardType="phone-pad"
                      placeholder="Phone number"
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                </View>
              </View>
              {renderInput('Password', registerForm.password, (t) => handleChange(setRegisterForm, 'password', t), true, 'default', () => setShowRegisterPassword((p) => !p), showRegisterPassword)}
              {renderInput('Confirm password', registerForm.confirmPassword, (t) => handleChange(setRegisterForm, 'confirmPassword', t), true, 'default', () => setShowConfirmPassword((p) => !p), showConfirmPassword)}
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }, !canSubmit || loading ? styles.buttonDisabled : null]}
                disabled={!canSubmit || loading}
                onPress={handleRegister}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create account</Text>}
              </TouchableOpacity>
              <Text style={[styles.footerText, { color: colors.textTertiary }]}>
                Already have an account?{' '}
                <Text style={[styles.linkText, { color: colors.primaryText }]} onPress={() => setActiveTab('login')}>
                  Sign in
                </Text>
              </Text>
              <View style={styles.legalLinks}>
                <Text style={[styles.legalText, { color: colors.textTertiary }]}>
                  By creating an account, you agree to our{' '}
                  <Text style={[styles.legalLink, { color: colors.primaryText }]} onPress={() => handleOpenLink('https://heyteam.ai/termsandconditions')}>
                    Terms and Conditions
                  </Text>
                  {' '}and{' '}
                  <Text style={[styles.legalLink, { color: colors.primaryText }]} onPress={() => handleOpenLink('https://heyteam.ai/privacypolicy')}>
                    Privacy Policy
                  </Text>
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {/* Search input */}
            <View style={[styles.searchInputWrapper, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
              <Ionicons name="search" size={18} color={colors.placeholder} style={styles.searchIcon} />
              <TextInput
                value={countrySearch}
                onChangeText={setCountrySearch}
                placeholder="Search country..."
                placeholderTextColor={colors.placeholder}
                style={[styles.searchInput, { color: colors.inputText }]}
                autoCapitalize="none"
              />
              {countrySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCountrySearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.placeholder} />
                </TouchableOpacity>
              )}
            </View>

            {/* Country list */}
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              style={styles.countryList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    item.code === registerForm.countryCode && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => {
                    handleChange(setRegisterForm, 'countryCode', item.code);
                    setShowCountryPicker(false);
                    setCountrySearch('');
                  }}
                >
                  <Text style={styles.countryItemFlag}>{item.flag}</Text>
                  <View style={styles.countryItemInfo}>
                    <Text style={[styles.countryItemName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.countryItemDialCode, { color: colors.textTertiary }]}>{item.dialCode}</Text>
                  </View>
                  {item.code === registerForm.countryCode && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[styles.noResults, { color: colors.textTertiary }]}>No countries found</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 12, paddingVertical: 24, flexGrow: 1, justifyContent: 'center' },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 14,
    alignSelf: 'stretch',
    width: '100%',
  },
  logo: {
    width: 300,
    height: 120,
    alignSelf: 'center',
    marginBottom: 6,
    resizeMode: 'contain',
  },
  heading: { fontSize: 32, fontWeight: '700' },
  subheading: { fontSize: 16, marginTop: -6 },
  inputGroup: { marginBottom: 12 },
  label: { fontWeight: '700', marginBottom: 6, fontSize: 14 },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 10,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -12,
    padding: 4,
  },
  button: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#1cd0c9',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  errorContainer: {
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    maxHeight: 300,
  },
  error: { 
    marginBottom: 0, 
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },
  success: { marginBottom: 4, fontWeight: '700' },
  footerText: { marginTop: 8, textAlign: 'center' },
  linkText: { fontWeight: '700' },
  legalLinks: { marginTop: 12, paddingHorizontal: 8 },
  legalText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  legalLink: { fontWeight: '700', textDecorationLine: 'underline' },
  // Phone input with country picker
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 10,
    gap: 6,
    minWidth: 100,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryDialCode: {
    fontSize: 15,
    fontWeight: '500',
  },
  phoneInputWrapper: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
  },
  // Country picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: 4,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  countryList: {
    flex: 1,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  countryItemFlag: {
    fontSize: 24,
  },
  countryItemInfo: {
    flex: 1,
  },
  countryItemName: {
    fontSize: 15,
    fontWeight: '500',
  },
  countryItemDialCode: {
    fontSize: 13,
    marginTop: 2,
  },
  noResults: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 15,
  },
});

