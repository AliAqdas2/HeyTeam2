# Project Setup Documentation

This document provides comprehensive specifications for all external service integrations, database configuration, and core functionality in the HeyTeam application.

## Table of Contents
1. [Database Configuration](#database-configuration)
2. [Twilio SMS Integration](#twilio-sms-integration)
3. [Stripe Payment Integration](#stripe-payment-integration)
4. [Resend Email Integration](#resend-email-integration)
5. [Message Sending Flow](#message-sending-flow)
6. [Roster Board Functionality](#roster-board-functionality)
7. [Twilio Reply Parsing](#twilio-reply-parsing)

---

## Database Configuration

### Overview
The application uses **PostgreSQL** as the primary database with **Drizzle ORM** for database operations.

### Configuration Files

#### 1. `drizzle.config.ts`
- **Purpose**: Configures Drizzle Kit for database migrations
- **Location**: Root directory
- **Key Settings**:
  - Output directory: `./migrations`
  - Schema file: `./shared/schema.ts`
  - Dialect: `postgresql`
  - Connection: Uses `DATABASE_URL` from environment variables

```typescript
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

#### 2. `server/db-storage.ts`
- **Purpose**: Main database storage implementation using Drizzle ORM
- **Connection Setup**:
  - Uses `node-postgres` (`pg`) package
  - Creates a connection pool from `DATABASE_URL`
  - Initializes Drizzle ORM with the pool

```typescript
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;

export class DbStorage implements IStorage {
  private db;
  
  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.db = drizzle(pool);
  }
}
```

### Environment Variables Required

```env
DATABASE_URL=postgresql://user:password@localhost:5432/heyteam
```

### Database Operations
- All database operations go through `DbStorage` class
- Uses Drizzle ORM query builders (`eq`, `and`, `desc`, etc.)
- Transactions are handled automatically by the ORM
- Schema definitions are in `shared/schema.ts`

---

## Twilio SMS Integration

### Overview
Twilio is used for sending SMS messages to contacts and receiving replies via webhooks.

### Configuration Files

#### 1. `server/lib/twilio-client.ts`
- **Purpose**: Twilio client initialization and credential management
- **Key Functions**:
  - `getTwilioClient()`: Returns initialized Twilio client
  - `getTwilioFromPhoneNumber()`: Returns the Twilio phone number to send from

```typescript
import "dotenv/config";
import twilio from 'twilio';

function getCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error('Twilio credentials not configured...');
  }

  return { accountSid, authToken, phoneNumber };
}

export async function getTwilioClient() {
  const { accountSid, authToken } = getCredentials();
  return twilio(accountSid, authToken);
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = getCredentials();
  return phoneNumber;
}
```

### Environment Variables Required

```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Usage in `server/routes.ts`

#### 1. Sending Messages via `/api/send-message`
- **Endpoint**: `POST /api/send-message`
- **Authentication**: Requires `requireAuth` middleware
- **Flow**:
  1. Validates user has enough credits
  2. Gets Twilio client and phone number
  3. For each contact:
     - Creates/updates availability record with status "no_reply"
     - Renders message template with contact/job data
     - Sends SMS via Twilio API
     - Creates message record in database
     - Consumes credits

**Key Code Location**: Lines 1278-1411 in `server/routes.ts`

#### 2. Bulk SMS via `/api/messages/bulk-sms`
- **Endpoint**: `POST /api/messages/bulk-sms`
- **Purpose**: Send messages to multiple contacts without a job
- **Flow**: Similar to send-message but without job association

**Key Code Location**: Lines 1413-1528 in `server/routes.ts`

#### 3. Twilio Webhook Handler `/webhook/twilio/sms`
- **Endpoint**: `POST /webhook/twilio/sms`
- **Purpose**: Receives SMS replies from contacts
- **Flow**:
  1. Receives webhook with `From`, `Body`, `MessageSid`
  2. Finds contact by phone number using `getContactByPhone()`
  3. Handles opt-out messages ("stop", "unsubscribe")
  4. Creates inbound message record
  5. Parses reply using `parseReply()` function
  6. Updates availability status based on parsed reply
  7. Updates contact status (on_job/free)
  8. Sends acknowledgement SMS if applicable

**Key Code Location**: Lines 1758-1825 in `server/routes.ts`

### Phone Number Formatting

#### E.164 Format Construction (`constructE164Phone`)
- **Location**: `server/routes.ts` lines 41-99
- **Purpose**: Converts phone numbers to E.164 format for Twilio
- **Features**:
  - Handles various input formats (with/without +, country codes, trunk prefixes)
  - Supports multiple countries (US, GB, AU, CA, etc.)
  - Removes trunk prefixes (0) for most countries
  - Handles international access codes (00, 011, etc.)

### Phone Number Matching

#### `getContactByPhone()` in `server/db-storage.ts`
- **Purpose**: Matches incoming Twilio E.164 numbers with database contacts
- **Challenge**: Contacts store `countryCode` and `phone` separately
- **Solution**:
  1. First tries exact match on phone field
  2. If no match, fetches all contacts
  3. Reconstructs E.164 from `countryCode + phone` for each contact
  4. Compares cleaned versions (digits only) for matching

**Key Code Location**: `server/db-storage.ts` (implementation varies by storage class)

### Webhook Configuration

#### Setting Up Twilio Webhook
1. In Twilio Console, configure your phone number's webhook URL:
   - **URL**: `https://yourdomain.com/webhook/twilio/sms`
   - **Method**: POST
2. The webhook expects:
   - `From`: Sender's phone number (E.164 format)
   - `Body`: Message content
   - `MessageSid`: Twilio message SID

---

## Stripe Payment Integration

### Overview
Stripe handles subscription plans and one-time SMS bundle purchases.

### Configuration Files

#### 1. `server/routes.ts` - Stripe Initialization
- **Location**: Lines 22-24
- **Setup**:
```typescript
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-09-30.clover" })
  : null;
```

### Environment Variables Required

```env
STRIPE_SECRET_KEY=sk_live_... or sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Endpoints

#### 1. Create Subscription Checkout Session
- **Endpoint**: `POST /api/create-checkout-session`
- **Location**: Lines 2038-2139 in `server/routes.ts`
- **Flow**:
  1. Validates user authentication
  2. Gets subscription plan details
  3. Creates/retrieves Stripe customer
  4. Creates checkout session with:
     - Mode: `subscription`
     - Line items with price data
     - Success URL: `/billing?session_id={CHECKOUT_SESSION_ID}`
     - Metadata: `userId`, `planId`, `currency`
  5. Returns checkout URL

#### 2. Create Bundle Checkout Session
- **Endpoint**: `POST /api/create-bundle-checkout-session`
- **Location**: Lines 1960-2036 in `server/routes.ts`
- **Flow**: Similar to subscription but with `mode: "payment"` for one-time purchases

#### 3. Process Checkout Session (Immediate Activation)
- **Endpoint**: `POST /api/stripe/process-session`
- **Location**: Lines 2142-2291 in `server/routes.ts`
- **Purpose**: Immediately processes completed checkout sessions
- **Flow**:
  1. Retrieves session from Stripe
  2. Validates session is complete
  3. For subscriptions:
     - Retrieves subscription details
     - Updates user subscription in database
     - Grants credits with expiry date
  4. For bundles:
     - Retrieves bundle details
     - Grants credits (10-year expiry)
  5. Returns credits granted and purchase type

#### 4. Stripe Webhook Handler
- **Endpoint**: `POST /api/stripe/webhook`
- **Location**: Lines 1531-1757 in `server/routes.ts`
- **Purpose**: Handles Stripe webhook events
- **Events Handled**:
  - `checkout.session.completed`: Activates subscriptions/bundles
  - `invoice.payment_succeeded`: Handles subscription renewals
  - `customer.subscription.deleted`: Cancels subscriptions

**Important**: Webhook handler uses `express.raw({ type: "application/json" })` middleware to preserve raw body for signature verification.

### Date Handling in Stripe

#### Safe Timestamp Conversion
Stripe timestamps are Unix seconds, but may be undefined. Code safely converts:

```typescript
const subData = subscription as any;
const updateData: any = {
  planId,
  currency,
  stripeSubscriptionId: subscriptionId,
  status: subscription.status,
};

// Safely convert Stripe timestamps to Date objects
if (subData.current_period_start && typeof subData.current_period_start === 'number') {
  updateData.currentPeriodStart = new Date(subData.current_period_start * 1000);
}
if (subData.current_period_end && typeof subData.current_period_end === 'number') {
  updateData.currentPeriodEnd = new Date(subData.current_period_end * 1000);
}
```

### Frontend Integration (`client/src/pages/billing.tsx`)

#### Checkout Flow
1. User selects plan/bundle
2. Calls `/api/create-checkout-session` or `/api/create-bundle-checkout-session`
3. Redirects to Stripe checkout URL
4. After payment, redirects to `/billing?session_id=...`
5. Frontend detects `session_id` in URL
6. Calls `/api/stripe/process-session` to immediately activate
7. Shows success toast and refreshes subscription/credits data

**Key Code Location**: Lines 152-195 in `client/src/pages/billing.tsx`

---

## Resend Email Integration

### Overview
Resend is used for sending transactional emails (password resets, team invitations, team messages).

### Configuration Files

#### 1. `server/email.ts`
- **Purpose**: Email sending functions using Resend API
- **Key Functions**:
  - `getResendClient()`: Initializes Resend client
  - `sendPasswordResetEmail()`: Password reset emails
  - `sendTeamInvitationEmail()`: Team member invitations
  - `sendTeamMessageNotification()`: Team message notifications

```typescript
import "dotenv/config";
import { Resend } from 'resend';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}
```

### Environment Variables Required

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### Email Types

#### 1. Password Reset Email
- **Function**: `sendPasswordResetEmail()`
- **Location**: Lines 30-83 in `server/email.ts`
- **Usage**: Called from auth routes when user requests password reset
- **Content**: HTML email with reset link and token

#### 2. Team Invitation Email
- **Function**: `sendTeamInvitationEmail()`
- **Location**: Lines 85-171 in `server/email.ts`
- **Usage**: Called when admin invites team member
- **Content**: HTML email with login credentials and welcome message
- **Called From**: `/api/organization/invite` endpoint (line 206 in `server/routes.ts`)

#### 3. Team Message Notification
- **Function**: `sendTeamMessageNotification()`
- **Location**: Lines 173-235 in `server/email.ts`
- **Usage**: Called when team member sends message to another
- **Content**: HTML email with message preview and login link
- **Called From**: `/api/messages/team` endpoint (line 402 in `server/routes.ts`)

### Email Security
- All email content is HTML-escaped using `escapeHtml()` function
- Prevents XSS attacks in email content
- Uses Resend's secure API for sending

---

## Message Sending Flow

### Overview
The message sending flow allows users to send SMS invitations to contacts for jobs.

### Endpoint: `/api/send-message`
- **Location**: Lines 1278-1411 in `server/routes.ts`
- **Method**: POST
- **Authentication**: Required (`requireAuth`)

### Request Body
```typescript
{
  jobId: string;
  templateId: string;
  contactIds: string[];
}
```

### Flow Steps

1. **Credit Check**
   - Validates user has enough credits for all contacts
   - Returns error if insufficient credits

2. **Data Retrieval**
   - Gets job and template from database
   - Creates campaign record

3. **Twilio Setup**
   - Initializes Twilio client and phone number
   - Falls back to dev mode if Twilio not configured

4. **For Each Contact**:
   a. **Availability Management**:
      - Checks if availability record exists
      - If new: Creates with status "no_reply"
      - If existing: Updates to "no_reply" (resets status)
   
   b. **Message Rendering**:
      - Renders template with contact and job variables
      - Appends roster link if template has `includeRosterLink` enabled
   
   c. **SMS Sending**:
      - Constructs E.164 phone number
      - Sends SMS via Twilio API
      - Creates message record in database
   
   d. **Credit Consumption**:
      - Consumes 1 credit per sent message

5. **Response**
   - Returns success with campaign details

### Template Rendering
- Uses `renderTemplate()` function from `server/lib/template-renderer`
- Replaces template variables with contact/job data
- Variables typically include: `{firstName}`, `{lastName}`, `{jobName}`, `{startTime}`, etc.

### Roster Link Appending
- If template has `includeRosterLink: true`:
  - Generates or retrieves roster token for contact
  - Creates URL: `{baseUrl}/roster/{rosterToken}`
  - Appends to message content

---

## Roster Board Functionality

### Overview
The roster board displays contacts organized by their availability status for a job.

### Frontend Component
- **File**: `client/src/pages/roster-board.tsx`
- **Route**: `/jobs/:id/roster`

### Endpoint: `/api/jobs/:id/roster`
- **Location**: Lines 464-483 in `server/routes.ts`
- **Method**: GET
- **Authentication**: Not required (public endpoint)

### Response Structure
```typescript
{
  ...job,  // Job details
  availability: [
    {
      ...availabilityRecord,
      contact: {
        ...contactDetails
      }
    }
  ]
}
```

### Status Columns
1. **Confirmed** - Contacts who accepted the job
2. **Maybe** - Contacts with tentative availability
3. **Declined** - Contacts who declined
4. **No Reply** - Contacts who haven't responded yet

### Frontend Features

#### 1. Auto-Refresh
- **Location**: Lines 106-110 in `client/src/pages/roster-board.tsx`
- **Configuration**:
  ```typescript
  refetchInterval: 5000, // Auto-refresh every 5 seconds
  refetchOnWindowFocus: true
  ```
- **Purpose**: Picks up webhook updates automatically

#### 2. Drag-and-Drop
- Users can drag contacts between status columns
- Updates availability status via `/api/availability/:id` endpoint
- **Location**: Lines 115-127 in `client/src/pages/roster-board.tsx`

#### 3. Contact Details Sheet
- Clicking a contact opens a sheet with:
  - Contact information (phone, email)
  - Message thread history
  - Status badges

### Availability Status Updates

#### Manual Updates (Drag-and-Drop)
- **Endpoint**: `PATCH /api/availability/:id`
- **Location**: Lines 1890-1910 in `server/routes.ts`
- **Flow**:
  1. Updates availability status
  2. Updates contact status based on new availability:
     - "confirmed" → contact.status = "on_job"
     - "declined" → contact.status = "free"
  3. Returns updated availability record

#### Automatic Updates (SMS Replies)
- Handled by Twilio webhook (see Twilio Reply Parsing section below)

---

## Twilio Reply Parsing

### Overview
When contacts reply to SMS invitations, the system parses their replies and updates availability status.

### Reply Parser
- **File**: `server/lib/reply-parser.ts`
- **Function**: `parseReply(message: string): ParsedReply`

### Parsed Reply Types
```typescript
type ParsedReply = {
  status: "confirmed" | "maybe" | "declined" | "no_reply";
  shiftPreference?: string;
}
```

### Supported Replies

#### Confirmation
- `"y"` or `"yes"` or `"👍"` → `status: "confirmed"`
- `"1"` → `status: "confirmed"`, `shiftPreference: "AM Shift"`
- `"2"` → `status: "confirmed"`, `shiftPreference: "PM Shift"`
- `"3"` → `status: "confirmed"`, `shiftPreference: "Full Day"`

#### Decline
- `"n"` or `"no"` or `"👎"` → `status: "declined"`

#### Maybe
- `"maybe"` or `"m"` → `status: "maybe"`

#### Default
- Anything else → `status: "no_reply"`

### Webhook Processing Flow

#### Endpoint: `/webhook/twilio/sms`
- **Location**: Lines 1758-1825 in `server/routes.ts`
- **Method**: POST

#### Flow Steps

1. **Receive Webhook**
   - Extracts `From`, `Body`, `MessageSid` from request

2. **Find Contact**
   - Uses `getContactByPhone(From)` to find contact
   - Returns OK if contact not found

3. **Handle Opt-Out**
   - If message contains "stop" or "unsubscribe":
     - Sets `contact.isOptedOut = true`
     - Returns OK

4. **Find Related Job**
   - Gets recent outbound messages for contact
   - Finds most recent message with `jobId`
   - Uses that jobId for availability update

5. **Create Inbound Message**
   - Creates message record with:
     - `direction: "inbound"`
     - `status: "received"`
     - `content: Body`
     - `twilioSid: MessageSid`

6. **Parse Reply**
   - Calls `parseReply(Body)` to get status and shift preference

7. **Update Availability**
   - Finds availability record for contact + job
   - Updates status based on parsed reply
   - Updates shift preference if provided

8. **Update Contact Status**
   - If `status === "confirmed"`: Sets `contact.status = "on_job"`
   - If `status === "declined"`: Sets `contact.status = "free"`
   - "maybe" and "no_reply" don't change contact status

9. **Send Acknowledgement**
   - If status is not "no_reply":
     - Calls `sendAcknowledgementSMS()` function
     - Sends personalized confirmation/decline message
     - Consumes 1 credit for acknowledgement

### Acknowledgement Messages

#### Function: `sendAcknowledgementSMS()`
- **Location**: Lines 2955-3032 in `server/routes.ts`
- **Purpose**: Sends confirmation SMS to contact after they reply

#### Message Types

**Confirmed**:
```
Thanks {firstName}! You're confirmed for {jobName} on {date} at {time}. Location: {location}. See you there!
```

**Confirmed with Shift Preference**:
```
Thanks {firstName}! You're confirmed for {jobName} ({shiftPreference}) on {date} at {time}. Location: {location}. See you there!
```

**Declined**:
```
Thanks for letting us know, {firstName}. We've noted you're unavailable for {jobName} on {date}. We'll contact you about future opportunities.
```

**Maybe**:
```
Thanks {firstName}. We've noted your tentative availability for {jobName} on {date}. We'll confirm closer to the date.
```

### Real-Time Updates

#### Frontend Auto-Refresh
- Roster board automatically refreshes every 5 seconds
- Picks up webhook-triggered availability updates
- No page reload required

#### Query Invalidation
- When messages are sent, frontend invalidates:
  - `/api/jobs` queries
  - `/api/jobs/:id/roster` queries
  - `/api/contacts` queries
  - `/api/messages` queries

---

## Environment Variables Summary

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/heyteam

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Stripe
STRIPE_SECRET_KEY=sk_live_... or sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Session
SESSION_SECRET=your_random_secret_key

# Cookie (optional, for HTTPS)
COOKIE_SECURE=false  # Set to "true" for HTTPS-only cookies
```

### Dotenv Configuration

All server files that use environment variables import `dotenv/config` at the top:
- `server/index.ts`
- `server/routes.ts`
- `server/db-storage.ts`
- `server/lib/twilio-client.ts`
- `server/email.ts`
- `server/seed.ts`
- `server/seed-plans.ts`
- `drizzle.config.ts`

---

## Key Integration Points

### When Replacing Code

If you need to replace or modify any of these integrations:

1. **Twilio**: Replace `server/lib/twilio-client.ts` and update all `getTwilioClient()` calls
2. **Stripe**: Update Stripe initialization in `server/routes.ts` line 22-24
3. **Resend**: Replace `server/email.ts` and update all email function calls
4. **Database**: Update `server/db-storage.ts` constructor and connection logic

### Important Notes

- All phone numbers must be in E.164 format for Twilio
- Stripe webhook requires raw body for signature verification
- Availability status is reset to "no_reply" when sending new messages
- Contact status updates automatically based on availability changes
- Roster board auto-refreshes to show real-time updates from webhooks

---

## Testing Checklist

When replacing integrations, verify:

- [ ] Messages send successfully via Twilio
- [ ] Webhook receives and processes replies correctly
- [ ] Reply parsing works for all supported formats
- [ ] Availability status updates in database
- [ ] Contact status updates correctly
- [ ] Roster board shows updated status
- [ ] Stripe checkout creates sessions
- [ ] Stripe webhook processes events
- [ ] Credits are granted after payment
- [ ] Emails send via Resend
- [ ] Database connections work
- [ ] Environment variables load correctly

---

## Support

For issues or questions about these integrations, refer to:
- Twilio API Documentation: https://www.twilio.com/docs
- Stripe API Documentation: https://stripe.com/docs/api
- Resend API Documentation: https://resend.com/docs
- Drizzle ORM Documentation: https://orm.drizzle.team

