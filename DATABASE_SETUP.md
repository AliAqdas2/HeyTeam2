# Database Setup - PostgreSQL

## Overview

This application uses **PostgreSQL** with the `pg` (node-postgres) driver and Drizzle ORM.

## Configuration

### Environment Variable

The database connection is configured via the `DATABASE_URL` environment variable:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

### Example Connection Strings

**Local PostgreSQL:**
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/heyteam
```

**Remote PostgreSQL:**
```
DATABASE_URL=postgresql://user:pass@remote-host.com:5432/heyteam
```

## Files Updated

The following files have been updated to use standard PostgreSQL:

1. **`server/db-storage.ts`**
   - Changed from `drizzle-orm/neon-serverless` to `drizzle-orm/node-postgres`
   - Uses `pg` Pool for connection management
   - Validates `DATABASE_URL` is set on initialization

2. **`server/seed-plans.ts`**
   - Updated to use `node-postgres` imports
   - Seeds subscription plans and SMS bundles

3. **`drizzle.config.ts`**
   - Already configured to use `DATABASE_URL`
   - No changes needed

## Database Commands

### 1. Push schema to database (create/update tables)
```bash
npm run db:push
```
This creates all database tables based on your schema.

### 2. Seed subscription plans (required for app to work)
```bash
npm run db:seed-plans
```
This seeds the database with:
- 3 subscription plans (Starter, Team, Business)
- 6 SMS bundles for purchasing additional messages

**Note**: Run this after `db:push` to set up pricing plans.

### 3. Seed demo data (optional - for testing)
```bash
npm run db:seed
```
This creates demo data including:
- Demo user (username: `demo`, password: `demo`)
- 3 sample contacts
- 1 sample template
- 1 sample job

**Warning**: Only use this for testing/development!

## Local PostgreSQL Setup

1. **Install PostgreSQL:**
   - Windows: Download from https://www.postgresql.org/download/windows/
   - Mac: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql`

2. **Create Database:**
   ```sql
   CREATE DATABASE heyteam;
   ```

3. **Set Environment Variable:**
   Add to your `.env` file:
   ```env
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/heyteam
   ```

4. **Push Schema:**
   ```bash
   npm run db:push
   ```

5. **Seed Subscription Plans (Required):**
   ```bash
   npm run db:seed-plans
   ```

6. **Seed Demo Data (Optional for testing):**
   ```bash
   npm run db:seed
   ```

## Notes

- The application validates that `DATABASE_URL` is set on startup
- Connection pooling is handled automatically by the `pg` Pool
- All database operations are type-safe using Drizzle ORM
- The database is the source of truth for all application data
