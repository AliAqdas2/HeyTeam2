# Setup Instructions for Job Form Improvements

## Required Packages

To use the improved date/time pickers, location picker, and contact import, you need to install the following packages:

```bash
cd ReactNative/mobile
npm install react-native-modal-datetime-picker @react-native-community/datetimepicker
npm install expo-location
npm install expo-contacts
```

**Note:** `react-native-modal-datetime-picker` is a wrapper around `@react-native-community/datetimepicker` that provides better modal handling and user experience.

## Google Maps API Key

The location picker uses Google Places API for address autocomplete. You need to:

1. Get a Google Maps API key with the following APIs enabled:
   - Places API
   - Geocoding API

2. Add the API key to your environment variables:
   - Create a `.env` file in `ReactNative/mobile/` (if it doesn't exist)
   - Add: `EXPO_PUBLIC_GOOGLE_API_KEY=your_api_key_here`
   - Or set it in your Expo config

## Features Added

### Date/Time Picker
- Native date and time pickers for iOS and Android
- Combined datetime picker for selecting both date and time
- Minimum date validation (prevents selecting past dates)
- Proper iOS modal presentation with Cancel/Done buttons

### Location Picker
- Google Places autocomplete for address suggestions
- Current location button (requires expo-location)
- Manual address entry still supported
- Address suggestions dropdown with formatted addresses

## Contact Import

The contact import feature allows users to import contacts from their device's contact list:

- Uses `expo-contacts` to access device contacts
- Requests contacts permission on first use
- Parses phone numbers and extracts country code separately
- Uses organization's country code as fallback if country code is missing from phone number
- Supports multiple phone numbers per contact (creates separate entries)

### Permissions

- **iOS**: Add `NSContactsUsageDescription` to `app.json`:
  ```json
  {
    "expo": {
      "ios": {
        "infoPlist": {
          "NSContactsUsageDescription": "This app needs access to your contacts to import them into the app."
        }
      }
    }
  }
  ```

- **Android**: Permissions are handled automatically by `expo-contacts`

## Usage

The components are already integrated into:
- `app/admin/jobs/new.tsx` - Create job form
- `app/admin/jobs/[id]/edit.tsx` - Edit job form
- `app/admin/contacts.tsx` - Contacts screen with import functionality

No additional code changes needed once packages are installed!

## Deep Linking (Universal Links / App Links)

Deep linking allows your app to open when users click links to `portal.heyteam.ai`.

### How it Works

When someone clicks a link to `https://portal.heyteam.ai/...`:
- If they have the app installed → App opens
- If they don't have the app → Website opens in browser

### iOS Setup (Universal Links)

1. **Apple Developer Account**: Add the Associated Domains capability to your app.

2. **Create `apple-app-site-association` file**: Host this at `https://portal.heyteam.ai/.well-known/apple-app-site-association`:
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [
         {
           "appID": "YOUR_TEAM_ID.ai.heyteam.app",
           "paths": ["*"]
         }
       ]
     }
   }
   ```
   Replace `YOUR_TEAM_ID` with your Apple Developer Team ID.

3. **Serve with correct headers**:
   - Content-Type: `application/json`
   - No redirects (must be direct)
   - HTTPS required

### Android Setup (App Links)

1. **Create `assetlinks.json` file**: Host this at `https://portal.heyteam.ai/.well-known/assetlinks.json`:
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "ai.heyteam.app",
       "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
     }
   }]
   ```
   Get your SHA256 fingerprint with: `keytool -list -v -keystore your-keystore.jks`

2. **Serve with correct headers**:
   - Content-Type: `application/json`

### Testing Deep Links

```bash
# iOS Simulator
xcrun simctl openurl booted "https://portal.heyteam.ai/admin/dashboard"

# Android Emulator
adb shell am start -a android.intent.action.VIEW -d "https://portal.heyteam.ai/admin/dashboard"
```

### URL Scheme (Fallback)

You can also use the custom scheme `heyteam://`:
```
heyteam://admin/dashboard
heyteam://contact/invitations
```

## Billing / Stripe Integration

The app uses Stripe Checkout for subscriptions:

1. **Subscribe to a plan**: Opens Stripe Checkout in browser
2. **Manage subscription**: Opens Stripe Customer Portal
3. Returns to app after completion

This approach:
- Avoids Apple/Google 30% in-app purchase fees (for B2B apps)
- Uses your existing Stripe integration
- Secure, PCI-compliant payment processing

## Push Notifications

Push notifications are implemented using `expo-notifications` with native APNs (iOS) and FCM (Android) support.

### How It Works

1. **On Login**: Device token is registered with the server
2. **On Logout**: Device token is removed from the server
3. **Background**: Notifications are received even when app is closed
4. **Actions**: Job invitations have Accept/Decline/Maybe buttons

### Required Packages

```bash
cd ReactNative/mobile
npm install expo-notifications expo-device
```

### iOS Configuration

The `app.json` is already configured with:
- `UIBackgroundModes: ["remote-notification"]` for background notifications
- `expo-notifications` plugin

**Additional Requirements:**
1. **Apple Developer Account**: Enable Push Notifications capability
2. **APNs Key**: Create an APNs Auth Key (.p8 file) in Apple Developer Portal
3. **Server Configuration**: Set these environment variables on the server:
   ```
   APNS_KEY_PATH=./AuthKey_XXXXXX.p8
   APNS_KEY_ID=XXXXXX
   APNS_TEAM_ID=XXXXXXXXXX
   APNS_BUNDLE_ID=ai.heyteam.app
   APNS_PRODUCTION=false  # Set to true for production
   ```

### Android Configuration

The `app.json` is already configured with:
- `expo-notifications` plugin with notification icon and color
- Default notification channel

**Additional Requirements:**
1. **Firebase Project**: Create a Firebase project and add Android app
2. **FCM Server Key**: Get from Firebase Console > Project Settings > Cloud Messaging
3. **Server Configuration**: Set these environment variables on the server:
   ```
   FCM_SERVICE_ACCOUNT_PATH=./google-services.json
   # Or use legacy server key:
   FCM_SERVER_KEY=your_server_key
   ```

### Notification Categories

The app registers these notification categories:

**JOB_INVITATION** (iOS):
- Accept button (confirms job)
- Decline button (declines job)
- Maybe button (marks as maybe)

**Android Notification Channels:**
- `job_invitations` - High importance, for job invitations
- `messages` - High importance, for general messages
- `default` - High importance, default channel

### Notification Types

| Type | Description | Actions |
|------|-------------|---------|
| `job_invitation` | New job invitation | Accept, Decline, Maybe |
| `message` | General message | Tap to view |

### Testing Push Notifications

1. **Physical Device Required**: Push notifications don't work in simulators
2. **Build Development Client**: `npx expo run:ios` or `npx expo run:android`
3. **Check Token Registration**: After login, check server logs for `[DeviceToken] Registered`

### Troubleshooting

**iOS:**
- Ensure APNs certificate/key is valid
- Check `APNS_PRODUCTION` matches your build type (false for development)
- Verify bundle ID matches in APNs key and app

**Android:**
- Ensure google-services.json is properly configured
- Check FCM is enabled in Firebase Console
- Verify package name matches

### Assets Required

Create these notification assets if not present:
- `assets/images/notification-icon.png` - Small icon for Android notifications (96x96, transparent PNG)
- `assets/sounds/notification.wav` - Optional custom notification sound

