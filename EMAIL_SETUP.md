# Email Setup with Resend

## Overview
This application uses Resend for sending transactional emails (password reset, team notifications, etc.).

## Environment Variables

Add these to your `.env` file:

```bash
# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxx  # Your Resend API key
RESEND_FROM_EMAIL=noreply@yourdomain.com  # Your verified sender email
```

## Getting Your Resend Credentials

### 1. Sign up for Resend
- Go to [resend.com](https://resend.com)
- Create an account or sign in

### 2. Get Your API Key
- Navigate to **API Keys** in your dashboard
- Click **Create API Key**
- Copy the key (starts with `re_`)
- Add it to your `.env` file as `RESEND_API_KEY`

### 3. Verify Your Domain (Recommended)
- Go to **Domains** in your dashboard
- Add your domain (e.g., `yourdomain.com`)
- Follow the DNS verification steps
- Once verified, you can use emails like `noreply@yourdomain.com`

### 4. Alternative: Use Default Sender
If you haven't verified a domain, Resend provides a default sender:
- Email: `onboarding@resend.dev`
- This is set as the default fallback in the code

## Testing

### Test Email Functionality
```bash
# Make sure your environment variables are set
echo $RESEND_API_KEY  # Should show your key
echo $RESEND_FROM_EMAIL  # Should show your email

# Run your application
npm run dev

# Test by triggering a password reset or team message
```

## Features

### Password Reset Emails
- Automatically sent when users request password reset
- Includes secure reset link with expiration
- Professional HTML template

### Team Message Notifications
- Sent when team members send internal messages
- Includes message preview and login link
- Links back to your HeyTeam app

## Troubleshooting

### "RESEND_API_KEY environment variable is not set"
- Make sure you've added the environment variable to your `.env` file
- Restart your development server after adding the variable

### Emails not being sent
1. Check your Resend dashboard for errors
2. Verify your domain is properly configured (if using custom domain)
3. Check that your email templates are valid HTML
4. Ensure you haven't exceeded Resend's rate limits

### Using default sender
The code uses `onboarding@resend.dev` as a fallback if `RESEND_FROM_EMAIL` is not set. This is useful for development, but you should set your own verified sender for production.

## Security Notes

- API keys should **never** be committed to version control
- Use environment variables for all sensitive credentials
- The code includes HTML escaping to prevent XSS attacks
- Always verify your sending domain before going to production

## Rate Limits

Resend's free tier includes:
- Up to 3,000 emails/month
- 100 emails/day

For production applications, consider upgrading your Resend plan.

## Production Checklist

- [ ] Add `RESEND_API_KEY` to production environment
- [ ] Set `RESEND_FROM_EMAIL` to your verified domain
- [ ] Test all email templates
- [ ] Configure proper error logging
- [ ] Set up webhook monitoring (optional)
- [ ] Monitor rate limits

