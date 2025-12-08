# Session Configuration Fix

## Problem
When running the production build (`npm run build` + `npm start`), login appeared to succeed but the user remained on the auth screen. This happened because:

1. The session cookie was configured with `secure: true` in production mode
2. Secure cookies are **only sent over HTTPS connections**
3. When running locally on `http://localhost:5000`, browsers refuse to send secure cookies
4. Without the session cookie, the `/api/auth/me` endpoint returns 401
5. The app thinks the user is not logged in

## Solution
Changed the session cookie configuration to be explicitly controlled by an environment variable instead of automatically enabling secure cookies in production.

### Changes Made

**server/index.ts:**
```javascript
cookie: {
  secure: process.env.COOKIE_SECURE === "true", // Only enable when explicitly set
  httpOnly: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  sameSite: "lax",
}
```

## Configuration

### Development (HTTP)
No environment variable needed - secure cookies are disabled by default:
```bash
npm run dev
```

### Production - Local Testing (HTTP)
Don't set `COOKIE_SECURE`:
```bash
npm run build
npm start
```

### Production - Deployed with HTTPS
Set `COOKIE_SECURE=true`:
```bash
COOKIE_SECURE=true npm start
```

Or in your `.env` file:
```
COOKIE_SECURE=true
```

## Important Notes

1. **Always use `COOKIE_SECURE=true` when deploying to production with HTTPS**
2. **Never use secure cookies over HTTP** - they won't work
3. The `sameSite: "lax"` setting helps prevent CSRF attacks while allowing normal navigation
4. The `httpOnly: true` setting prevents JavaScript from accessing the cookie (security best practice)

## Testing
1. Run production build: `npm run build`
2. Start production server: `npm start`
3. Navigate to `http://localhost:5000`
4. Login should now work correctly
5. Session should persist across page refreshes

