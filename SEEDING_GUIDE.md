# Database Seeding Guide

## Overview

This guide explains how to seed your HeyTeam database with initial data.

---

## Quick Start

After setting up your database, run these commands in order:

```bash
# 1. Create database tables
npm run db:push

# 2. Seed subscription plans (REQUIRED)
npm run db:seed-plans

# 3. (Optional) Seed demo data for testing
npm run db:seed
```

---

## Detailed Commands

### 1. Create Database Schema

**Command:**
```bash
npm run db:push
```

**What it does:**
- Creates all database tables
- Sets up relationships and constraints
- Uses Drizzle Kit to sync schema with database

**When to run:**
- First time setup
- After schema changes in `shared/schema.ts`

**Output:**
```
✓ Pushing changes to database...
✓ Tables created successfully
```

---

### 2. Seed Subscription Plans

**Command:**
```bash
npm run db:seed-plans
```

**What it does:**
- Creates 3 subscription plans:
  - **Starter**: £29/month (500 messages)
  - **Team**: £79/month (3,000 messages)
  - **Business**: £199/month (10,000 messages)
- Creates 6 SMS bundles for purchasing additional messages
- Skips if plans already exist

**When to run:**
- **Required** for app to function properly
- Run once after creating database schema
- Safe to run multiple times (won't duplicate)

**Output:**
```
Seeding subscription plans...
✓ Created subscription plans
✓ Created SMS bundles

Seeding complete!
Created 3 subscription plans and 6 SMS bundles
```

**File Location:** `server/seed-plans.ts`

---

### 3. Seed Demo Data (Optional)

**Command:**
```bash
npm run db:seed
```

**What it does:**
- Creates a demo user:
  - Username: `demo`
  - Password: `demo`
  - Email: `demo@heyteam.app`
- Creates 3 sample contacts (John, Jane, Bob)
- Creates 1 message template
- Creates 1 sample job (scheduled for tomorrow)
- Sets demo user to Pro plan with 500 message credits

**When to run:**
- **Only for development/testing**
- When you need sample data to explore the app
- **DO NOT run in production!**

**Output:**
```
Seeding database...
Created user: demo
Updated subscription to Pro plan
Created 3 contacts
Created template: Availability Check
Created job: Downtown Construction
Seed complete!
```

**File Location:** `server/seed.ts`

---

## Complete Setup Example

Here's the full process for setting up a new database:

```bash
# Step 1: Ensure PostgreSQL is running and DATABASE_URL is set in .env
# DATABASE_URL=postgresql://postgres:password@localhost:5432/heyteam

# Step 2: Install dependencies (if not already done)
npm install

# Step 3: Create database tables
npm run db:push

# Step 4: Seed subscription plans (required)
npm run db:seed-plans

# Step 5: (Optional) Seed demo data for testing
npm run db:seed

# Step 6: Start the application
npm run dev
```

---

## What Each Seed Creates

### Subscription Plans Seed (`db:seed-plans`)

#### Plans:
| Plan | Price (GBP) | Price (USD) | Price (EUR) | Messages/Month |
|------|-------------|-------------|-------------|----------------|
| Starter | £29 | $37 | €34 | 500 |
| Team | £79 | $100 | €92 | 3,000 |
| Business | £199 | $252 | €232 | 10,000 |

#### SMS Bundles:
- **Starter Plan Bundles:**
  - 500 SMS: £15 / $19 / €17
  - 1,000 SMS: £25 / $32 / €29

- **Team Plan Bundles:**
  - 1,000 SMS: £20 / $25 / €23
  - 5,000 SMS: £90 / $114 / €105

- **Business Plan Bundles:**
  - 5,000 SMS: £75 / $95 / €87
  - 10,000 SMS: £135 / $171 / €157

### Demo Data Seed (`db:seed`)

#### Demo User:
- **Username**: demo
- **Password**: demo
- **Email**: demo@heyteam.app
- **Plan**: Pro (500 message credits)

#### Contacts:
1. **John Doe**
   - Phone: +15551234567
   - Email: john.doe@example.com
   - Notes: Lead carpenter

2. **Jane Smith**
   - Phone: +15559876543
   - Email: jane.smith@example.com
   - Notes: Electrician

3. **Bob Johnson**
   - Phone: +15555551234
   - Email: bob.j@example.com

#### Template:
- **Name**: Availability Check
- **Content**: "Hi {{contact.firstName}}, are you available for {{job.name}} on {{job.date}} at {{job.location}}? Reply Y (yes), N (no), or M (maybe)."

#### Job:
- **Name**: Downtown Construction
- **Location**: 123 Main St, Downtown
- **Start Time**: Tomorrow at 9:00 AM
- **End Time**: Tomorrow at 5:00 PM
- **Required Headcount**: 6
- **Notes**: Bring safety equipment

---

## Troubleshooting

### Error: "DATABASE_URL environment variable is required"
**Solution:** Make sure your `.env` file has `DATABASE_URL` set:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/heyteam
```

### Error: "Plans already exist, skipping seed"
**This is normal!** The seed-plans script checks for existing plans and won't duplicate them. This message means your plans are already seeded.

### Error: "Connection refused" or "ECONNREFUSED"
**Solution:** 
- Make sure PostgreSQL is running
- Verify your connection string is correct
- Check PostgreSQL is listening on the correct port (default: 5432)

### Error: "relation does not exist"
**Solution:** Run `npm run db:push` first to create the database tables.

### Error: "duplicate key value violates unique constraint"
**Solution:** 
- Data already exists in the database
- For demo data: This means you've already run the seed
- For plans: Plans are already seeded (this is expected)

---

## Resetting the Database

If you need to start fresh:

### Option 1: Drop and Recreate (PostgreSQL)
```sql
-- Connect to PostgreSQL
psql -U postgres

-- Drop the database
DROP DATABASE heyteam;

-- Recreate it
CREATE DATABASE heyteam;

-- Exit
\q
```

Then run the setup commands again:
```bash
npm run db:push
npm run db:seed-plans
npm run db:seed  # optional
```

### Option 2: Delete Specific Data
Use a database client (pgAdmin, DBeaver, etc.) to:
- Delete rows from specific tables
- Keep schema intact
- Manually manage data

---

## Custom Seeding

To create your own seed data:

1. **Create a new seed file** (e.g., `server/seed-custom.ts`)
2. **Import DbStorage**:
   ```typescript
   import { DbStorage } from "./db-storage";
   ```
3. **Write your seed logic**:
   ```typescript
   async function seedCustom() {
     const storage = new DbStorage();
     // Add your data here
     console.log("Custom seed complete!");
     process.exit(0);
   }
   
   seedCustom().catch((error) => {
     console.error("Seed failed:", error);
     process.exit(1);
   });
   ```
4. **Add npm script** in `package.json`:
   ```json
   "db:seed-custom": "cross-env tsx server/seed-custom.ts"
   ```
5. **Run it**:
   ```bash
   npm run db:seed-custom
   ```

---

## Production Considerations

### ⚠️ Important for Production:

1. **DO NOT** run `npm run db:seed` in production
   - Demo data is for testing only
   - Creates insecure demo user

2. **DO** run `npm run db:seed-plans` in production
   - Required for subscription functionality
   - Safe to run multiple times

3. **Use migrations** for production schema changes
   - Don't use `db:push` in production
   - Create proper migration files with Drizzle Kit

4. **Backup before seeding**
   - Always backup production data first
   - Test seeds in staging environment

---

## Quick Reference

| Command | Purpose | Required? | Safe for Production? |
|---------|---------|-----------|----------------------|
| `npm run db:push` | Create/update tables | Yes | No (use migrations) |
| `npm run db:seed-plans` | Add subscription plans | Yes | Yes |
| `npm run db:seed` | Add demo data | No | **NO** |

---

## Need Help?

- Check `DATABASE_SETUP.md` for database configuration
- Check `ENV_VARIABLES.md` for environment setup
- Ensure PostgreSQL is running and accessible
- Verify your `.env` file has correct `DATABASE_URL`

