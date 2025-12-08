# PWA Setup Guide for HeyTeam

## Installation

First, install the required dependency:

```bash
npm install -D vite-plugin-pwa
```

## Icon Generation

You need to create the following icon files and place them in the `attached_assets/pwa/` directory:

### Required Icons (place in `attached_assets/pwa/`):
1. **pwa-192x192.png** - 192x192 pixels (for Android home screen)
2. **pwa-512x512.png** - 512x512 pixels (for Android splash screen and install prompt)
3. **favicon.ico** - Standard favicon
4. **favicon-32x32.png** - 32x32 pixels
5. **favicon-16x16.png** - 16x16 pixels
6. **apple-touch-icon.png** - 180x180 pixels (for iOS home screen)
7. **mask-icon.svg** - SVG icon for Safari (optional but recommended)

### Quick Icon Generation:

You can use online tools like:
- [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [PWA Builder](https://www.pwabuilder.com/imageGenerator)

Or use a simple script to generate from a single source image (recommended size: 1024x1024px).

## Features Included

✅ **Service Worker** - Automatically generated with Workbox
✅ **Offline Support** - Caches static assets and API responses
✅ **App Manifest** - Full PWA manifest with shortcuts
✅ **Auto Update** - Service worker auto-updates when new version is deployed
✅ **Install Prompt** - Users can install the app on their devices
✅ **Standalone Mode** - Runs like a native app when installed

## Testing

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Start the production server:**
   ```bash
   npm start
   ```

3. **Test PWA features:**
   - Open Chrome DevTools → Application → Service Workers (check if registered)
   - Application → Manifest (verify manifest is loaded)
   - Lighthouse → Run PWA audit
   - Try installing on mobile device (Android/iOS)

## Browser Support

- ✅ Chrome/Edge (Android & Desktop)
- ✅ Safari (iOS 11.3+)
- ✅ Firefox (Android)
- ⚠️ Safari (Desktop) - Limited support

## Configuration

The PWA configuration is in `vite.config.ts`. Key settings:

- **registerType**: "autoUpdate" - Service worker updates automatically
- **display**: "standalone" - App runs without browser UI when installed
- **theme_color**: "#0EA5E9" - Matches your app's primary color
- **shortcuts**: Quick access to Jobs, Contacts, and Send Message

## Troubleshooting

### Service Worker Not Registering
- Make sure you're running on HTTPS (or localhost for development)
- Check browser console for errors
- Verify icons are in `attached_assets/pwa/` directory

### App Not Installing
- Ensure all required icons are present
- Check manifest.json is valid (use Lighthouse)
- Verify HTTPS is enabled (required for install)

### Cache Issues
- Clear browser cache
- Unregister service worker in DevTools → Application → Service Workers
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

