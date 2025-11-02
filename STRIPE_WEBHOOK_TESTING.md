# Stripe Webhook Testing Guide

## Issue: Subscription Not Activating After Checkout

When you complete a Stripe checkout, the subscription should activate via webhooks. Here's how to troubleshoot and test.

---

## ✅ What I Fixed

### 1. Billing Page - Session Callback Handler

**Added** a `useEffect` hook to handle the `session_id` query parameter when returning from Stripe:

```typescript
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  
  if (sessionId) {
    // Show success message
    toast({
      title: "Subscription Successful!",
      description: "Your subscription has been activated. Credits will be added shortly.",
    });
    
    // Clean up URL
    window.history.replaceState({}, '', '/billing');
    
    // Refresh subscription and credits data
    queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
    queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
  }
}, [toast]);
```

**What this does:**
- ✅ Detects when user returns from Stripe checkout
- ✅ Shows success notification
- ✅ Cleans up URL (removes `session_id`)
- ✅ Refreshes subscription and credits from server

---

## How Stripe Webhooks Work

### Flow:

1. **User clicks "Select Plan"** → Redirected to Stripe Checkout
2. **User completes payment** → Stripe processes payment
3. **Stripe sends webhook** to `/api/stripe/webhook`
4. **Webhook handler processes event**:
   - `checkout.session.completed` - Updates subscription
   - `invoice.payment_succeeded` - Grants credits
   - `customer.subscription.updated` - Updates status
5. **User redirected back** to `/billing?session_id=cs_test_...`
6. **Billing page shows success** and refreshes data

---

## Testing Locally

### If You Have a Public Domain/URL

If your local server is accessible via a **public domain** or **global URL** (e.g., through a tunnel service, reverse proxy, or VPS), you can use your Stripe Dashboard webhook directly:

1. **Your webhook URL should be:** `https://yourdomain.com/api/stripe/webhook`
2. **Add the webhook secret to `.env`:**
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
   ```
3. **Restart your app** and test!

✅ **This is the preferred method if you have a public URL!**

---

### If You're Running on Pure Localhost

Stripe can't reach `localhost` directly. You have **3 options**:

### Option 1: Use Stripe CLI (Recommended for Local Testing)

1. **Install Stripe CLI:**
   ```bash
   # Windows (using Scoop)
   scoop install stripe
   
   # Or download from: https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe:**
   ```bash
   stripe login
   ```

3. **Forward webhooks to localhost:**
   ```bash
   stripe listen --forward-to localhost:5000/api/stripe/webhook
   ```

4. **Copy the webhook signing secret:**
   ```
   > Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
   ```

5. **Add to .env:**
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

6. **Restart your app:**
   ```bash
   npm run dev
   ```

7. **Test a payment** - webhooks will now work locally!

---

### Option 2: Use ngrok

1. **Install ngrok:**
   ```bash
   # Download from https://ngrok.com/download
   ```

2. **Start your app:**
   ```bash
   npm run dev
   ```

3. **Start ngrok:**
   ```bash
   ngrok http 5000
   ```

4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

5. **Configure Stripe webhook:**
   - Go to https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - URL: `https://abc123.ngrok.io/api/stripe/webhook`
   - Events: Select all checkout and subscription events

6. **Get webhook secret** from Stripe dashboard

7. **Add to .env:**
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

---

### Option 3: Deploy to Server

Deploy your app to a server with HTTPS, then configure the webhook URL in Stripe dashboard.

---

## Webhook Events

The app listens for these Stripe events:

### `checkout.session.completed`
- **Triggered:** Payment successful
- **Action:** Updates subscription, grants initial credits

### `invoice.payment_succeeded`
- **Triggered:** Recurring payment or one-time payment
- **Action:** Grants credits for renewal period

### `customer.subscription.updated`
- **Triggered:** Subscription changes
- **Action:** Updates subscription status

### `customer.subscription.deleted`
- **Triggered:** Subscription cancelled
- **Action:** Marks subscription as cancelled

---

## Checking Webhook Status

### In Stripe Dashboard:

1. Go to **Developers → Webhooks**
2. Click on your webhook endpoint
3. View **Recent events** tab
4. Check for:
   - ✅ Green checkmarks = Success
   - ❌ Red X = Failed (click to see error)

### In Your App Logs:

When webhook is received, you should see:
```
POST /api/stripe/webhook 200 in XXms
Granted XXX credits to user XXX for subscription XXX
```

---

## Common Issues

### 1. "Stripe not configured"
**Solution:** Set `STRIPE_SECRET_KEY` in `.env`

### 2. "Webhook signature verification failed"
**Solution:** 
- Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- For Stripe CLI, use the secret from `stripe listen` command

### 3. "Subscription not found in database"
**Solution:**
- Database might not be updated yet
- Check webhook arrived before redirect
- Wait a few seconds and refresh the page

### 4. Credits not granted
**Solution:**
- Check webhook logs in Stripe dashboard
- Look for `invoice.payment_succeeded` event
- Check server logs for errors

### 5. "No session_id in URL"
**Possible causes:**
- Stripe redirect failed
- Payment was cancelled
- Wrong `success_url` configuration

---

## Testing Checklist

- [ ] `.env` has `STRIPE_SECRET_KEY` (test key: `sk_test_...`)
- [ ] `.env` has `STRIPE_WEBHOOK_SECRET`
- [ ] Stripe CLI is running (`stripe listen --forward-to ...`)
- [ ] App is running (`npm run dev`)
- [ ] Can access billing page at `/billing`
- [ ] Can click "Select Plan" and reach Stripe checkout
- [ ] Can complete payment with test card: `4242 4242 4242 4242`
- [ ] Redirected back to `/billing?session_id=...`
- [ ] See success toast notification
- [ ] Subscription shows as "active"
- [ ] Credits are added to account

---

## Test Card Numbers

Use these in Stripe test mode:

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Decline |
| 4000 0000 0000 9995 | Decline (insufficient funds) |

**Details for all test cards:**
- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

---

## Production Checklist

Before going live:

- [ ] Switch to **live API keys** (`sk_live_...`)
- [ ] Configure **live webhook** in Stripe dashboard
- [ ] Set `STRIPE_WEBHOOK_SECRET` for live webhook
- [ ] Test with **real card** (small amount)
- [ ] Verify credits are granted
- [ ] Set up **webhook monitoring** and alerts

---

## Quick Debug Commands

### Check if webhook endpoint is accessible:
```bash
curl -X POST http://localhost:5000/api/stripe/webhook
# Should return: "Stripe not configured" or "No signature"
```

### Check Stripe CLI is forwarding:
```bash
stripe listen --forward-to localhost:5000/api/stripe/webhook
# Should show "Ready! Your webhook signing secret is..."
```

### Trigger a test webhook:
```bash
stripe trigger checkout.session.completed
```

---

## Need More Help?

- **Stripe Webhooks Docs**: https://stripe.com/docs/webhooks
- **Stripe CLI Docs**: https://stripe.com/docs/stripe-cli
- **Test Cards**: https://stripe.com/docs/testing
- **Webhook Events Reference**: https://stripe.com/docs/api/events/types

---

**Remember:** For local development, always use **Stripe CLI** to forward webhooks!

