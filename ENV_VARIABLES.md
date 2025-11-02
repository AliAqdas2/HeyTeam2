# Environment Variables Configuration

## Required Variables

### Database Configuration
```bash
# PostgreSQL Local Database (use individual variables OR DATABASE_URL)
PGUSER=postgres
PGPASSWORD=sjadmin
PGHOST=localhost
PGPORT=5432
PGDATABASE=HeyTeam

# OR use a connection string (alternative to individual variables)
DATABASE_URL=postgresql://postgres:sjadmin@localhost:5432/HeyTeam
```

### Session Configuration
```bash
# Session secret - change this in production!
SESSION_SECRET=your-random-secret-key-here

# Cookie security - ONLY set to "true" when using HTTPS
# Leave unset for local HTTP development/testing
COOKIE_SECURE=false
```

### Server Configuration
```bash
# Server port
PORT=5000

# Environment mode
NODE_ENV=development  # or "production"
```

## Optional Variables

### Twilio (SMS functionality)
```bash
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

### Stripe (Payment processing)
```bash
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

### Email (Resend - for transactional emails)
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

**Note:** Sign up at [resend.com](https://resend.com) to get your API key. See `EMAIL_SETUP.md` for detailed setup instructions.

## Environment Files

Create a `.env` file in the root directory with all required variables:

```bash
# .env - Complete Example

# Database (use DATABASE_URL for simplicity)
DATABASE_URL=postgresql://postgres:sjadmin@localhost:5432/HeyTeam

# Session & Security
SESSION_SECRET=my-super-secret-key-change-in-production-use-random-string
COOKIE_SECURE=false  # Set to "true" ONLY when using HTTPS in production

# Server
PORT=5000
NODE_ENV=development

# Twilio (SMS messaging)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

## Important Security Notes

1. **Never commit `.env` files to version control**
2. **Always change SESSION_SECRET in production** - use a long random string
3. **Only enable COOKIE_SECURE when using HTTPS** - it won't work over HTTP
4. **Keep your database credentials secure**
5. **Rotate API keys and secrets regularly**

## Running the Application

### Development Mode (with hot reload)
```bash
npm run dev
```

### Production Build
```bash
# Build the application
npm run build

# Start the production server
npm start
```

### Database Setup
```bash
# Push schema to database (creates tables)
npm run db:push
```

