// server/index.ts
import "dotenv/config";
import express3 from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import cors from "cors";

// server/routes.ts
import "dotenv/config";
import { createServer } from "http";
import express from "express";
import path from "path";
import bcrypt3 from "bcrypt";
import { nanoid } from "nanoid";

// server/db-storage.ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import { eq, and, desc, inArray, lt } from "drizzle-orm";

// server/lib/phone-utils.ts
var COUNTRY_DIAL_CODES = {
  "US": "+1",
  "CA": "+1",
  "GB": "+44",
  "AU": "+61",
  "NZ": "+64",
  "IE": "+353",
  "IN": "+91",
  "SG": "+65",
  "MX": "+52",
  "DE": "+49",
  "FR": "+33",
  "ES": "+34",
  "IT": "+39"
};
function constructE164Phone(countryCode, phone) {
  let cleaned = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) {
    const result = "+" + cleaned;
    if (result.startsWith("+440") || result.startsWith("+610") || result.startsWith("+640") || result.startsWith("+3530") || result.startsWith("+910") || result.startsWith("+650") || result.startsWith("+520") || result.startsWith("+490") || result.startsWith("+330") || result.startsWith("+340") || result.startsWith("+10")) {
      return result.replace(/^(\+\d{1,3})0/, "$1");
    }
    return result;
  }
  if (cleaned.startsWith("0011")) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith("011")) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith("001")) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }
  const commonCodes = ["1", "33", "34", "39", "44", "49", "52", "61", "64", "65", "91", "353"];
  for (const code of commonCodes) {
    if (cleaned.startsWith(code)) {
      const result = "+" + cleaned;
      if (result.startsWith("+440") || result.startsWith("+610") || result.startsWith("+640") || result.startsWith("+3530") || result.startsWith("+910") || result.startsWith("+650") || result.startsWith("+520") || result.startsWith("+490") || result.startsWith("+330") || result.startsWith("+340") || result.startsWith("+10")) {
        return result.replace(/^(\+\d{1,3})0/, "$1");
      }
      return result;
    }
  }
  if (cleaned.startsWith("0") && countryCode !== "IT") {
    cleaned = cleaned.substring(1);
  }
  const dialCode = COUNTRY_DIAL_CODES[countryCode] || "+1";
  return dialCode + cleaned;
}
function normalizePhoneNumber(phone) {
  return phone.replace(/\D/g, "");
}

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var resellers = pgTable("resellers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  commissionRate: integer("commission_rate").notNull().default(20),
  // Commission percentage (e.g., 20 = 20%)
  referralCode: text("referral_code").notNull().unique(),
  // Unique code for signup URL
  status: text("status").notNull().default("active"),
  // "active", "suspended"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  // Now used for company name
  firstName: text("first_name"),
  // Team member first name
  lastName: text("last_name"),
  // Team member last name
  password: text("password").notNull(),
  email: text("email").notNull(),
  countryCode: text("country_code").default("US"),
  // Country code for mobile number
  mobileNumber: text("mobile_number"),
  // Mobile number without country code
  emailVerified: boolean("email_verified").notNull().default(false),
  mobileVerified: boolean("mobile_verified").notNull().default(false),
  currency: text("currency").notNull().default("GBP"),
  // User's preferred currency: GBP, USD, EUR
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  teamRole: text("team_role").notNull().default("member"),
  // "owner", "admin", "member"
  isAdmin: boolean("is_admin").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  // For soft delete
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  resellerId: varchar("reseller_id").references(() => resellers.id, { onDelete: "set null" }),
  // Which reseller referred this user
  referralCode: text("referral_code"),
  // Optional referral code that brought this user (deprecated - use resellerId)
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Keep for audit trail and created_by
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  countryCode: text("country_code").notNull().default("US"),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address"),
  profilePicture: text("profile_picture"),
  notes: text("notes"),
  skills: text("skills").array().default(sql`ARRAY[]::text[]`),
  qualifications: text("qualifications").array().default(sql`ARRAY[]::text[]`),
  blackoutPeriods: text("blackout_periods").array().default(sql`ARRAY[]::text[]`),
  isOptedOut: boolean("is_opted_out").notNull().default(false),
  quietHoursStart: text("quiet_hours_start").default("22:00"),
  quietHoursEnd: text("quiet_hours_end").default("07:00"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  status: text("status").notNull().default("free"),
  // "free", "on_job", "off_shift"
  rosterToken: varchar("roster_token").unique(),
  // Unique token for viewing roster
  password: text("password"),
  // Password for contact login (nullable, only set when hasLogin is true)
  hasLogin: boolean("has_login").notNull().default(false),
  // Flag to indicate if contact has login enabled
  emailVerified: boolean("email_verified").notNull().default(false),
  // Email verification status
  lastLoginAt: timestamp("last_login_at"),
  // Timestamp of last login
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Keep for audit trail and created_by
  name: text("name").notNull(),
  location: text("location").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  requiredHeadcount: integer("required_headcount"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var jobSkillRequirements = pgTable("job_skill_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  skill: text("skill").notNull(),
  headcount: integer("headcount").notNull().default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Keep for audit trail and created_by
  name: text("name").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("standard"),
  includeRosterLink: boolean("include_roster_link").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Keep for audit trail and created_by
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  templateId: varchar("template_id").notNull().references(() => templates.id),
  sentAt: timestamp("sent_at").notNull().defaultNow()
});
var messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Keep for audit trail and created_by
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: "set null" }),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  direction: text("direction").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("queued"),
  twilioSid: text("twilio_sid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var availability = pgTable("availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("no_reply"),
  shiftPreference: text("shift_preference"),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  targetAudience: text("target_audience").notNull().default(""),
  featureBullets: text("feature_bullets").notNull().default(""),
  useCase: text("use_case").notNull().default(""),
  monthlyCredits: integer("monthly_credits").notNull(),
  // SMS messages included
  supportLevel: text("support_level").notNull().default("email"),
  // email, priority, dedicated
  customTemplates: boolean("custom_templates").notNull().default(false),
  autoFollowUp: boolean("auto_follow_up").notNull().default(false),
  multiManager: boolean("multi_manager").notNull().default(false),
  aiFeatures: boolean("ai_features").notNull().default(false),
  dedicatedNumber: boolean("dedicated_number").notNull().default(false),
  priceGBP: integer("price_gbp").notNull(),
  // Price in pence
  priceUSD: integer("price_usd").notNull(),
  // Price in cents
  priceEUR: integer("price_eur").notNull(),
  // Price in cents
  stripePriceIdGBP: text("stripe_price_id_gbp"),
  stripePriceIdUSD: text("stripe_price_id_usd"),
  stripePriceIdEUR: text("stripe_price_id_eur"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var smsBundles = pgTable("sms_bundles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").references(() => subscriptionPlans.id, { onDelete: "cascade" }),
  // Link to subscription plan
  name: text("name").notNull(),
  description: text("description"),
  credits: integer("credits").notNull(),
  priceGBP: integer("price_gbp").notNull(),
  // Price in pence
  priceUSD: integer("price_usd").notNull(),
  // Price in cents
  priceEUR: integer("price_eur").notNull(),
  // Price in cents
  stripePriceIdGBP: text("stripe_price_id_gbp"),
  stripePriceIdUSD: text("stripe_price_id_usd"),
  stripePriceIdEUR: text("stripe_price_id_eur"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var creditGrants = pgTable("credit_grants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Keep for audit trail
  sourceType: text("source_type").notNull(),
  sourceRef: text("source_ref"),
  creditsGranted: integer("credits_granted").notNull(),
  creditsConsumed: integer("credits_consumed").notNull().default(0),
  creditsRemaining: integer("credits_remaining").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Keep for audit trail
  grantId: varchar("grant_id").notNull().references(() => creditGrants.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "set null" }),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Keep for audit trail and billing contact
  planId: varchar("plan_id").references(() => subscriptionPlans.id),
  status: text("status").notNull().default("trial"),
  currency: text("currency").notNull().default("GBP"),
  // GBP, USD, EUR
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var resellerTransactions = pgTable("reseller_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resellerId: varchar("reseller_id").notNull().references(() => resellers.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stripeEventId: text("stripe_event_id").unique(),
  // Stripe event ID for idempotency
  stripeInvoiceId: text("stripe_invoice_id"),
  // For tracking specific Stripe invoices
  stripeCheckoutId: text("stripe_checkout_id"),
  // For initial purchases
  type: text("type").notNull(),
  // "subscription_start", "subscription_renewal", "bundle_purchase"
  amount: integer("amount").notNull(),
  // Amount in smallest currency unit (cents/pence)
  currency: text("currency").notNull(),
  // GBP, USD, EUR
  commissionAmount: integer("commission_amount").notNull(),
  // Commission earned in smallest currency unit
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var resellerPayouts = pgTable("reseller_payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resellerId: varchar("reseller_id").notNull().references(() => resellers.id, { onDelete: "cascade" }),
  month: integer("month").notNull(),
  // 1-12
  year: integer("year").notNull(),
  // e.g., 2025
  newRevenue: integer("new_revenue").notNull().default(0),
  // From new signups
  recurringRevenue: integer("recurring_revenue").notNull().default(0),
  // From renewals
  totalRevenue: integer("total_revenue").notNull().default(0),
  // Total revenue
  commissionAmount: integer("commission_amount").notNull().default(0),
  // Total commission owed
  currency: text("currency").notNull().default("GBP"),
  // Primary currency for report
  transactionCount: integer("transaction_count").notNull().default(0),
  // Number of transactions
  status: text("status").notNull().default("pending"),
  // "pending", "paid"
  lastCalculatedAt: timestamp("last_calculated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var feedback = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Keep for audit trail
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  // "new", "reviewed", "implemented"
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var platformSettings = pgTable("platform_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  feedbackEmail: text("feedback_email").notNull().default("Feedback@HeyTeam.ai"),
  supportEmail: text("support_email").notNull().default("support@heyteam.ai"),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var deviceTokens = pgTable("device_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  platform: text("platform").notNull(),
  // "ios" | "android"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  // Company name
  password: true,
  email: true,
  countryCode: true,
  mobileNumber: true,
  firstName: true,
  lastName: true,
  resellerId: true
});
var insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  userId: true,
  organizationId: true,
  // Will be set automatically from user's organization
  createdAt: true,
  updatedAt: true
}).extend({
  status: z.enum(["free", "on_job", "off_shift"]).default("free")
});
var insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  userId: true,
  organizationId: true,
  // Will be set automatically from user's organization
  createdAt: true,
  updatedAt: true
});
var insertJobSkillRequirementSchema = createInsertSchema(jobSkillRequirements).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertJobSkillRequirementForJobSchema = insertJobSkillRequirementSchema.omit({
  jobId: true
});
var insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  userId: true,
  organizationId: true,
  // Will be set automatically from user's organization
  createdAt: true
});
var insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  userId: true,
  organizationId: true,
  // Will be set automatically from user's organization
  sentAt: true
});
var insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  userId: true,
  organizationId: true,
  // Will be set automatically from user's organization
  createdAt: true,
  updatedAt: true
});
var insertAvailabilitySchema = createInsertSchema(availability).omit({
  id: true,
  updatedAt: true
});
var insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true
});
var insertSmsBundleSchema = createInsertSchema(smsBundles).omit({
  id: true,
  createdAt: true
});
var insertCreditGrantSchema = createInsertSchema(creditGrants).omit({
  id: true,
  createdAt: true
});
var insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true
});
var insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  userId: true,
  organizationId: true,
  // Will be set automatically from user's organization
  createdAt: true,
  updatedAt: true
});
var insertPlatformSettingsSchema = createInsertSchema(platformSettings).omit({
  id: true,
  updatedAt: true
}).extend({
  feedbackEmail: z.string().email(),
  supportEmail: z.string().email()
});
var insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true
});
var insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true
});
var insertResellerSchema = createInsertSchema(resellers).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertResellerTransactionSchema = createInsertSchema(resellerTransactions).omit({
  id: true,
  createdAt: true
});
var insertResellerPayoutSchema = createInsertSchema(resellerPayouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  userId: true,
  organizationId: true,
  // Will be set automatically from user's organization
  createdAt: true,
  status: true
});
var insertDeviceTokenSchema = createInsertSchema(deviceTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var pushNotificationDeliveries = pgTable("push_notification_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  deviceToken: text("device_token").notNull(),
  notificationId: text("notification_id").notNull().unique(),
  // Unique ID for this notification
  status: text("status").notNull().default("sent"),
  // "sent", "delivered", "failed", "sms_fallback"
  deliveredAt: timestamp("delivered_at"),
  smsFallbackSentAt: timestamp("sms_fallback_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertPushNotificationDeliverySchema = createInsertSchema(pushNotificationDeliveries).omit({
  id: true,
  createdAt: true
});

// server/db-storage.ts
var { Pool } = pkg;
var DbStorage = class {
  db;
  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.db = drizzle(pool);
  }
  // Organization methods
  async getOrganization(id) {
    const result = await this.db.select().from(organizations).where(eq(organizations.id, id));
    return result[0];
  }
  async createOrganization(org) {
    const result = await this.db.insert(organizations).values(org).returning();
    return result[0];
  }
  async updateOrganization(id, updates) {
    const result = await this.db.update(organizations).set(updates).where(eq(organizations.id, id)).returning();
    return result[0];
  }
  async getUsersInOrganization(organizationId) {
    return await this.db.select().from(users).where(eq(users.organizationId, organizationId));
  }
  async updateUserTeamRole(userId, teamRole) {
    const result = await this.db.update(users).set({ teamRole }).where(eq(users.id, userId)).returning();
    return result[0];
  }
  // Admin user methods
  async getAllAdminUsers() {
    return await this.db.select().from(adminUsers);
  }
  async getAdminUser(id) {
    const result = await this.db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return result[0];
  }
  async getAdminUserByEmail(email) {
    const result = await this.db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return result[0];
  }
  async createAdminUser(insertAdminUser) {
    const result = await this.db.insert(adminUsers).values(insertAdminUser).returning();
    return result[0];
  }
  async updateAdminUser(id, updates) {
    const result = await this.db.update(adminUsers).set(updates).where(eq(adminUsers.id, id)).returning();
    return result[0];
  }
  async deleteAdminUser(id) {
    await this.db.delete(adminUsers).where(eq(adminUsers.id, id));
  }
  async getUser(id) {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
  async getAllUsers() {
    return await this.db.select().from(users);
  }
  async getUserByUsername(username) {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0];
  }
  async getUserByEmail(email) {
    const result = await this.db.select().from(users).where(eq(users.email, email));
    return result[0];
  }
  async createUser(insertUser) {
    let userData = insertUser;
    let organizationIdOverride = insertUser.organizationId;
    if (!organizationIdOverride) {
      const org = await this.createOrganization({
        name: `${insertUser.username}'s Organization`
      });
      organizationIdOverride = org.id;
      userData = {
        ...insertUser,
        organizationId: organizationIdOverride,
        teamRole: insertUser.teamRole || "owner"
      };
    }
    const result = await this.db.insert(users).values(userData).returning();
    const user = result[0];
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new Error("User is not associated with an organization");
    }
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3);
    await this.createSubscription(user.id, {
      planId: null,
      status: "trial",
      trialEndsAt,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      stripeSubscriptionId: void 0
    });
    await this.createCreditGrant(user.id, {
      organizationId,
      userId: user.id,
      sourceType: "trial",
      sourceRef: null,
      creditsGranted: 10,
      creditsConsumed: 0,
      creditsRemaining: 10,
      expiresAt: trialEndsAt
    });
    return user;
  }
  async updateUser(id, updates) {
    const result = await this.db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }
  async updateUserPassword(userId, password) {
    const result = await this.db.update(users).set({ password }).where(eq(users.id, userId)).returning();
    return result[0];
  }
  async updateUserStripeInfo(userId, stripeCustomerId, stripeSubscriptionId) {
    const result = await this.db.update(users).set({ stripeCustomerId, stripeSubscriptionId }).where(eq(users.id, userId)).returning();
    return result[0];
  }
  async disableUser(userId) {
    const result = await this.db.update(users).set({ isActive: false }).where(eq(users.id, userId)).returning();
    return result[0];
  }
  async enableUser(userId) {
    const result = await this.db.update(users).set({ isActive: true }).where(eq(users.id, userId)).returning();
    return result[0];
  }
  async createPasswordResetToken(insertToken) {
    const result = await this.db.insert(passwordResetTokens).values(insertToken).returning();
    return result[0];
  }
  async getPasswordResetToken(token) {
    const result = await this.db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return result[0];
  }
  async deletePasswordResetToken(token) {
    await this.db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
  }
  async getContacts(organizationId) {
    return await this.db.select().from(contacts).where(eq(contacts.organizationId, organizationId));
  }
  async getContact(id, organizationId) {
    const result = await this.db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.organizationId, organizationId)));
    return result[0];
  }
  async getContactById(id) {
    const result = await this.db.select().from(contacts).where(eq(contacts.id, id));
    return result[0];
  }
  async getContactByRosterToken(token) {
    const result = await this.db.select().from(contacts).where(eq(contacts.rosterToken, token));
    return result[0];
  }
  async getContactByPhone(phone, organizationId) {
    let result = await this.db.select().from(contacts).where(eq(contacts.phone, phone));
    if (result[0]) {
      return result[0];
    }
    const normalizedIncoming = normalizePhoneNumber(phone);
    const allContacts = await this.db.select().from(contacts).where(organizationId ? eq(contacts.organizationId, organizationId) : void 0);
    for (const contact of allContacts) {
      if (!contact.countryCode || !contact.phone) continue;
      const reconstructedE164 = constructE164Phone(contact.countryCode, contact.phone);
      const normalizedReconstructed = normalizePhoneNumber(reconstructedE164);
      if (normalizedIncoming === normalizedReconstructed) {
        return contact;
      }
    }
    return void 0;
  }
  async getContactByEmail(email, organizationId) {
    const conditions = [
      eq(contacts.email, email),
      eq(contacts.hasLogin, true)
      // Only return contacts with login enabled
    ];
    if (organizationId) {
      conditions.push(eq(contacts.organizationId, organizationId));
    }
    const result = await this.db.select().from(contacts).where(and(...conditions));
    return result[0];
  }
  async createContact(organizationId, userId, contact) {
    const result = await this.db.insert(contacts).values({ ...contact, organizationId, userId }).returning();
    return result[0];
  }
  async updateContact(id, updates) {
    const result = await this.db.update(contacts).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(contacts.id, id)).returning();
    return result[0];
  }
  async updateContactPassword(contactId, password) {
    const result = await this.db.update(contacts).set({ password, updatedAt: /* @__PURE__ */ new Date() }).where(eq(contacts.id, contactId)).returning();
    return result[0];
  }
  async deleteContact(id) {
    await this.db.delete(contacts).where(eq(contacts.id, id));
  }
  async getJobs(organizationId) {
    return await this.db.select().from(jobs).where(eq(jobs.organizationId, organizationId));
  }
  async getJob(id) {
    const result = await this.db.select().from(jobs).where(eq(jobs.id, id));
    return result[0];
  }
  async createJob(organizationId, userId, job) {
    const result = await this.db.insert(jobs).values({ ...job, organizationId, userId }).returning();
    return result[0];
  }
  async updateJob(id, updates) {
    const result = await this.db.update(jobs).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(jobs.id, id)).returning();
    return result[0];
  }
  async deleteJob(id) {
    await this.db.delete(jobs).where(eq(jobs.id, id));
  }
  async getJobSkillRequirements(jobId) {
    return await this.db.select().from(jobSkillRequirements).where(eq(jobSkillRequirements.jobId, jobId));
  }
  async replaceJobSkillRequirements(jobId, requirements) {
    return await this.db.transaction(async (tx) => {
      await tx.delete(jobSkillRequirements).where(eq(jobSkillRequirements.jobId, jobId));
      if (!requirements.length) {
        return [];
      }
      const now = /* @__PURE__ */ new Date();
      const data = requirements.map((requirement) => ({
        jobId,
        skill: requirement.skill,
        headcount: requirement.headcount ?? 1,
        notes: requirement.notes ?? null,
        createdAt: now,
        updatedAt: now
      }));
      const inserted = await tx.insert(jobSkillRequirements).values(data).returning();
      return inserted;
    });
  }
  async getTemplates(organizationId) {
    return await this.db.select().from(templates).where(eq(templates.organizationId, organizationId));
  }
  async getTemplate(id) {
    const result = await this.db.select().from(templates).where(eq(templates.id, id));
    return result[0];
  }
  async createTemplate(organizationId, userId, template) {
    const result = await this.db.insert(templates).values({ ...template, organizationId, userId }).returning();
    return result[0];
  }
  async updateTemplate(id, updates) {
    const result = await this.db.update(templates).set(updates).where(eq(templates.id, id)).returning();
    return result[0];
  }
  async deleteTemplate(id) {
    await this.db.delete(templates).where(eq(templates.id, id));
  }
  async bulkCreateContacts(organizationId, userId, insertContacts) {
    const contactsWithIds = insertContacts.map((c) => ({ ...c, organizationId, userId }));
    const result = await this.db.insert(contacts).values(contactsWithIds).returning();
    return result;
  }
  async createCampaign(organizationId, userId, campaign) {
    const result = await this.db.insert(campaigns).values({ ...campaign, organizationId, userId }).returning();
    return result[0];
  }
  async getCampaignsForJob(jobId, organizationId) {
    return await this.db.select().from(campaigns).where(and(eq(campaigns.jobId, jobId), eq(campaigns.organizationId, organizationId)));
  }
  async getMessages(contactId, organizationId) {
    return await this.db.select().from(messages).where(and(eq(messages.contactId, contactId), eq(messages.organizationId, organizationId)));
  }
  async getMessagesForJob(jobId, organizationId) {
    return await this.db.select().from(messages).where(and(eq(messages.jobId, jobId), eq(messages.organizationId, organizationId)));
  }
  async getAllMessagesForUser(organizationId) {
    return await this.db.select().from(messages).where(eq(messages.organizationId, organizationId)).orderBy(desc(messages.createdAt));
  }
  async createMessage(organizationId, userId, message) {
    const result = await this.db.insert(messages).values({ ...message, organizationId, userId }).returning();
    return result[0];
  }
  async updateMessageStatus(id, status) {
    const result = await this.db.update(messages).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq(messages.id, id)).returning();
    return result[0];
  }
  async getAvailability(jobId, organizationId) {
    const result = await this.db.select({ availability }).from(availability).innerJoin(jobs, eq(availability.jobId, jobs.id)).where(and(eq(availability.jobId, jobId), eq(jobs.organizationId, organizationId)));
    return result.map((r) => r.availability);
  }
  async getAllAvailability(organizationId) {
    const result = await this.db.select({ availability }).from(availability).innerJoin(jobs, eq(availability.jobId, jobs.id)).where(eq(jobs.organizationId, organizationId));
    return result.map((r) => r.availability);
  }
  async getAvailabilityByContact(contactId, organizationId) {
    const result = await this.db.select({ availability }).from(availability).innerJoin(contacts, eq(availability.contactId, contacts.id)).where(and(eq(availability.contactId, contactId), eq(contacts.organizationId, organizationId)));
    return result.map((r) => r.availability);
  }
  async getAvailabilityForContact(jobId, contactId, organizationId) {
    const result = await this.db.select({ availability }).from(availability).innerJoin(jobs, eq(availability.jobId, jobs.id)).innerJoin(contacts, eq(availability.contactId, contacts.id)).where(
      and(
        eq(availability.jobId, jobId),
        eq(availability.contactId, contactId),
        eq(jobs.organizationId, organizationId),
        eq(contacts.organizationId, organizationId)
      )
    ).limit(1);
    return result[0]?.availability;
  }
  async getConfirmedContactsForJob(jobId, organizationId) {
    const result = await this.db.select({ contact: contacts }).from(availability).innerJoin(jobs, eq(availability.jobId, jobs.id)).innerJoin(contacts, eq(availability.contactId, contacts.id)).where(
      and(
        eq(availability.jobId, jobId),
        eq(availability.status, "confirmed"),
        eq(jobs.organizationId, organizationId),
        eq(contacts.organizationId, organizationId)
      )
    );
    return result.map((r) => r.contact);
  }
  async getCurrentJobForContact(contactId, organizationId) {
    const result = await this.db.select({ job: jobs }).from(availability).innerJoin(jobs, eq(availability.jobId, jobs.id)).innerJoin(contacts, eq(availability.contactId, contacts.id)).where(
      and(
        eq(availability.contactId, contactId),
        eq(availability.status, "confirmed"),
        eq(jobs.organizationId, organizationId),
        eq(contacts.organizationId, organizationId)
      )
    ).orderBy(jobs.startTime).limit(1);
    return result[0]?.job;
  }
  async createAvailability(organizationId, avail) {
    const job = await this.getJob(avail.jobId);
    if (!job) {
      throw new Error("Job not found for organization");
    }
    const contact = await this.getContact(avail.contactId, organizationId);
    if (!contact) {
      throw new Error("Contact not found for organization");
    }
    const result = await this.db.insert(availability).values(avail).returning();
    return result[0];
  }
  async updateAvailability(id, updates) {
    const result = await this.db.update(availability).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(availability.id, id)).returning();
    return result[0];
  }
  async getSubscription(organizationId) {
    const result = await this.db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId));
    return result[0];
  }
  async getAllSubscriptions() {
    return await this.db.select().from(subscriptions);
  }
  async createSubscription(userId, subscription) {
    const user = await this.getUser(userId);
    if (!user?.organizationId) {
      throw new Error("User not associated with an organization");
    }
    const result = await this.db.insert(subscriptions).values({ ...subscription, userId, organizationId: user.organizationId }).returning();
    return result[0];
  }
  async updateSubscription(userId, updates) {
    const result = await this.db.update(subscriptions).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(subscriptions.userId, userId)).returning();
    return result[0];
  }
  // Credit system methods
  async getSubscriptionPlans() {
    return await this.db.select().from(subscriptionPlans);
  }
  async getSubscriptionPlan(id) {
    const result = await this.db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return result[0];
  }
  async createSubscriptionPlan(plan) {
    const result = await this.db.insert(subscriptionPlans).values(plan).returning();
    return result[0];
  }
  async updateSubscriptionPlanPricing(id, prices) {
    const result = await this.db.update(subscriptionPlans).set(prices).where(eq(subscriptionPlans.id, id)).returning();
    return result[0];
  }
  async getSmsBundles() {
    return await this.db.select().from(smsBundles);
  }
  async getSmsBundle(id) {
    const result = await this.db.select().from(smsBundles).where(eq(smsBundles.id, id));
    return result[0];
  }
  async createSmsBundle(bundle) {
    const result = await this.db.insert(smsBundles).values(bundle).returning();
    return result[0];
  }
  async updateSmsBundlePricing(id, prices) {
    const result = await this.db.update(smsBundles).set(prices).where(eq(smsBundles.id, id)).returning();
    return result[0];
  }
  async getCreditGrants(userId) {
    return await this.db.select().from(creditGrants).where(eq(creditGrants.userId, userId));
  }
  async getCreditGrantsByOrganization(organizationId) {
    return await this.db.select().from(creditGrants).where(eq(creditGrants.organizationId, organizationId));
  }
  async createCreditGrant(userId, grant) {
    const organizationId = grant.organizationId ?? (await this.getUser(userId))?.organizationId;
    if (!organizationId) {
      throw new Error("User not associated with an organization");
    }
    const result = await this.db.insert(creditGrants).values({ ...grant, organizationId, userId }).returning();
    return result[0];
  }
  async updateCreditGrant(id, updates) {
    const result = await this.db.update(creditGrants).set(updates).where(eq(creditGrants.id, id)).returning();
    return result[0];
  }
  async getCreditTransactions(userId) {
    return await this.db.select().from(creditTransactions).where(eq(creditTransactions.userId, userId));
  }
  async createCreditTransaction(userId, transaction) {
    const organizationId = transaction.organizationId ?? (await this.getUser(userId))?.organizationId;
    if (!organizationId) {
      throw new Error("User not associated with an organization");
    }
    const result = await this.db.insert(creditTransactions).values({ ...transaction, organizationId, userId }).returning();
    return result[0];
  }
  async getTotalCredits(userId) {
    const grants = await this.getCreditGrants(userId);
    return grants.reduce((total, grant) => total + grant.creditsRemaining, 0);
  }
  async consumeCreditsAtomic(userId, amount, reason, messageId) {
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }
    return await this.db.transaction(async (tx) => {
      const user = await this.getUser(userId);
      if (!user?.organizationId) {
        throw new Error("User not associated with an organization");
      }
      const organizationId = user.organizationId;
      const now = /* @__PURE__ */ new Date();
      const allGrants = await tx.select().from(creditGrants).where(eq(creditGrants.userId, userId)).for("update");
      const activeGrants = allGrants.filter((g) => g.creditsRemaining > 0).filter((g) => !g.expiresAt || g.expiresAt > now).sort((a, b) => {
        if (a.expiresAt && b.expiresAt) {
          return a.expiresAt.getTime() - b.expiresAt.getTime();
        }
        if (a.expiresAt && !b.expiresAt) return -1;
        if (!a.expiresAt && b.expiresAt) return 1;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      const totalAvailable = activeGrants.reduce((sum, g) => sum + g.creditsRemaining, 0);
      if (totalAvailable < amount) {
        throw new Error(`Insufficient credits. Available: ${totalAvailable}, Required: ${amount}`);
      }
      let remaining = amount;
      const transactions = [];
      for (const grant of activeGrants) {
        if (remaining === 0) break;
        const toConsume = Math.min(remaining, grant.creditsRemaining);
        await tx.update(creditGrants).set({
          creditsConsumed: grant.creditsConsumed + toConsume,
          creditsRemaining: grant.creditsRemaining - toConsume
        }).where(
          and(
            eq(creditGrants.id, grant.id),
            eq(creditGrants.organizationId, organizationId)
          )
        );
        const txResult = await tx.insert(creditTransactions).values({
          organizationId,
          userId,
          grantId: grant.id,
          messageId,
          delta: -toConsume,
          reason
        }).returning();
        transactions.push(txResult[0]);
        remaining -= toConsume;
      }
      return transactions;
    });
  }
  async consumeCreditsAtomicByOrganization(organizationId, amount, reason, messageId) {
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }
    return await this.db.transaction(async (tx) => {
      const now = /* @__PURE__ */ new Date();
      const allGrants = await tx.select().from(creditGrants).where(eq(creditGrants.organizationId, organizationId)).for("update");
      const activeGrants = allGrants.filter((g) => g.creditsRemaining > 0).filter((g) => !g.expiresAt || g.expiresAt > now).sort((a, b) => {
        if (a.expiresAt && b.expiresAt) {
          return a.expiresAt.getTime() - b.expiresAt.getTime();
        }
        if (a.expiresAt && !b.expiresAt) return -1;
        if (!a.expiresAt && b.expiresAt) return 1;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      const totalAvailable = activeGrants.reduce((sum, g) => sum + g.creditsRemaining, 0);
      if (totalAvailable < amount) {
        throw new Error(`Insufficient credits. Available: ${totalAvailable}, Required: ${amount}`);
      }
      let remaining = amount;
      const transactions = [];
      for (const grant of activeGrants) {
        if (remaining === 0) break;
        const toConsume = Math.min(remaining, grant.creditsRemaining);
        await tx.update(creditGrants).set({
          creditsConsumed: grant.creditsConsumed + toConsume,
          creditsRemaining: grant.creditsRemaining - toConsume
        }).where(eq(creditGrants.id, grant.id));
        const txResult = await tx.insert(creditTransactions).values({
          organizationId,
          userId: grant.userId,
          grantId: grant.id,
          messageId,
          delta: -toConsume,
          reason
        }).returning();
        transactions.push(txResult[0]);
        remaining -= toConsume;
      }
      return transactions;
    });
  }
  async refundCreditsAtomic(userId, transactionIds, reason) {
    return await this.db.transaction(async (tx) => {
      const user = await this.getUser(userId);
      if (!user?.organizationId) {
        throw new Error("User not associated with an organization");
      }
      const organizationId = user.organizationId;
      const refundTransactions = [];
      for (const txId of transactionIds) {
        const originalTxResult = await tx.select().from(creditTransactions).where(eq(creditTransactions.id, txId));
        const originalTx = originalTxResult[0];
        if (!originalTx) {
          throw new Error(`Transaction ${txId} not found`);
        }
        if (originalTx.userId !== userId) {
          throw new Error(`Transaction ${txId} does not belong to user`);
        }
        if (originalTx.organizationId !== organizationId) {
          throw new Error(`Transaction ${txId} does not belong to organization`);
        }
        if (originalTx.delta >= 0) {
          throw new Error(`Transaction ${txId} is not a consumption`);
        }
        const grantResult = await tx.select().from(creditGrants).where(
          and(
            eq(creditGrants.id, originalTx.grantId),
            eq(creditGrants.organizationId, organizationId)
          )
        );
        const grant = grantResult[0];
        if (!grant) {
          throw new Error(`Grant ${originalTx.grantId} not found`);
        }
        const refundAmount = Math.abs(originalTx.delta);
        await tx.update(creditGrants).set({
          creditsConsumed: grant.creditsConsumed - refundAmount,
          creditsRemaining: grant.creditsRemaining + refundAmount
        }).where(eq(creditGrants.id, grant.id));
        const refundTxResult = await tx.insert(creditTransactions).values({
          organizationId,
          userId,
          grantId: grant.id,
          messageId: originalTx.messageId,
          delta: refundAmount,
          reason: `Refund: ${reason}`
        }).returning();
        refundTransactions.push(refundTxResult[0]);
      }
      return refundTransactions;
    });
  }
  async getPlatformSettings() {
    const existing = await this.db.select().from(platformSettings).limit(1);
    if (existing[0]) {
      return existing[0];
    }
    const inserted = await this.db.insert(platformSettings).values({
      feedbackEmail: "Feedback@HeyTeam.ai",
      supportEmail: "support@heyteam.ai"
    }).returning();
    return inserted[0];
  }
  async updatePlatformSettings(updates) {
    const current = await this.getPlatformSettings();
    const result = await this.db.update(platformSettings).set({
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(platformSettings.id, current.id)).returning();
    return result[0];
  }
  // Reseller methods
  async getAllResellers() {
    return await this.db.select().from(resellers);
  }
  async getReseller(id) {
    const result = await this.db.select().from(resellers).where(eq(resellers.id, id));
    return result[0];
  }
  async getResellerByReferralCode(code) {
    const result = await this.db.select().from(resellers).where(eq(resellers.referralCode, code));
    return result[0];
  }
  async createReseller(reseller) {
    const result = await this.db.insert(resellers).values(reseller).returning();
    return result[0];
  }
  async updateReseller(id, updates) {
    const result = await this.db.update(resellers).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(resellers.id, id)).returning();
    return result[0];
  }
  async deleteReseller(id) {
    await this.db.delete(resellers).where(eq(resellers.id, id));
  }
  async createResellerTransaction(transaction) {
    const result = await this.db.insert(resellerTransactions).values(transaction).returning();
    return result[0];
  }
  async getResellerTransactions(resellerId) {
    return await this.db.select().from(resellerTransactions).where(eq(resellerTransactions.resellerId, resellerId)).orderBy(desc(resellerTransactions.occurredAt));
  }
  async getResellerTransactionsByMonth(resellerId, month, year) {
    const { sql: sql3 } = await import("drizzle-orm");
    return await this.db.select().from(resellerTransactions).where(
      and(
        eq(resellerTransactions.resellerId, resellerId),
        sql3`EXTRACT(MONTH FROM ${resellerTransactions.occurredAt}) = ${month}`,
        sql3`EXTRACT(YEAR FROM ${resellerTransactions.occurredAt}) = ${year}`
      )
    );
  }
  async getResellerTransactionByStripeEventId(eventId) {
    const result = await this.db.select().from(resellerTransactions).where(eq(resellerTransactions.stripeEventId, eventId));
    return result[0];
  }
  async getResellerPayout(resellerId, month, year) {
    const result = await this.db.select().from(resellerPayouts).where(
      and(
        eq(resellerPayouts.resellerId, resellerId),
        eq(resellerPayouts.month, month),
        eq(resellerPayouts.year, year)
      )
    );
    return result[0];
  }
  async getResellerPayouts(resellerId) {
    return await this.db.select().from(resellerPayouts).where(eq(resellerPayouts.resellerId, resellerId)).orderBy(desc(resellerPayouts.year), desc(resellerPayouts.month));
  }
  async createOrUpdateResellerPayout(payout) {
    const existing = await this.getResellerPayout(payout.resellerId, payout.month, payout.year);
    if (existing) {
      const result = await this.db.update(resellerPayouts).set({ ...payout, updatedAt: /* @__PURE__ */ new Date() }).where(eq(resellerPayouts.id, existing.id)).returning();
      return result[0];
    } else {
      const result = await this.db.insert(resellerPayouts).values(payout).returning();
      return result[0];
    }
  }
  // Feedback methods
  async createFeedback(organizationId, userId, insertFeedback) {
    const result = await this.db.insert(feedback).values({
      ...insertFeedback,
      organizationId,
      userId,
      status: "new"
    }).returning();
    return result[0];
  }
  async getAllFeedback() {
    return await this.db.select().from(feedback).orderBy(desc(feedback.createdAt));
  }
  async updateFeedbackStatus(id, status) {
    const result = await this.db.update(feedback).set({ status }).where(eq(feedback.id, id)).returning();
    return result[0];
  }
  // Device token methods
  async saveDeviceToken(contactId, token, platform) {
    const existing = await this.db.select().from(deviceTokens).where(eq(deviceTokens.token, token)).limit(1);
    if (existing.length > 0) {
      await this.db.update(deviceTokens).set({
        contactId,
        platform,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(deviceTokens.token, token));
    } else {
      await this.db.insert(deviceTokens).values({
        contactId,
        token,
        platform
      });
    }
  }
  async getDeviceTokensForContact(contactId) {
    return await this.db.select().from(deviceTokens).where(eq(deviceTokens.contactId, contactId));
  }
  async getDeviceTokensForContacts(contactIds) {
    if (contactIds.length === 0) {
      return [];
    }
    return await this.db.select().from(deviceTokens).where(inArray(deviceTokens.contactId, contactIds));
  }
  async removeDeviceToken(token) {
    await this.db.delete(deviceTokens).where(eq(deviceTokens.token, token));
  }
  // Push Notification Delivery methods
  async createPushNotificationDelivery(delivery) {
    const result = await this.db.insert(pushNotificationDeliveries).values(delivery).returning();
    return result[0];
  }
  async updatePushNotificationDelivery(id, updates) {
    const result = await this.db.update(pushNotificationDeliveries).set(updates).where(eq(pushNotificationDeliveries.id, id)).returning();
    return result[0];
  }
  async getPushNotificationDeliveryByNotificationId(notificationId) {
    const result = await this.db.select().from(pushNotificationDeliveries).where(eq(pushNotificationDeliveries.notificationId, notificationId));
    return result[0];
  }
  async getUndeliveredNotifications(olderThanSeconds) {
    const cutoffTime = new Date(Date.now() - olderThanSeconds * 1e3);
    return await this.db.select().from(pushNotificationDeliveries).where(
      and(
        eq(pushNotificationDeliveries.status, "sent"),
        lt(pushNotificationDeliveries.createdAt, cutoffTime)
      )
    );
  }
};

// server/storage.ts
var storage = new DbStorage();

// server/lib/credit-service.ts
var CreditService = class {
  constructor(storage2) {
    this.storage = storage2;
  }
  /**
   * Grant credits to a user from a specific source (trial, subscription, bundle)
   */
  async grantCredits(userId, sourceType, creditsGranted, sourceRef = null, expiresAt = null) {
    const organizationId = await this.getUserOrganizationId(userId);
    const grant = {
      userId,
      organizationId,
      sourceType,
      sourceRef,
      creditsGranted,
      creditsConsumed: 0,
      creditsRemaining: creditsGranted,
      expiresAt
    };
    return await this.storage.createCreditGrant(userId, grant);
  }
  /**
   * Consume credits using FIFO (First In, First Out) by expiry date
   * Credits expiring soonest are used first, then non-expiring credits
   * Returns the credit transactions created
   * This operation is atomic and transaction-safe
   */
  async consumeCredits(userId, amount, reason, messageId = null) {
    return await this.storage.consumeCreditsAtomic(userId, amount, reason, messageId);
  }
  /**
   * Refund credits back to their original grant
   * This reverses a previous consumption
   * This operation is atomic and transaction-safe
   */
  async refundCredits(userId, transactionIds, reason) {
    return await this.storage.refundCreditsAtomic(userId, transactionIds, reason);
  }
  /**
   * Get the total available credits for a user
   * Excludes expired grants
   */
  async getAvailableCredits(userId) {
    const grants = await this.storage.getCreditGrants(userId);
    const now = /* @__PURE__ */ new Date();
    const activeGrants = grants.filter((g) => {
      if (g.creditsRemaining <= 0) return false;
      if (g.expiresAt && g.expiresAt <= now) return false;
      return true;
    });
    return activeGrants.reduce((total, g) => total + g.creditsRemaining, 0);
  }
  async getAvailableCreditsForOrganization(organizationId) {
    const grants = await this.storage.getCreditGrantsByOrganization(organizationId);
    const now = /* @__PURE__ */ new Date();
    const activeGrants = grants.filter((g) => {
      if (g.creditsRemaining <= 0) return false;
      if (g.expiresAt && g.expiresAt <= now) return false;
      return true;
    });
    return activeGrants.reduce((total, g) => total + g.creditsRemaining, 0);
  }
  /**
   * Get a detailed breakdown of credits by source
   */
  async getCreditBreakdown(userId) {
    const grants = await this.storage.getCreditGrants(userId);
    const now = /* @__PURE__ */ new Date();
    const breakdown = {
      total: 0,
      trial: 0,
      subscription: 0,
      bundle: 0,
      expired: 0
    };
    for (const grant of grants) {
      const isExpired = grant.expiresAt && grant.expiresAt <= now;
      if (isExpired) {
        breakdown.expired += grant.creditsRemaining;
      } else {
        breakdown.total += grant.creditsRemaining;
        switch (grant.sourceType) {
          case "trial":
            breakdown.trial += grant.creditsRemaining;
            break;
          case "subscription":
            breakdown.subscription += grant.creditsRemaining;
            break;
          case "bundle":
            breakdown.bundle += grant.creditsRemaining;
            break;
        }
      }
    }
    return breakdown;
  }
  async getUserOrganizationId(userId) {
    const user = await this.storage.getUser(userId);
    if (!user?.organizationId) {
      throw new Error("User not associated with an organization");
    }
    return user.organizationId;
  }
  async consumeCreditsForOrganization(organizationId, amount, reason, messageId = null) {
    return await this.storage.consumeCreditsAtomicByOrganization(
      organizationId,
      amount,
      reason,
      messageId
    );
  }
};

// server/lib/twilio-client.ts
import "dotenv/config";
import twilio from "twilio";
function getCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error("Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your .env file");
  }
  return {
    accountSid,
    authToken,
    phoneNumber
  };
}
async function getTwilioClient() {
  const { accountSid, authToken } = getCredentials();
  return twilio(accountSid, authToken);
}
async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = getCredentials();
  return phoneNumber;
}

// server/lib/template-renderer.ts
import { format } from "date-fns";
function renderTemplate(template, contact, job) {
  return template.replace(/{FirstName}/g, contact.firstName).replace(/{LastName}/g, contact.lastName).replace(/{JobName}/g, job.name).replace(/{Date}/g, format(new Date(job.startTime), "MMMM d, yyyy")).replace(/{Time}/g, format(new Date(job.startTime), "h:mm a")).replace(/{FromDate}/g, format(new Date(job.startTime), "MMMM d, yyyy")).replace(/{ToDate}/g, format(new Date(job.endTime), "MMMM d, yyyy")).replace(/{FromTime}/g, format(new Date(job.startTime), "h:mm a")).replace(/{ToTime}/g, format(new Date(job.endTime), "h:mm a")).replace(/{Location}/g, job.location).replace(/{Notes}/g, job.notes || "");
}

// server/lib/reply-parser.ts
function parseReply(message) {
  const normalized = message.trim().toLowerCase();
  if (normalized === "y" || normalized === "yes" || normalized === "\u{1F44D}") {
    return { status: "confirmed" };
  }
  if (normalized === "n" || normalized === "no" || normalized === "\u{1F44E}") {
    return { status: "declined" };
  }
  if (normalized === "1") {
    return { status: "confirmed", shiftPreference: "AM Shift" };
  }
  if (normalized === "2") {
    return { status: "confirmed", shiftPreference: "PM Shift" };
  }
  if (normalized === "3") {
    return { status: "confirmed", shiftPreference: "Full Day" };
  }
  if (normalized === "maybe" || normalized === "m") {
    return { status: "maybe" };
  }
  return { status: "no_reply" };
}

// server/lib/ics-generator.ts
function generateICS(job) {
  const now = /* @__PURE__ */ new Date();
  const dtStamp = formatICSDate(now);
  const dtStart = formatICSDate(new Date(job.startTime));
  const dtEnd = formatICSDate(new Date(job.endTime));
  const uid = `${job.id}@heyteam.app`;
  const summary = escapeICSText(job.name);
  const description = job.description ? escapeICSText(job.description) : "";
  const location = job.location ? escapeICSText(job.location) : "";
  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HeyTeam//Job Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`
  ];
  if (description) {
    icsLines.push(`DESCRIPTION:${description}`);
  }
  if (location) {
    icsLines.push(`LOCATION:${location}`);
  }
  icsLines.push(
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR"
  );
  return icsLines.join("\r\n");
}
function formatICSDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}
function escapeICSText(text2) {
  return text2.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// server/mobile-auth-routes.ts
import { Router } from "express";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { z as z2 } from "zod";
var creditService = new CreditService(storage);
var router = Router();
var getMobileUserId = (req) => {
  const userId = req.headers["x-user-id"];
  if (userId) {
    return userId;
  }
  return null;
};
var requireMobileAuth = async (req, res, next) => {
  const userId = getMobileUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Not authenticated - missing X-User-ID header" });
  }
  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }
  req.user = user;
  req.userId = userId;
  next();
};
router.post("/register", async (req, res) => {
  try {
    const { username, firstName, lastName, email, password, countryCode, mobileNumber, referralCode } = req.body;
    const { username: validUsername, firstName: validFirstName, lastName: validLastName, email: validEmail, password: validPassword, countryCode: validCountryCode, mobileNumber: validMobileNumber } = insertUserSchema.parse({ username, firstName, lastName, email, password, countryCode, mobileNumber });
    const existingUser = await storage.getUserByUsername(validUsername);
    if (existingUser) {
      return res.status(400).json({ message: "Company name already exists" });
    }
    const existingEmail = await storage.getUserByEmail(validEmail);
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }
    let resellerId = null;
    if (referralCode) {
      const reseller = await storage.getResellerByReferralCode(referralCode);
      if (!reseller) {
        return res.status(400).json({ message: "Invalid referral code" });
      }
      if (reseller.status !== "active") {
        return res.status(400).json({ message: "This referral code is no longer active" });
      }
      resellerId = reseller.id;
    }
    const hashedPassword = await bcrypt.hash(validPassword, 10);
    const user = await storage.createUser({
      username: validUsername,
      firstName: validFirstName,
      lastName: validLastName,
      email: validEmail,
      password: hashedPassword,
      countryCode: validCountryCode,
      mobileNumber: validMobileNumber,
      resellerId
    });
    await creditService.grantCredits(
      user.id,
      "trial",
      10,
      null,
      // No source reference
      null
      // No expiry for trial credits
    );
    console.log(`[Mobile Register] User created: ${user.email}, ID: ${user.id}`);
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      currency: user.currency,
      isAdmin: user.isAdmin,
      organizationId: user.organizationId,
      teamRole: user.teamRole,
      emailVerified: user.emailVerified,
      mobileVerified: user.mobileVerified,
      userId: user.id
      // For mobile apps - store this in preferences
    });
  } catch (error) {
    console.error("Register error:", error);
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: error.message || "Failed to register" });
  }
});
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    const user = await storage.getUserByEmail(email);
    if (user) {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      console.log(`[Mobile Login] User logged in: ${user.email}, ID: ${user.id}`);
      return res.json({
        type: "user",
        id: user.id,
        username: user.username,
        email: user.email,
        currency: user.currency,
        isAdmin: user.isAdmin,
        organizationId: user.organizationId,
        teamRole: user.teamRole,
        emailVerified: user.emailVerified,
        mobileVerified: user.mobileVerified,
        userId: user.id
        // For mobile apps - store this in preferences
      });
    }
    const contact = await storage.getContactByEmail(email);
    if (contact && contact.hasLogin) {
      if (!contact.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const validPassword = await bcrypt.compare(password, contact.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      await storage.updateContact(contact.id, { lastLoginAt: /* @__PURE__ */ new Date() });
      console.log(`[Mobile Login] Contact logged in: ${contact.email}, ID: ${contact.id}`);
      return res.json({
        type: "contact",
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        organizationId: contact.organizationId,
        phone: contact.phone,
        countryCode: contact.countryCode,
        contactId: contact.id
        // For mobile apps - store this in preferences
      });
    }
    return res.status(401).json({ message: "Invalid credentials" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: error.message || "Failed to login" });
  }
});
router.get("/me", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const contactId = req.headers["x-contact-id"];
    console.log("UserID:", userId);
    console.log("ContactID:", contactId);
    if (userId) {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      return res.json({
        type: "user",
        id: user.id,
        username: user.username,
        email: user.email,
        currency: user.currency,
        isAdmin: user.isAdmin,
        organizationId: user.organizationId,
        teamRole: user.teamRole,
        emailVerified: user.emailVerified,
        mobileVerified: user.mobileVerified
      });
    }
    if (contactId) {
      const contact = await storage.getContactById(contactId);
      if (!contact) {
        return res.status(401).json({ message: "Contact not found" });
      }
      return res.json({
        type: "contact",
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        organizationId: contact.organizationId,
        phone: contact.phone,
        countryCode: contact.countryCode
      });
    }
    return res.status(401).json({ message: "Not authenticated - missing X-User-ID or X-Contact-ID header" });
  } catch (error) {
    console.error("Get user/contact error:", error);
    res.status(500).json({ message: "Failed to get user/contact" });
  }
});
router.post("/logout", requireMobileAuth, async (req, res) => {
  res.json({ message: "Logged out successfully" });
});
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.json({ message: "If that email exists, a password reset link has been sent" });
    }
    const resetToken = randomBytes(32).toString("hex");
    res.json({ message: "If that email exists, a password reset link has been sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Failed to send password reset email" });
  }
});
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: "Token and password required" });
    }
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});
var mobile_auth_routes_default = router;

// server/routes.ts
import Stripe from "stripe";

// server/auth-routes.ts
import { Router as Router2 } from "express";
import bcrypt2 from "bcrypt";
import { randomBytes as randomBytes2 } from "crypto";
import { z as z3 } from "zod";

// server/email.ts
import "dotenv/config";
import { Resend } from "resend";
function escapeHtml(text2) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text2.replace(/[&<>"']/g, (char) => map[char]);
}
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}
async function sendPasswordResetEmail(to, resetToken, resetUrl) {
  try {
    const { client, fromEmail } = getResendClient();
    await client.emails.send({
      from: fromEmail,
      to,
      subject: "Reset Your HeyTeam Password",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
              .code { background: #e5e7eb; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 18px; letter-spacing: 2px; text-align: center; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Reset Your Password</h1>
              </div>
              <div class="content">
                <p>Hi there,</p>
                <p>We received a request to reset your HeyTeam password. Click the button below to set a new password:</p>
                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Password</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <div class="code">${resetUrl}</div>
                <p><strong>This link will expire in 1 hour.</strong></p>
                <p>If you didn't request this password reset, you can safely ignore this email.</p>
              </div>
              <div class="footer">
                <p>\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} HeyTeam. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `
    });
    console.log(`Password reset email sent to ${to}`);
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    throw error;
  }
}
async function sendTeamInvitationEmail(to, firstName, temporaryPassword, organizationName, invitedByName, loginUrl) {
  try {
    const { client, fromEmail } = getResendClient();
    const escapedFirstName = escapeHtml(firstName);
    const escapedOrgName = escapeHtml(organizationName);
    const escapedInvitedBy = escapeHtml(invitedByName);
    await client.emails.send({
      from: fromEmail,
      to,
      subject: `You've been invited to join ${escapedOrgName} on HeyTeam`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
              .credentials { background: white; border: 2px solid #2563eb; padding: 20px; border-radius: 6px; margin: 20px 0; }
              .credential-row { margin: 10px 0; }
              .credential-label { font-weight: 600; color: #6b7280; }
              .credential-value { font-family: monospace; background: #e5e7eb; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 5px; }
              .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 6px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Welcome to HeyTeam!</h1>
              </div>
              <div class="content">
                <p>Hi ${escapedFirstName},</p>
                <p><strong>${escapedInvitedBy}</strong> has invited you to join <strong>${escapedOrgName}</strong> on HeyTeam.</p>
                <p>HeyTeam is a workforce coordination platform that helps teams manage jobs, schedules, and communication.</p>
                
                <div class="credentials">
                  <h3 style="margin-top: 0;">Your Login Credentials</h3>
                  <div class="credential-row">
                    <div class="credential-label">Email:</div>
                    <div class="credential-value">${to}</div>
                  </div>
                  <div class="credential-row">
                    <div class="credential-label">Temporary Password:</div>
                    <div class="credential-value">${temporaryPassword}</div>
                  </div>
                </div>
                
                <div class="warning">
                  <strong>\u26A0\uFE0F Important:</strong> Please change your password after your first login for security.
                </div>
                
                <div style="text-align: center;">
                  <a href="${loginUrl}" class="button">Log In to HeyTeam</a>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                  If you have any questions, please contact your team administrator.
                </p>
              </div>
              <div class="footer">
                <p>\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} HeyTeam. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `
    });
    console.log(`Team invitation email sent to ${to}`);
  } catch (error) {
    console.error("Failed to send team invitation email:", error);
    throw error;
  }
}
async function sendTeamMessageNotification(to, fromUserName, messagePreview, loginUrl) {
  try {
    const { client, fromEmail } = getResendClient();
    const escapedFromUserName = escapeHtml(fromUserName);
    const escapedMessagePreview = escapeHtml(messagePreview);
    await client.emails.send({
      from: fromEmail,
      to,
      subject: `New message from ${escapedFromUserName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .message-box { background: white; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 6px; white-space: pre-wrap; word-wrap: break-word; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">New Team Message</h1>
              </div>
              <div class="content">
                <p>Hi,</p>
                <p><strong>${escapedFromUserName}</strong> sent you a message:</p>
                <div class="message-box">
                  <p style="margin: 0;">${escapedMessagePreview}</p>
                </div>
                <div style="text-align: center;">
                  <a href="${loginUrl}" class="button">View Message</a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">Log in to HeyTeam to read the full message and reply.</p>
              </div>
              <div class="footer">
                <p>\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} HeyTeam. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `
    });
    console.log(`Team message notification email sent to ${to}`);
  } catch (error) {
    console.error("Failed to send team message notification email:", error);
    throw error;
  }
}
async function sendFeedbackNotificationEmail(to, context) {
  try {
    const { client, fromEmail } = getResendClient();
    const displayName = [context.user.firstName, context.user.lastName].filter(Boolean).join(" ") || context.user.username || context.user.email;
    const escapedDisplayName = escapeHtml(displayName);
    const escapedEmail = escapeHtml(context.user.email);
    const escapedOrganization = context.organizationName ? escapeHtml(context.organizationName) : null;
    const escapedMessage = escapeHtml(context.message).replace(/\n/g, "<br />");
    await client.emails.send({
      from: fromEmail,
      to,
      subject: `New HeyTeam Feedback from ${escapedDisplayName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #111827; background: #f9fafb; padding: 0; margin: 0; }
              .container { max-width: 640px; margin: 0 auto; padding: 32px 24px; }
              .card { background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); }
              .header { border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px; }
              .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
              .meta-item { padding: 12px 16px; background: #f3f4f6; border-radius: 8px; }
              .meta-label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 4px; }
              .message-box { background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; }
              .message-box p { margin: 0; white-space: normal; }
              .footer { margin-top: 24px; font-size: 12px; color: #6b7280; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="card">
                <div class="header">
                  <h2 style="margin: 0; font-size: 22px; color: #111827;">New Feedback Received</h2>
                </div>
                <div class="meta">
                  <div class="meta-item">
                    <span class="meta-label">Submitted By</span>
                    <span>${escapedDisplayName}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Email Address</span>
                    <span>${escapedEmail}</span>
                  </div>
                  ${escapedOrganization ? `
                    <div class="meta-item">
                      <span class="meta-label">Organization</span>
                      <span>${escapedOrganization}</span>
                    </div>
                  ` : ""}
                </div>
                <div class="message-box">
                  <p>${escapedMessage}</p>
                </div>
              </div>
              <div class="footer">
                <p>\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} HeyTeam. Feedback notification.</p>
              </div>
            </div>
          </body>
        </html>
      `
    });
    console.log(`Feedback notification email sent to ${to}`);
  } catch (error) {
    console.error("Failed to send feedback notification email:", error);
    throw error;
  }
}
async function sendCancellationNotification(userInfo, reason) {
  try {
    const { client, fromEmail } = getResendClient();
    await client.emails.send({
      from: fromEmail,
      to: "Nadeem.Mohammed@deffinity.com",
      subject: `HeyTeam Subscription Cancellation - ${userInfo.username}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #dc2626; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }
              .info-box { background: white; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0; border-radius: 6px; }
              .reason-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 6px; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
              .label { font-weight: bold; color: #374151; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">\u{1F6A8} Subscription Cancellation Alert</h1>
              </div>
              <div class="content">
                <p>A HeyTeam subscription has been canceled. Here are the details:</p>
                
                <div class="info-box">
                  <p><span class="label">User:</span> ${escapeHtml(userInfo.username)} (${escapeHtml(userInfo.firstName || "")} ${escapeHtml(userInfo.lastName || "")})</p>
                  <p><span class="label">Email:</span> ${escapeHtml(userInfo.email)}</p>
                  <p><span class="label">User ID:</span> ${escapeHtml(userInfo.id)}</p>
                  <p><span class="label">Cancellation Date:</span> ${(/* @__PURE__ */ new Date()).toLocaleString()}</p>
                </div>
                
                <div class="reason-box">
                  <p><span class="label">Cancellation Reason:</span></p>
                  <p>${escapeHtml(reason)}</p>
                </div>
                
                <p>This cancellation has been automatically logged as feedback in the system for review.</p>
              </div>
              <div class="footer">
                <p>\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} HeyTeam. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `
    });
    console.log(`Cancellation notification sent to Nadeem.Mohammed@deffinity.com`);
  } catch (error) {
    console.error("Failed to send cancellation notification:", error);
    throw error;
  }
}

// server/auth-routes.ts
var creditService2 = new CreditService(storage);
var router2 = Router2();
router2.post("/register", async (req, res) => {
  try {
    const { username, firstName, lastName, email, password, countryCode, mobileNumber, referralCode } = req.body;
    const { username: validUsername, firstName: validFirstName, lastName: validLastName, email: validEmail, password: validPassword, countryCode: validCountryCode, mobileNumber: validMobileNumber } = insertUserSchema.parse({ username, firstName, lastName, email, password, countryCode, mobileNumber });
    const existingUser = await storage.getUserByUsername(validUsername);
    if (existingUser) {
      return res.status(400).json({ message: "Company name already exists" });
    }
    const existingEmail = await storage.getUserByEmail(validEmail);
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }
    let resellerId = null;
    if (referralCode) {
      const reseller = await storage.getResellerByReferralCode(referralCode);
      if (!reseller) {
        return res.status(400).json({ message: "Invalid referral code" });
      }
      if (reseller.status !== "active") {
        return res.status(400).json({ message: "This referral code is no longer active" });
      }
      resellerId = reseller.id;
      console.log(`New registration with referral code: ${referralCode} (reseller: ${reseller.name})`);
    }
    const hashedPassword = await bcrypt2.hash(validPassword, 10);
    const user = await storage.createUser({
      username: validUsername,
      // Company name
      firstName: validFirstName,
      lastName: validLastName,
      email: validEmail,
      countryCode: validCountryCode,
      mobileNumber: validMobileNumber,
      password: hashedPassword,
      resellerId
    });
    await creditService2.grantCredits(
      user.id,
      "trial",
      10,
      null,
      // No source reference
      null
      // No expiry for trial credits
    );
    const tomorrow = /* @__PURE__ */ new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const endTime = new Date(tomorrow);
    endTime.setHours(17, 0, 0, 0);
    const defaultTemplates = [
      {
        name: "Job Invitation",
        content: "Hi {FirstName}, we have a new job opportunity: {JobName} at {Location} from {FromDate} {FromTime} to {ToDate} {ToTime}. Reply Y to confirm or N to decline.",
        includeRosterLink: true
      },
      {
        name: "Job Cancellation",
        content: "Hi {FirstName}, unfortunately {JobName} scheduled for {Date} at {Time} has been cancelled. We'll notify you of new opportunities soon.",
        includeRosterLink: false
      },
      {
        name: "Job Reminder",
        content: "Reminder: {FirstName}, you're confirmed for {JobName} tomorrow at {Location}. Start time: {Time}. See you there!",
        includeRosterLink: true
      },
      {
        name: "Availability Request",
        content: "Hi {FirstName}, we need crew for {JobName} on {Date} at {Location}. Are you available? Reply Y for yes or N for no.",
        includeRosterLink: false
      },
      {
        name: "Shift Confirmation",
        content: "Confirmed! {FirstName}, you're scheduled for {JobName} at {Location} from {FromTime} to {ToTime} on {FromDate}. Thanks!",
        includeRosterLink: true
      }
    ];
    for (const template of defaultTemplates) {
      await storage.createTemplate(user.organizationId ?? "", user.id, template);
    }
    console.log(`New registration: ${username} - Granted 10 trial SMS credits`);
    console.log(`Created sample job and ${defaultTemplates.length} preset templates`);
    console.log(`Email: ${email}`);
    console.log(`Mobile: ${countryCode} ${mobileNumber}`);
    console.log(`Account created but not verified`);
    req.session.userId = user.id;
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      organizationId: user.organizationId,
      teamRole: user.teamRole,
      emailVerified: user.emailVerified,
      mobileVerified: user.mobileVerified
    });
  } catch (error) {
    if (error instanceof z3.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});
router2.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    const user = await storage.getUserByEmail(email);
    if (user) {
      const validPassword = await bcrypt2.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.userId = user.id;
      return res.json({
        _sessionCookie: `connect.sid=${req.sessionID}`,
        type: "user",
        id: user.id,
        username: user.username,
        email: user.email,
        currency: user.currency,
        isAdmin: user.isAdmin,
        organizationId: user.organizationId,
        teamRole: user.teamRole,
        emailVerified: user.emailVerified,
        mobileVerified: user.mobileVerified
      });
    }
    const contact = await storage.getContactByEmail(email);
    if (contact) {
      if (!contact.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const validPassword = await bcrypt2.compare(password, contact.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      await storage.updateContact(contact.id, { lastLoginAt: /* @__PURE__ */ new Date() });
      req.session.contactId = contact.id;
      return res.json({
        _sessionCookie: `connect.sid=${req.sessionID}`,
        type: "contact",
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        organizationId: contact.organizationId,
        phone: contact.phone,
        countryCode: contact.countryCode
      });
    }
    return res.status(401).json({ message: "Invalid credentials" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});
router2.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.json({ message: "Logged out successfully" });
  });
});
router2.post("/mobile/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});
router2.get("/me", async (req, res) => {
  try {
    const getUserFromSession = async (session2) => {
      if (session2?.userId) {
        const user = await storage.getUser(session2.userId);
        if (!user) return null;
        return {
          type: "user",
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          mobileNumber: user.mobileNumber,
          countryCode: user.countryCode,
          currency: user.currency,
          isAdmin: user.isAdmin,
          organizationId: user.organizationId,
          teamRole: user.teamRole,
          emailVerified: user.emailVerified,
          mobileVerified: user.mobileVerified
        };
      }
      if (session2?.contactId) {
        const contact = await storage.getContactById(session2.contactId);
        if (!contact) return null;
        return {
          type: "contact",
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          organizationId: contact.organizationId,
          phone: contact.phone,
          countryCode: contact.countryCode
        };
      }
      return null;
    };
    if (req.session) {
      const userData = await getUserFromSession(req.session);
      if (userData) {
        console.log(`[/me] \u2705 Returning ${userData.type} from normal session`);
        return res.json(userData);
      }
    }
    const rawCookie = req.headers.cookie;
    if (rawCookie) {
      const match = rawCookie.match(/connect\.sid=([^;]+)/);
      if (match) {
        const sid = match[1];
        req.sessionID = sid;
        return req.sessionStore.get(sid, async (err, session2) => {
          if (err) {
            console.error("[/me] \u274C Error reading session store:", err);
            return res.status(401).json({ message: "Not authenticated" });
          }
          console.log("[/me] Manual restore session result:", session2);
          if (!session2) {
            console.log("[/me] \u274C Manual session restore failed - no session");
            return res.status(401).json({ message: "Not authenticated" });
          }
          const userData = await getUserFromSession(session2);
          if (userData) {
            console.log(`[/me] \u2705 Returning ${userData.type} from manual session restore`);
            return res.json(userData);
          }
          console.log("[/me] \u274C No valid userId or contactId in session");
          return res.status(401).json({ message: "Not authenticated" });
        });
      }
    }
    console.log("[/me] \u274C No session detected, returning 401");
    return res.status(401).json({ message: "Not authenticated" });
  } catch (error) {
    console.error("Get user/contact error:", error);
    res.status(500).json({ message: "Failed to get user/contact" });
  }
});
router2.patch("/profile", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { firstName, lastName, email, mobileNumber, countryCode } = req.body;
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: "First name, last name, and email are required" });
    }
    const updatedUser = await storage.updateUser(req.session.userId, {
      firstName,
      lastName,
      email,
      mobileNumber: mobileNumber || null,
      countryCode: countryCode || null
    });
    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      mobileNumber: updatedUser.mobileNumber,
      countryCode: updatedUser.countryCode,
      currency: updatedUser.currency,
      isAdmin: updatedUser.isAdmin,
      organizationId: updatedUser.organizationId,
      teamRole: updatedUser.teamRole
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});
router2.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.json({ message: "If the email exists, a reset link will be sent" });
    }
    const token = randomBytes2(32).toString("hex");
    const expiresAt = new Date(Date.now() + 36e5);
    await storage.createPasswordResetToken({
      userId: user.id,
      token,
      expiresAt
    });
    const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${token}`;
    try {
      await sendPasswordResetEmail(email, token, resetUrl);
      console.log(`Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
    }
    res.json({ message: "If the email exists, a reset link will be sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Failed to process request" });
  }
});
router2.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: "Token and password required" });
    }
    const resetToken = await storage.getPasswordResetToken(token);
    if (!resetToken) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    if (/* @__PURE__ */ new Date() > resetToken.expiresAt) {
      await storage.deletePasswordResetToken(token);
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    const hashedPassword = await bcrypt2.hash(password, 10);
    await storage.updateUserPassword(resetToken.userId, hashedPassword);
    await storage.deletePasswordResetToken(token);
    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});
var auth_routes_default = router2;

// server/routes.ts
import PDFDocument from "pdfkit";

// server/push-notifications.ts
import * as apn from "apn";
import * as admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve } from "path";
import { randomBytes as randomBytes3 } from "crypto";
var apnProvider = null;
var fcmInitialized = false;
function initializeAPNs() {
  if (apnProvider) {
    return apnProvider;
  }
  const keyPath = process.env.APNS_KEY_PATH;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID || "ai.heyteam.portal";
  const production = true;
  if (!keyPath || !keyId || !teamId) {
    console.warn("[PushNotifications] APNs not configured - missing environment variables");
    return null;
  }
  try {
    const resolvedPath = keyPath.startsWith("/") ? keyPath : resolve(process.cwd(), keyPath);
    const key = readFileSync(resolvedPath, "utf8");
    apnProvider = new apn.Provider({
      token: {
        key,
        keyId,
        teamId
      },
      production
      // Set to true for production, false for sandbox
    });
    console.log("[PushNotifications] APNs initialized successfully");
    return apnProvider;
  } catch (error) {
    console.error("[PushNotifications] Failed to initialize APNs:", error);
    return null;
  }
}
function initializeFCM() {
  if (fcmInitialized) {
    return true;
  }
  const serviceAccountPath = process.env.FCM_SERVICE_ACCOUNT_PATH;
  const fcmServerKey = process.env.FCM_SERVER_KEY;
  if (!serviceAccountPath && !fcmServerKey) {
    console.warn("[PushNotifications] FCM not configured - missing environment variables");
    return false;
  }
  try {
    if (serviceAccountPath) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else if (fcmServerKey) {
      console.log("[PushNotifications] FCM server key provided - will use HTTP API");
    }
    fcmInitialized = true;
    console.log("[PushNotifications] FCM initialized successfully");
    return true;
  } catch (error) {
    console.error("[PushNotifications] Failed to initialize FCM:", error);
    return false;
  }
}
function generateNotificationId() {
  return `notif_${Date.now()}_${randomBytes3(8).toString("hex")}`;
}
async function sendPushNotification(token, platform, notification) {
  const notificationId = notification.notificationId || generateNotificationId();
  try {
    if (platform === "ios") {
      const provider = initializeAPNs();
      if (!provider) {
        console.warn("[PushNotifications] APNs provider not available");
        return { success: false, notificationId };
      }
      const bundleId = process.env.APNS_BUNDLE_ID || "ai.heyteam.portal";
      const note = new apn.Notification();
      note.alert = {
        title: notification.title,
        body: notification.body
      };
      note.topic = bundleId;
      note.sound = "default";
      note.badge = 1;
      note.category = "JOB_INVITATION";
      note.threadId = notification.data?.jobId || "default";
      note.payload = {
        ...notification.data,
        notificationId,
        actionType: "job_invitation"
      };
      console.log("[PushNotifications] APNs notification:", note);
      const result = await provider.send(note, token);
      console.log("[PushNotifications] APNs result:", result);
      if (result.failed && result.failed.length > 0) {
        console.error("[PushNotifications] APNs send failed:", result.failed);
        const failure = result.failed[0];
        if (failure.response?.reason === "BadDeviceToken" || failure.response?.reason === "Unregistered") {
          console.log("[PushNotifications] Invalid token detected, should be removed:", token);
        }
        return { success: false, notificationId };
      }
      if (result.sent && result.sent.length > 0) {
        console.log("[PushNotifications] APNs notification sent successfully to:", token, "notificationId:", notificationId);
        return { success: true, notificationId };
      }
      return { success: false, notificationId };
    } else if (platform === "android") {
      if (admin.apps.length > 0) {
        try {
          const message = {
            notification: {
              title: notification.title,
              body: notification.body
            },
            data: {
              ...Object.fromEntries(
                Object.entries(notification.data || {}).map(([k, v]) => [k, String(v)])
              ),
              notificationId,
              actionType: "job_invitation"
            },
            token,
            android: {
              priority: "high",
              notification: {
                clickAction: "OPEN_INVITATIONS",
                sound: "default",
                channelId: "job_invitations"
              }
            },
            apns: {
              payload: {
                aps: {
                  category: "JOB_INVITATION",
                  threadId: notification.data?.jobId || "default"
                }
              }
            }
          };
          const response = await admin.messaging().send(message);
          console.log("[PushNotifications] FCM notification sent successfully:", response, "notificationId:", notificationId);
          return { success: true, notificationId };
        } catch (error) {
          console.error("[PushNotifications] FCM send error:", error);
          if (error.code === "messaging/invalid-registration-token" || error.code === "messaging/registration-token-not-registered") {
            console.log("[PushNotifications] Invalid FCM token detected, should be removed:", token);
          }
          return { success: false, notificationId };
        }
      } else {
        const fcmServerKey = process.env.FCM_SERVER_KEY;
        if (!fcmServerKey) {
          console.warn("[PushNotifications] FCM server key not available");
          return { success: false, notificationId };
        }
        const response = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Authorization": `key=${fcmServerKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            to: token,
            notification: {
              title: notification.title,
              body: notification.body
            },
            data: {
              ...notification.data,
              notificationId,
              actionType: "job_invitation"
            }
          })
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error("[PushNotifications] FCM HTTP API error:", errorText);
          return { success: false, notificationId };
        }
        const result = await response.json();
        if (result.success === 1) {
          console.log("[PushNotifications] FCM notification sent via HTTP API, notificationId:", notificationId);
          return { success: true, notificationId };
        } else {
          console.error("[PushNotifications] FCM HTTP API failed:", result);
          return { success: false, notificationId };
        }
      }
    }
    return { success: false, notificationId };
  } catch (error) {
    console.error("[PushNotifications] Unexpected error sending notification:", error);
    return { success: false, notificationId };
  }
}
async function sendPushNotificationsToContacts(deviceTokens2, notification) {
  const success = [];
  const failed = [];
  const notificationIds = [];
  const results = await Promise.allSettled(
    deviceTokens2.map(async ({ contactId, token, platform }) => {
      const result = await sendPushNotification(token, platform, notification);
      return { contactId, token, success: result.success, notificationId: result.notificationId };
    })
  );
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      if (result.value.success) {
        success.push(result.value.contactId);
        notificationIds.push({
          contactId: result.value.contactId,
          notificationId: result.value.notificationId,
          token: result.value.token
        });
      } else {
        failed.push(result.value.contactId);
      }
    } else {
      failed.push(deviceTokens2[index].contactId);
    }
  });
  return { success, failed, notificationIds };
}
initializeAPNs();
initializeFCM();

// server/routes.ts
import { format as format2 } from "date-fns";
import { z as z4 } from "zod";
var creditService3 = new CreditService(storage);
var stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-09-30.clover" }) : null;
var platformSettingsUpdateSchema = insertPlatformSettingsSchema.pick({
  feedbackEmail: true,
  supportEmail: true
}).partial();
var MESSAGE_BATCH_SIZE = 5;
var MESSAGE_BATCH_DELAY_MS = 2 * 60 * 1e3;
var DISTANCE_MATRIX_BATCH_SIZE = 25;
var DEFAULT_DISTANCE_THRESHOLD_METERS = 5e4;
function parseBlackoutRange(range) {
  const [startStr, endStr] = range.split("-").map((value) => value.trim());
  if (!startStr || !endStr) {
    return null;
  }
  const parseDate = (input) => {
    const parts = input.replace(/[^0-9/]/g, "").split("/");
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map((value) => Number.parseInt(value, 10));
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  };
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (!start || !end) {
    return null;
  }
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
function rangesOverlap(startA, endA, startB, endB) {
  return startA <= endB && startB <= endA;
}
function locationMatches(contact, job) {
  if (!job.location) return true;
  const jobLocation = job.location.toLowerCase();
  const address = contact.address?.toLowerCase() ?? "";
  const tags = (contact.tags || []).map((tag) => tag.toLowerCase());
  return address.includes(jobLocation) || tags.some((tag) => jobLocation.includes(tag) || tag.includes(jobLocation));
}
async function fetchDistancesFromGoogle(origin, destinations, apiKey) {
  const result = /* @__PURE__ */ new Map();
  if (!destinations.length) {
    return result;
  }
  for (let i = 0; i < destinations.length; i += DISTANCE_MATRIX_BATCH_SIZE) {
    const chunk = destinations.slice(i, i + DISTANCE_MATRIX_BATCH_SIZE);
    const encodedDestinations = chunk.map((destination) => encodeURIComponent(destination.address)).join("|");
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodedDestinations}&key=${apiKey}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error("Failed to fetch distance matrix:", response.status, response.statusText);
        continue;
      }
      const data = await response.json();
      if (data.status !== "OK" || !data.rows?.length) {
        console.error("Unexpected distance matrix response:", data.status, data.error_message);
        continue;
      }
      const elements = data.rows[0]?.elements ?? [];
      elements.forEach((element, index) => {
        const contactId = chunk[index].id;
        if (element?.status === "OK" && typeof element.distance?.value === "number") {
          result.set(contactId, element.distance.value);
        }
      });
    } catch (error) {
      console.error("Error querying Google Distance Matrix API:", error);
    }
  }
  return result;
}
async function getContactDistanceMap(jobLocation, contacts2) {
  if (!jobLocation || !jobLocation.trim()) {
    return /* @__PURE__ */ new Map();
  }
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_API_KEY not configured. Falling back to basic location matching.");
    return /* @__PURE__ */ new Map();
  }
  const destinations = contacts2.filter((contact) => contact.address && contact.address.trim()).map((contact) => ({
    id: contact.id,
    address: contact.address.trim()
  }));
  if (!destinations.length) {
    return /* @__PURE__ */ new Map();
  }
  return fetchDistancesFromGoogle(jobLocation.trim(), destinations, apiKey);
}
function jobSkills(job) {
  const requirementSkills = Array.isArray(job.skillRequirements) ? job.skillRequirements.map(
    (requirement) => typeof requirement?.skill === "string" ? requirement.skill.trim().toLowerCase() : null
  ).filter((skill) => Boolean(skill)) : [];
  if (requirementSkills.length) {
    return [];
  }
  if (!job.notes) return [];
  const skills = [];
  const lines = job.notes.split(/\n/).map((line) => line.trim());
  let inSkillsBlock = false;
  for (const line of lines) {
    if (!line) continue;
    if (/^skills?:/i.test(line)) {
      inSkillsBlock = true;
      const afterColon = line.replace(/^skills?:/i, "").trim();
      if (afterColon) {
        skills.push(...afterColon.split(/[,;]+/).map((token) => token.trim().toLowerCase()).filter(Boolean));
      }
      continue;
    }
    if (inSkillsBlock) {
      if (/^[A-Za-z]/.test(line) && !line.startsWith("-")) {
        inSkillsBlock = false;
      }
      if (inSkillsBlock) {
        const normalized = line.replace(/^-+/, "").trim();
        if (normalized) {
          skills.push(...normalized.split(/[,;]+/).map((token) => token.trim().toLowerCase()).filter(Boolean));
        }
        continue;
      }
    }
  }
  if (!skills.length) {
    const fallback = job.notes.split(new RegExp("[,\\n]")).map((token) => token.trim().toLowerCase()).filter((token) => token && token.length <= 40);
    return Array.from(new Set(fallback));
  }
  return Array.from(new Set(skills));
}
function contactMatchesSkills(contact, requiredSkills) {
  if (!requiredSkills.length) return true;
  const contactSkills = (contact.skills || []).map((skill) => skill.toLowerCase());
  if (!contactSkills.length) return false;
  return requiredSkills.every((required) => contactSkills.includes(required));
}
var skillRequirementInputSchema = z4.object({
  skill: z4.string({ required_error: "Skill is required" }).trim().min(1, "Skill is required"),
  headcount: z4.coerce.number({ invalid_type_error: "Headcount must be a number" }).int("Headcount must be a whole number").min(1, "Headcount must be at least 1"),
  notes: z4.union([z4.string(), z4.null(), z4.undefined()]).transform((value) => {
    if (value === null || value === void 0) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  })
});
function parseSkillRequirementsInput(input) {
  const arrayInput = Array.isArray(input) ? input : [];
  return z4.array(skillRequirementInputSchema).parse(arrayInput);
}
function normalizeSkillKey(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}
function deriveSkillQuotas(skillRequirements) {
  const quotaMap = /* @__PURE__ */ new Map();
  const orderedQuotas = [];
  for (const requirement of skillRequirements) {
    const key = normalizeSkillKey(requirement.skill);
    const headcount = requirement.headcount ?? 0;
    if (!key || headcount <= 0) {
      continue;
    }
    const existing = quotaMap.get(key);
    if (existing) {
      existing.required += headcount;
      existing.remaining += headcount;
    } else {
      const quota = {
        key,
        label: requirement.skill?.trim() || requirement.skill || key,
        required: headcount,
        remaining: headcount
      };
      quotaMap.set(key, quota);
      orderedQuotas.push(quota);
    }
  }
  return orderedQuotas;
}
function orderContactsBySkillPriority(prioritized, skillRequirements) {
  if (!skillRequirements.length || !prioritized.length) {
    return prioritized;
  }
  const orderedQuotas = deriveSkillQuotas(skillRequirements);
  if (!orderedQuotas.length) {
    return prioritized;
  }
  const selected = [];
  const usedContactIds = /* @__PURE__ */ new Set();
  const getContactSkillKeys = (contact) => (contact.skills ?? []).map((skill) => normalizeSkillKey(skill)).filter((skill) => Boolean(skill));
  for (const quota of orderedQuotas) {
    if (quota.remaining <= 0) {
      continue;
    }
    for (const entry of prioritized) {
      if (quota.remaining <= 0) {
        break;
      }
      if (usedContactIds.has(entry.contact.id)) {
        continue;
      }
      const contactSkillKeys = getContactSkillKeys(entry.contact);
      if (contactSkillKeys.includes(quota.key)) {
        selected.push(entry);
        usedContactIds.add(entry.contact.id);
        quota.remaining -= 1;
      }
    }
  }
  const remaining = prioritized.filter((entry) => !usedContactIds.has(entry.contact.id));
  return [...selected, ...remaining];
}
function isWithinBlackout(contact, job) {
  if (!contact.blackoutPeriods || contact.blackoutPeriods.length === 0) return false;
  const jobStart = new Date(job.startTime);
  const jobEnd = new Date(job.endTime);
  return contact.blackoutPeriods.some((period) => {
    const range = parseBlackoutRange(period);
    if (!range) return false;
    return rangesOverlap(jobStart, jobEnd, range.start, range.end);
  });
}
async function hasScheduleConflict(contactId, job, organizationId, jobCache) {
  const jobStart = new Date(job.startTime);
  const jobEnd = new Date(job.endTime);
  const availabilities = await storage.getAvailabilityByContact(contactId, organizationId);
  for (const record of availabilities) {
    if (!record || record.status !== "confirmed") continue;
    if (record.jobId === job.id) continue;
    const cached = jobCache.get(record.jobId);
    let otherJob = cached;
    if (!otherJob) {
      otherJob = await storage.getJob(record.jobId);
      if (otherJob) {
        jobCache.set(record.jobId, otherJob);
      }
    }
    if (!otherJob) continue;
    const otherStart = new Date(otherJob.startTime);
    const otherEnd = new Date(otherJob.endTime);
    if (rangesOverlap(jobStart, jobEnd, otherStart, otherEnd)) {
      return true;
    }
  }
  return false;
}
async function prioritizeContacts(contactIds, job, organizationId) {
  const contacts2 = await storage.getContacts(organizationId);
  const candidates = contacts2.filter((contact) => contactIds.includes(contact.id) && !contact.isOptedOut);
  if (!candidates.length) {
    return [];
  }
  const requiredSkills = jobSkills(job);
  const jobCache = /* @__PURE__ */ new Map();
  const distanceMap = await getContactDistanceMap(job.location, candidates);
  const prioritised = [];
  for (const contact of candidates) {
    const distanceMeters = distanceMap.get(contact.id) ?? Number.POSITIVE_INFINITY;
    console.log(`[Prioritization] Contact ${contact.firstName} ${contact.lastName} distance: ${distanceMeters}`);
    const hasValidDistance = Number.isFinite(distanceMeters);
    const matchesLocation = hasValidDistance ? distanceMeters <= DEFAULT_DISTANCE_THRESHOLD_METERS : locationMatches(contact, job);
    const withinBlackout = isWithinBlackout(contact, job);
    const conflicts = await hasScheduleConflict(contact.id, job, organizationId, jobCache);
    const skillsMatch = contactMatchesSkills(contact, requiredSkills);
    const meetsAllCriteria = matchesLocation && !withinBlackout && !conflicts && skillsMatch;
    const priorityScore = (matchesLocation ? 3 : 0) + (!withinBlackout ? 2 : 0) + (!conflicts ? 2 : 0) + (skillsMatch ? 3 : 0);
    prioritised.push({
      contact,
      priorityScore,
      meetsAllCriteria,
      distanceMeters
    });
  }
  const sortByScoreThenDistance = (a, b) => {
    if (a.priorityScore !== b.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return a.distanceMeters - b.distanceMeters;
  };
  const primary = prioritised.filter((entry) => entry.meetsAllCriteria).sort(sortByScoreThenDistance);
  const secondary = prioritised.filter((entry) => !entry.meetsAllCriteria).sort((a, b) => {
    const distanceComparison = a.distanceMeters - b.distanceMeters;
    if (distanceComparison !== 0) {
      return distanceComparison;
    }
    return b.priorityScore - a.priorityScore;
  });
  return [...primary, ...secondary];
}
async function getConfirmedCount(jobId, organizationId) {
  const confirmed = await storage.getConfirmedContactsForJob(jobId, organizationId);
  return confirmed.length;
}
async function sendBatchMessages(batchContacts, options) {
  const {
    job,
    template,
    campaign,
    organizationId,
    userId,
    jobId,
    twilioClient,
    fromNumber,
    rosterBaseUrl
  } = options;
  let sentCount = 0;
  console.log(
    `[Messaging] Sending batch for job ${job.id} (${job.name}) \u2014 contacts ${batchContacts.map((contact) => contact.id).join(", ")}`
  );
  for (const contact of batchContacts) {
    if (contact.isOptedOut) {
      continue;
    }
    const availabilityRecord = await storage.getAvailabilityForContact(jobId, contact.id, organizationId);
    if (!availabilityRecord) {
      await storage.createAvailability(organizationId, {
        jobId,
        contactId: contact.id,
        status: "no_reply",
        shiftPreference: null
      });
    } else {
      await storage.updateAvailability(availabilityRecord.id, {
        status: "no_reply"
      });
    }
    let messageContent = renderTemplate(template.content, contact, job);
    if (template.includeRosterLink) {
      let rosterToken = contact.rosterToken;
      if (!rosterToken) {
        rosterToken = nanoid(32);
        await storage.updateContact(contact.id, { rosterToken });
      }
      const normalizedBase = rosterBaseUrl.replace(/\/$/, "");
      const rosterUrl = `${normalizedBase}/schedule/${rosterToken}`;
      messageContent += `

View your weekly schedule: ${rosterUrl}`;
    }
    let status = "sent";
    let twilioSid = null;
    if (contact.hasLogin) {
      console.log(
        `[Messaging] Contact ${contact.id} (${contact.firstName} ${contact.lastName}) has login enabled - creating message in portal only (no SMS)`
      );
      twilioSid = null;
      status = "sent";
    } else if (twilioClient && fromNumber) {
      try {
        const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
        const twilioMessage = await twilioClient.messages.create({
          body: messageContent,
          from: fromNumber,
          to: e164Phone
        });
        twilioSid = twilioMessage.sid;
      } catch (error) {
        status = "failed";
      }
    } else {
      console.log(`[DEV MODE] Would send SMS to ${contact.phone}: ${messageContent}`);
      twilioSid = `dev-${Date.now()}`;
    }
    await storage.createMessage(organizationId, userId, {
      contactId: contact.id,
      jobId,
      campaignId: campaign.id,
      direction: "outbound",
      content: messageContent,
      status,
      twilioSid
    });
    if (status === "sent") {
      if (!contact.hasLogin) {
        sentCount += 1;
      }
      console.log(
        `[Messaging] Message ${contact.hasLogin ? "created in portal" : "sent"} to contact ${contact.id} (${contact.firstName} ${contact.lastName}) \u2014 campaign ${campaign.id}`
      );
    } else {
      console.warn(
        `[Messaging] Failed to send message to contact ${contact.id} (${contact.firstName} ${contact.lastName})`
      );
    }
  }
  if (sentCount > 0) {
    await creditService3.consumeCreditsForOrganization(
      organizationId,
      sentCount,
      `Campaign ${campaign.id} for job ${jobId}`,
      null
    );
    console.log(
      `[Messaging] Batch complete for campaign ${campaign.id}. Sent ${sentCount} messages. Remaining credits will be updated.`
    );
  }
  return sentCount;
}
async function scheduleBatchedMessages(contacts2, options) {
  if (!contacts2.length) {
    return;
  }
  let index = 0;
  let remainingCredits = options.availableCredits;
  const jobId = options.job.id;
  const requiredHeadcount = options.job.requiredHeadcount ?? null;
  const dispatchBatch = async () => {
    if (remainingCredits <= 0) {
      return;
    }
    if (requiredHeadcount) {
      const confirmed = await getConfirmedCount(jobId, options.organizationId);
      if (confirmed >= requiredHeadcount) {
        return;
      }
    }
    const allowedBatchSize = Math.min(MESSAGE_BATCH_SIZE, remainingCredits);
    const batch = contacts2.slice(index, index + allowedBatchSize);
    if (!batch.length) {
      return;
    }
    const sent = await sendBatchMessages(batch, {
      job: options.job,
      template: options.template,
      campaign: options.campaign,
      organizationId: options.organizationId,
      userId: options.userId,
      jobId,
      twilioClient: options.twilioClient,
      fromNumber: options.fromNumber,
      rosterBaseUrl: options.rosterBaseUrl
    });
    remainingCredits -= sent;
    index += allowedBatchSize;
    if (remainingCredits <= 0) {
      return;
    }
    if (requiredHeadcount) {
      const confirmedAfter = await getConfirmedCount(jobId, options.organizationId);
      if (confirmedAfter >= requiredHeadcount) {
        return;
      }
    }
    if (index >= contacts2.length) {
      return;
    }
    setTimeout(() => {
      dispatchBatch().catch((error) => console.error("Failed to send message batch", error));
    }, MESSAGE_BATCH_DELAY_MS);
  };
  await dispatchBatch();
}
async function sendRescheduleNotifications(organizationId, userId, job, contacts2) {
  let deliveredCount = 0;
  try {
    if (!contacts2.length) {
      return 0;
    }
    let twilioClient = null;
    let fromNumber = "";
    try {
      twilioClient = await getTwilioClient();
      fromNumber = await getTwilioFromPhoneNumber();
    } catch (error) {
      console.log("Twilio not configured, reschedule notifications will be logged only");
    }
    const scheduledTime = new Date(job.startTime).toLocaleString();
    const message = `UPDATE: ${job.name} has been rescheduled. New time: ${scheduledTime}. Location: ${job.location}. Reply Y to confirm or N to decline.`;
    for (const contact of contacts2) {
      if (!contact || contact.isOptedOut) {
        continue;
      }
      let status = "sent";
      let twilioSid = null;
      if (twilioClient && fromNumber) {
        try {
          const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
          const twilioMessage = await twilioClient.messages.create({
            body: message,
            from: fromNumber,
            to: e164Phone
          });
          twilioSid = twilioMessage.sid;
        } catch (error) {
          status = "failed";
          console.error("Failed to send reschedule notification:", error);
        }
      } else {
        twilioSid = `dev-${Date.now()}`;
        console.log(`[DEV MODE] Would send reschedule SMS to ${contact.phone}: ${message}`);
      }
      await storage.createMessage(organizationId, userId, {
        contactId: contact.id,
        jobId: job.id,
        campaignId: null,
        direction: "outbound",
        content: message,
        status,
        twilioSid
      });
      if (status === "sent") {
        deliveredCount += 1;
      }
    }
    if (deliveredCount > 0) {
      await creditService3.consumeCreditsForOrganization(
        organizationId,
        deliveredCount,
        `Reschedule notification for job ${job.id}`,
        null
      );
    }
  } catch (error) {
    console.error("Reschedule notification error:", error);
  }
  return deliveredCount;
}
async function getContactScheduleConflicts(job, contacts2, organizationId) {
  const jobStart = new Date(job.startTime);
  const jobEnd = new Date(job.endTime);
  const jobCache = /* @__PURE__ */ new Map();
  const impacted = [];
  for (const contact of contacts2) {
    const availabilities = await storage.getAvailabilityByContact(contact.id, organizationId);
    const conflictingJobs = [];
    for (const record of availabilities) {
      if (!record || record.status !== "confirmed" || record.jobId === job.id) {
        continue;
      }
      let otherJob = jobCache.get(record.jobId);
      if (!otherJob) {
        otherJob = await storage.getJob(record.jobId);
        if (otherJob) {
          jobCache.set(record.jobId, otherJob);
        }
      }
      if (!otherJob) {
        continue;
      }
      const otherStart = new Date(otherJob.startTime);
      const otherEnd = new Date(otherJob.endTime);
      if (rangesOverlap(jobStart, jobEnd, otherStart, otherEnd)) {
        conflictingJobs.push(otherJob);
      }
    }
    if (conflictingJobs.length > 0) {
      impacted.push({
        contact,
        conflicts: conflictingJobs
      });
    }
  }
  return impacted;
}
async function notifyJobCancellation(job, organizationId, userId, contacts2) {
  let deliveredCount = 0;
  try {
    if (!contacts2.length) {
      return 0;
    }
    let twilioClient = null;
    let fromNumber = "";
    try {
      twilioClient = await getTwilioClient();
      fromNumber = await getTwilioFromPhoneNumber();
    } catch (error) {
      console.log("Twilio not configured, cancellation notifications will be logged only");
    }
    const scheduledTime = new Date(job.startTime).toLocaleString();
    const message = `UPDATE: ${job.name} scheduled for ${scheduledTime} has been cancelled. Please stand by for future opportunities.`;
    for (const contact of contacts2) {
      if (!contact || contact.isOptedOut) {
        continue;
      }
      let status = "sent";
      let twilioSid = null;
      if (twilioClient && fromNumber) {
        try {
          const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
          const twilioMessage = await twilioClient.messages.create({
            body: message,
            from: fromNumber,
            to: e164Phone
          });
          twilioSid = twilioMessage.sid;
        } catch (error) {
          status = "failed";
          console.error("Failed to send cancellation notification:", error);
        }
      } else {
        twilioSid = `dev-${Date.now()}`;
        console.log(`[DEV MODE] Would send cancellation SMS to ${contact.phone}: ${message}`);
      }
      await storage.createMessage(organizationId, userId, {
        contactId: contact.id,
        jobId: job.id,
        campaignId: null,
        direction: "outbound",
        content: message,
        status,
        twilioSid
      });
      if (status === "sent") {
        deliveredCount += 1;
      }
      await storage.updateContact(contact.id, { status: "free" });
      const availabilityRecord = await storage.getAvailabilityForContact(job.id, contact.id, organizationId);
      if (availabilityRecord) {
        await storage.updateAvailability(availabilityRecord.id, { status: "declined" });
      }
    }
    if (deliveredCount > 0) {
      await creditService3.consumeCreditsForOrganization(
        organizationId,
        deliveredCount,
        `Cancellation notification for job ${job.id}`,
        null
      );
    }
  } catch (error) {
    console.error("Cancellation notification error:", error);
  }
  return deliveredCount;
}
async function checkAndNotifyJobFulfillment(job, organizationId) {
  if (!job.requiredHeadcount || job.requiredHeadcount <= 0) {
    return;
  }
  const confirmed = await storage.getConfirmedContactsForJob(job.id, organizationId);
  if (confirmed.length < job.requiredHeadcount) {
    return;
  }
  const availabilityRecords = await storage.getAvailability(job.id, organizationId);
  const pending = availabilityRecords.filter(
    (record) => record.status === "no_reply" || record.status === "maybe" || record.status === "pending"
  );
  if (!pending.length) {
    return;
  }
  const pendingContacts = [];
  for (const record of pending) {
    const contact = await storage.getContact(record.contactId, organizationId);
    if (contact && !contact.isOptedOut) {
      pendingContacts.push(contact);
    }
  }
  if (!pendingContacts.length) {
    return;
  }
  await sendJobFulfilledNotifications(job, pendingContacts, organizationId);
  await Promise.all(
    pending.map(
      (record) => storage.updateAvailability(record.id, {
        status: "declined"
      })
    )
  );
}
async function sendJobFulfilledNotifications(job, contacts2, organizationId) {
  try {
    if (!contacts2.length) {
      return;
    }
    let twilioClient = null;
    let fromNumber = "";
    try {
      twilioClient = await getTwilioClient();
      fromNumber = await getTwilioFromPhoneNumber();
    } catch (error) {
      console.log("Twilio not configured, fulfillment notifications will be logged only");
    }
    const jobDate = new Date(job.startTime).toLocaleString();
    let deliveredCount = 0;
    for (const contact of contacts2) {
      if (!contact || contact.isOptedOut) {
        continue;
      }
      const message = `Thanks for your response, ${contact.firstName}. The positions for ${job.name} on ${jobDate} have now been filled. We'll contact you about future opportunities.`;
      let status = "sent";
      let twilioSid = null;
      if (twilioClient && fromNumber) {
        try {
          const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
          const twilioMessage = await twilioClient.messages.create({
            body: message,
            from: fromNumber,
            to: e164Phone
          });
          twilioSid = twilioMessage.sid;
        } catch (error) {
          status = "failed";
          console.error("Failed to send fulfillment notification:", error);
        }
      } else {
        twilioSid = `dev-${Date.now()}`;
        console.log(`[DEV MODE] Would send fulfillment SMS to ${contact.phone}: ${message}`);
      }
      await storage.createMessage(organizationId, job.userId, {
        contactId: contact.id,
        jobId: job.id,
        campaignId: null,
        direction: "outbound",
        content: message,
        status,
        twilioSid
      });
      if (status === "sent") {
        deliveredCount += 1;
      }
    }
    if (deliveredCount > 0) {
      await creditService3.consumeCreditsForOrganization(
        organizationId,
        deliveredCount,
        `Job ${job.id} fulfillment notifications`,
        null
      );
    }
  } catch (error) {
    console.error("Fulfillment notification error:", error);
  }
}
async function syncJobToCalendars(userId, job) {
  return Promise.resolve();
}
async function registerRoutes(app2) {
  app2.post("/log", express.json(), async (req, res) => {
    try {
      const { message, level = "error", metadata = {} } = req.body;
      if (!message) {
        return res.status(400).json({ error: "message is required" });
      }
      const logMessage = `[RemoteLog ${level.toUpperCase()}] ${message}`;
      if (level === "error") {
        console.error(logMessage, metadata);
      } else if (level === "warn") {
        console.warn(logMessage, metadata);
      } else {
        console.log(logMessage, metadata);
      }
      res.json({ success: true, received: true });
    } catch (error) {
      console.error("[Log] Error processing log request:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/.well-known/apple-app-site-association", (req, res, next) => {
    const aasaPath = path.join(import.meta.dirname, "public", ".well-known", "apple-app-site-association");
    res.setHeader("Content-Type", "application/json");
    res.sendFile(aasaPath, (err) => {
      if (err) {
        console.error("Error serving AASA file:", err);
        res.status(404).json({ error: "AASA file not found" });
      }
    });
  });
  app2.use("/attached_assets", express.static(path.join(process.cwd(), "attached_assets")));
  app2.use("/api/auth", auth_routes_default);
  app2.use("/api/mobile/auth", mobile_auth_routes_default);
  async function ensureDefaultPlatformAdmin() {
    try {
      const existingAdmins = await storage.getAllAdminUsers();
      if (existingAdmins.length > 0) {
        return;
      }
      const defaultEmail = "Nadeem.mohammed@deffinity.com";
      const existing = await storage.getAdminUserByEmail(defaultEmail);
      if (existing) {
        return;
      }
      const hashedPassword = await bcrypt3.hash("Nadeem123#!", 10);
      await storage.createAdminUser({
        name: "Nadeem Mohammed",
        email: defaultEmail,
        password: hashedPassword
      });
    } catch (error) {
      console.error("Failed to ensure default platform admin", error);
    }
  }
  const sanitizeAdmin = (admin2) => {
    const { password, ...safeAdmin } = admin2;
    return safeAdmin;
  };
  await ensureDefaultPlatformAdmin();
  const requireAuth = async (req, res, next) => {
    try {
      if (req.session?.userId) {
        const user = await storage.getUser(req.session.userId);
        if (!user) return res.status(401).json({ message: "User not found" });
        req.user = user;
        return next();
      }
      const userId = req.headers["x-user-id"];
      if (userId) {
        const user = await storage.getUser(userId);
        if (!user) return res.status(401).json({ message: "User not found" });
        req.user = user;
        req.userId = userId;
        return next();
      }
      const rawCookie = req.headers.cookie;
      if (rawCookie) {
        const match = rawCookie.match(/connect\.sid=([^;]+)/);
        if (match) {
          const sid = match[1];
          req.sessionID = sid;
          req.sessionStore.get(sid, async (err, session2) => {
            if (!session2 || !session2.userId) {
              return res.status(401).json({ message: "Not authenticated" });
            }
            const user = await storage.getUser(session2.userId);
            if (!user) return res.status(401).json({ message: "User not found" });
            req.session = session2;
            req.user = user;
            return next();
          });
          return;
        }
      }
      return res.status(401).json({ message: "Not authenticated" });
    } catch (err) {
      console.error("Auth middleware error:", err);
      return res.status(500).json({ message: "Internal error" });
    }
  };
  const requireContactAuth = async (req, res, next) => {
    try {
      const contactId = req.headers["x-contact-id"];
      if (contactId) {
        const contact = await storage.getContactById(contactId);
        if (!contact) {
          return res.status(401).json({ message: "Contact not found" });
        }
        if (!contact.hasLogin) {
          return res.status(401).json({ message: "Contact login not enabled" });
        }
        req.contact = contact;
        return next();
      }
      if (req.session?.contactId) {
        const contact = await storage.getContactById(req.session.contactId);
        if (!contact) return res.status(401).json({ message: "Contact not found" });
        req.contact = contact;
        return next();
      }
      const rawCookie = req.headers.cookie;
      if (rawCookie) {
        const match = rawCookie.match(/connect\.sid=([^;]+)/);
        if (match) {
          const sid = match[1];
          req.sessionID = sid;
          req.sessionStore.get(sid, async (err, session2) => {
            if (!session2 || !session2.contactId) {
              return res.status(401).json({ message: "Not authenticated" });
            }
            const contact = await storage.getContactById(session2.contactId);
            if (!contact) return res.status(401).json({ message: "Contact not found" });
            req.session = session2;
            req.contact = contact;
            return next();
          });
          return;
        }
      }
      return res.status(401).json({ message: "Not authenticated" });
    } catch (err) {
      console.error("Contact auth middleware error:", err);
      return res.status(500).json({ message: "Internal error" });
    }
  };
  const requireTeamAdmin = async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (req.user.teamRole !== "admin" && req.user.teamRole !== "owner") {
      return res.status(403).json({ message: "Requires admin or owner role" });
    }
    next();
  };
  app2.get("/api/organization", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(404).json({ message: "No organization found" });
      }
      const org = await storage.getOrganization(req.user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }
      res.json(org);
    } catch (error) {
      if (error instanceof z4.ZodError) {
        const message = error.errors?.map((issue) => issue.message).join(", ") || "Invalid job data";
        return res.status(400).json({ message });
      }
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/organization/members", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(404).json({ message: "No organization found" });
      }
      const members = await storage.getUsersInOrganization(req.user.organizationId);
      const safeMembers = members.map(({ password, ...user }) => user);
      res.json(safeMembers);
    } catch (error) {
      if (error instanceof z4.ZodError) {
        const message = error.errors?.map((issue) => issue.message).join(", ") || "Invalid job data";
        return res.status(400).json({ message });
      }
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/organization/invite", requireAuth, requireTeamAdmin, async (req, res) => {
    try {
      const { email, firstName, lastName, teamRole } = req.body;
      if (!email || !firstName || !lastName) {
        return res.status(400).json({ message: "Email, first name, and last name are required" });
      }
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      const organization = await storage.getOrganization(req.user.organizationId);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt3.hash(tempPassword, 10);
      const username = email.split("@")[0];
      const newUser = await storage.createUser({
        username,
        firstName,
        lastName,
        email,
        password: hashedPassword,
        organizationId: req.user.organizationId,
        teamRole: teamRole || "member",
        isAdmin: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null
      });
      const invitedByName = req.user.firstName && req.user.lastName ? `${req.user.firstName} ${req.user.lastName}` : req.user.username || req.user.email;
      const loginUrl = `${req.protocol}://${req.get("host")}/auth`;
      try {
        await sendTeamInvitationEmail(
          email,
          firstName,
          tempPassword,
          organization.name,
          invitedByName,
          loginUrl
        );
        console.log(`Team invitation email sent to ${email}`);
      } catch (emailError) {
        console.error("Failed to send team invitation email:", emailError);
      }
      const { password, ...safeUser } = newUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Invite error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/organization/members/:userId/role", requireAuth, requireTeamAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { teamRole } = req.body;
      if (!["owner", "admin", "member"].includes(teamRole)) {
        return res.status(400).json({ message: "Invalid team role" });
      }
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      if (targetUser.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Cannot modify users from other organizations" });
      }
      if (teamRole === "owner" && req.user.teamRole !== "owner") {
        return res.status(403).json({ message: "Only owners can assign owner role" });
      }
      const updatedUser = await storage.updateUserTeamRole(userId, teamRole);
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/organization/members/:userId", requireAuth, requireTeamAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { firstName, lastName, email } = req.body;
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      if (targetUser.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Cannot modify users from other organizations" });
      }
      if (email && email !== targetUser.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }
      const updates = {};
      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (email) updates.email = email;
      const updatedUser = await storage.updateUser(userId, updates);
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/organization/members/:userId", requireAuth, requireTeamAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      if (targetUser.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Cannot remove users from other organizations" });
      }
      if (targetUser.id === req.user.id) {
        return res.status(400).json({ message: "Cannot remove yourself" });
      }
      if (targetUser.teamRole === "owner") {
        return res.status(403).json({ message: "Cannot remove organization owner" });
      }
      await storage.updateUser(userId, { organizationId: null });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/organization/members/:userId/password-reminder", requireAuth, requireTeamAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      if (targetUser.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Cannot send password reminder to users from other organizations" });
      }
      if (targetUser.id === req.user.id) {
        return res.status(400).json({ message: "Cannot send password reminder to yourself" });
      }
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt3.hash(tempPassword, 10);
      await storage.updateUser(userId, { password: hashedPassword });
      res.json({
        success: true,
        tempPassword,
        username: targetUser.username || targetUser.email,
        message: `Temporary password generated for ${targetUser.username || targetUser.email}`
      });
    } catch (error) {
      console.error("Password reminder error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/messages/team", requireAuth, async (req, res) => {
    try {
      const { recipientId, content } = req.body;
      if (!recipientId || !content) {
        return res.status(400).json({ message: "Recipient ID and content are required" });
      }
      const recipient = await storage.getUser(recipientId);
      if (!recipient) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      if (recipient.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Cannot message users from other organizations" });
      }
      const loginUrl = `${req.protocol}://${req.get("host")}/auth`;
      const senderName = req.user.firstName && req.user.lastName ? `${req.user.firstName} ${req.user.lastName}` : req.user.username;
      try {
        await sendTeamMessageNotification(
          recipient.email,
          senderName,
          content,
          loginUrl
        );
        console.log(`Team message notification email sent to ${recipient.email}`);
      } catch (emailError) {
        console.error("Failed to send team message notification email:", emailError);
      }
      res.json({
        success: true,
        message: "Message sent successfully",
        recipient: {
          id: recipient.id,
          username: recipient.username,
          email: recipient.email
        }
      });
    } catch (error) {
      console.error("Team messaging error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/jobs", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const jobs2 = await storage.getJobs(req.user.organizationId);
      const jobsWithAvailability = await Promise.all(
        jobs2.map(async (job) => {
          const [availability2, skillRequirements] = await Promise.all([
            storage.getAvailability(job.id, req.user.organizationId),
            storage.getJobSkillRequirements(job.id)
          ]);
          return {
            ...job,
            skillRequirements,
            availabilityCounts: {
              confirmed: availability2.filter((a) => a.status === "confirmed").length,
              maybe: availability2.filter((a) => a.status === "maybe").length,
              declined: availability2.filter((a) => a.status === "declined").length,
              noReply: availability2.filter((a) => a.status === "no_reply").length
            }
          };
        })
      );
      res.json(jobsWithAvailability);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/skills/availability", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const contacts2 = await storage.getContacts(req.user.organizationId);
      const normalizedContacts = contacts2.map((contact) => {
        const uniqueSkills = Array.from(
          new Set((contact.skills || []).map((skill) => skill.trim()).filter(Boolean))
        );
        const available = contact.status === "free" && !contact.isOptedOut;
        return {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          status: contact.status,
          available,
          isOptedOut: contact.isOptedOut,
          skills: uniqueSkills
        };
      });
      const skillsMap = /* @__PURE__ */ new Map();
      for (const contact of normalizedContacts) {
        for (const skill of contact.skills) {
          const key = skill.toLowerCase();
          const existing = skillsMap.get(key);
          if (existing) {
            existing.totalCount += 1;
            if (contact.available) {
              existing.availableCount += 1;
            }
          } else {
            skillsMap.set(key, {
              skill,
              totalCount: 1,
              availableCount: contact.available ? 1 : 0
            });
          }
        }
      }
      const skillSummary = Array.from(skillsMap.values()).sort(
        (a, b) => a.skill.localeCompare(b.skill)
      );
      res.json({
        contacts: normalizedContacts,
        skills: skillSummary
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      const skillRequirements = await storage.getJobSkillRequirements(job.id);
      res.json({ ...job, skillRequirements });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/jobs/:id/roster", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      const organizationId = job?.organizationId ?? "";
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      const skillRequirements = await storage.getJobSkillRequirements(job.id);
      const availabilityRecords = await storage.getAvailability(job.id, organizationId);
      const availabilityWithContacts = await Promise.all(
        availabilityRecords.map(async (avail) => {
          const contact = await storage.getContact(avail.contactId, organizationId);
          return { ...avail, contact };
        })
      );
      res.json({ ...job, skillRequirements, availability: availabilityWithContacts });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/jobs", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const bodyWithDates = {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : void 0,
        endTime: req.body.endTime ? new Date(req.body.endTime) : void 0
      };
      const { skillRequirements: skillRequirementsInput, ...jobPayload } = bodyWithDates;
      const parsedSkillRequirements = parseSkillRequirementsInput(skillRequirementsInput);
      const validated = insertJobSchema.parse(jobPayload);
      const job = await storage.createJob(req.user.organizationId, req.user.id, validated);
      const skillRequirements = await storage.replaceJobSkillRequirements(
        job.id,
        parsedSkillRequirements.map((requirement) => ({
          ...requirement,
          jobId: job.id
        }))
      );
      await syncJobToCalendars(req.user.id, job);
      res.json({ ...job, skillRequirements });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const existingJob = await storage.getJob(req.params.id);
      if (!existingJob) {
        return res.status(404).json({ message: "Job not found" });
      }
      const bodyWithDates = {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : void 0,
        endTime: req.body.endTime ? new Date(req.body.endTime) : void 0
      };
      const { skillRequirements: skillRequirementsInput, ...jobPayload } = bodyWithDates;
      const validated = insertJobSchema.partial().parse(jobPayload);
      const job = await storage.updateJob(req.params.id, validated);
      await syncJobToCalendars(req.user.id, job);
      let skillRequirements;
      if (skillRequirementsInput !== void 0) {
        const parsedSkillRequirements = parseSkillRequirementsInput(skillRequirementsInput);
        skillRequirements = await storage.replaceJobSkillRequirements(
          job.id,
          parsedSkillRequirements.map((requirement) => ({
            ...requirement,
            jobId: job.id
          }))
        );
      } else {
        skillRequirements = await storage.getJobSkillRequirements(job.id);
      }
      const availabilityRecords = await storage.getAvailability(job.id, req.user.organizationId);
      const confirmedContacts = (await Promise.all(
        availabilityRecords.filter((record) => record.status === "confirmed").map((record) => storage.getContact(record.contactId, req.user.organizationId))
      )).filter((contact) => Boolean(contact));
      const timeChanged = existingJob.startTime.getTime() !== job.startTime.getTime() || existingJob.endTime.getTime() !== job.endTime.getTime();
      const locationChanged = existingJob.location !== job.location;
      let rescheduleNotified = 0;
      let conflictReport = [];
      let removedContactsCount = 0;
      let replacementInvitesSent = 0;
      if (confirmedContacts.length && (timeChanged || locationChanged)) {
        conflictReport = await getContactScheduleConflicts(
          job,
          confirmedContacts,
          req.user.organizationId
        );
        const conflictedContactIds = new Set(conflictReport.map((entry) => entry.contact.id));
        const availableContacts = confirmedContacts.filter(
          (contact) => !conflictedContactIds.has(contact.id)
        );
        for (const entry of conflictReport) {
          const availabilityRecord = availabilityRecords.find(
            (record) => record.contactId === entry.contact.id
          );
          if (availabilityRecord) {
            await storage.updateAvailability(availabilityRecord.id, {
              status: "declined"
            });
            await storage.updateContact(entry.contact.id, { status: "free" });
            removedContactsCount += 1;
          }
        }
        if (availableContacts.length > 0) {
          rescheduleNotified = await sendRescheduleNotifications(
            req.user.organizationId,
            req.user.id,
            job,
            availableContacts
          );
        }
        if (removedContactsCount > 0 && job.requiredHeadcount) {
          const remainingConfirmed = await storage.getConfirmedContactsForJob(
            job.id,
            req.user.organizationId
          );
          const needed = job.requiredHeadcount - remainingConfirmed.length;
          if (needed > 0) {
            const allContacts = await storage.getContacts(req.user.organizationId);
            const invitedContactIds = new Set(
              availabilityRecords.map((record) => record.contactId)
            );
            const uninvitedContacts = allContacts.filter(
              (contact) => !invitedContactIds.has(contact.id) && !contact.isOptedOut
            );
            if (uninvitedContacts.length > 0) {
              const templates2 = await storage.getTemplates(req.user.organizationId);
              const defaultTemplate = templates2.find((t) => t.content.includes("{{jobName}}"));
              if (defaultTemplate) {
                const skillRequirements2 = await storage.getJobSkillRequirements(job.id);
                const jobWithSkills2 = {
                  ...job,
                  skillRequirements: skillRequirements2
                };
                const campaign = await storage.createCampaign(
                  req.user.organizationId,
                  req.user.id,
                  {
                    jobId: job.id,
                    templateId: defaultTemplate.id
                  }
                );
                let twilioClient = null;
                let fromNumber = "";
                try {
                  twilioClient = await getTwilioClient();
                  fromNumber = await getTwilioFromPhoneNumber();
                } catch (error) {
                  console.log("Twilio not configured, messages will be logged only");
                }
                const availableCredits = await creditService3.getAvailableCreditsForOrganization(
                  req.user.organizationId
                );
                const contactIds = uninvitedContacts.map((c) => c.id);
                const prioritized = await prioritizeContacts(
                  contactIds,
                  jobWithSkills2,
                  req.user.organizationId
                );
                if (prioritized.length > 0) {
                  const skillAwarePrioritized = orderContactsBySkillPriority(
                    prioritized,
                    skillRequirements2
                  );
                  const prioritizedContacts = skillAwarePrioritized.map(
                    (entry) => entry.contact
                  );
                  const maxToInvite = Math.min(
                    needed * 2,
                    prioritizedContacts.length,
                    availableCredits
                  );
                  const trimmedContacts = prioritizedContacts.slice(0, maxToInvite);
                  if (trimmedContacts.length > 0) {
                    const baseUrlFromRequest = `${req.protocol}://${req.get("host")}`;
                    const rosterBaseUrl = (process.env.PUBLIC_BASE_URL || baseUrlFromRequest).replace(/\/$/, "");
                    await scheduleBatchedMessages(trimmedContacts, {
                      job: jobWithSkills2,
                      template: defaultTemplate,
                      campaign,
                      organizationId: req.user.organizationId,
                      userId: req.user.id,
                      availableCredits: maxToInvite,
                      twilioClient,
                      fromNumber,
                      rosterBaseUrl
                    });
                    replacementInvitesSent = trimmedContacts.length;
                  }
                }
              }
            }
          }
        }
      }
      const jobWithSkills = {
        ...job,
        skillRequirements
      };
      res.json({
        job: jobWithSkills,
        reschedule: {
          triggered: timeChanged || locationChanged,
          notifiedCount: rescheduleNotified,
          impactedContactIds: confirmedContacts.map((contact) => contact.id),
          removedContactsCount,
          replacementInvitesSent
        },
        conflicts: conflictReport.map((entry) => ({
          contact: {
            id: entry.contact.id,
            firstName: entry.contact.firstName,
            lastName: entry.contact.lastName
          },
          jobs: entry.conflicts.map((conflictJob) => ({
            id: conflictJob.id,
            name: conflictJob.name,
            startTime: conflictJob.startTime,
            endTime: conflictJob.endTime
          }))
        }))
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      const availabilityRecords = await storage.getAvailability(job.id, req.user.organizationId);
      const confirmedContacts = (await Promise.all(
        availabilityRecords.filter((record) => record.status === "confirmed").map((record) => storage.getContact(record.contactId, req.user.organizationId))
      )).filter((contact) => Boolean(contact));
      const notifiedCount = await notifyJobCancellation(
        job,
        req.user.organizationId,
        req.user.id,
        confirmedContacts
      );
      await storage.deleteJob(req.params.id);
      res.json({
        success: true,
        notifiedCount,
        notifiedContactIds: confirmedContacts.map((contact) => contact.id)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/contacts", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const contacts2 = await storage.getContacts(req.user.organizationId);
      const allAvailability = await storage.getAllAvailability(req.user.organizationId);
      const jobs2 = await storage.getJobs(req.user.organizationId);
      const now = /* @__PURE__ */ new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const jobMap = new Map(jobs2.map((job) => [job.id, job]));
      const contactsWithStatus = contacts2.map((contact) => {
        const hasJobToday = allAvailability.some((avail) => {
          if (avail.contactId !== contact.id || avail.status !== "confirmed") {
            return false;
          }
          const job = jobMap.get(avail.jobId);
          if (!job) {
            return false;
          }
          const jobStart = new Date(job.startTime);
          const jobEnd = new Date(job.endTime);
          return jobStart <= todayEnd && jobEnd >= todayStart;
        });
        return {
          ...contact,
          status: hasJobToday ? "on_job" : contact.status === "on_job" ? "free" : contact.status
        };
      });
      res.json(contactsWithStatus);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/contacts/:id/current-job", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const contact = await storage.getContact(id, req.user.organizationId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const job = await storage.getCurrentJobForContact(id, req.user.organizationId);
      if (!job) {
        return res.status(404).json({ message: "No current job found for this contact" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/contacts", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const validated = insertContactSchema.parse(req.body);
      const contactData = { ...validated };
      if (contactData.hasLogin && contactData.password) {
        contactData.password = await bcrypt3.hash(contactData.password, 10);
      } else if (!contactData.hasLogin) {
        delete contactData.password;
      }
      if (contactData.hasLogin && !contactData.email) {
        return res.status(400).json({ message: "Email is required when login is enabled" });
      }
      const contact = await storage.createContact(req.user.organizationId, req.user.id, contactData);
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/contacts/upload-image", requireAuth, async (req, res) => {
    try {
      const fs2 = await import("fs/promises");
      const path4 = await import("path");
      const { nanoid: nanoid3 } = await import("nanoid");
      const uploadsDir = path4.join(process.cwd(), "attached_assets", "profile_pictures");
      await fs2.mkdir(uploadsDir, { recursive: true });
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const boundary = req.headers["content-type"]?.split("boundary=")[1];
      if (!boundary) {
        return res.status(400).json({ message: "Invalid content type" });
      }
      const parts = buffer.toString("binary").split(`--${boundary}`);
      let fileData = null;
      let fileExt = "jpg";
      for (const part of parts) {
        if (part.includes("Content-Type: image/")) {
          const contentType = part.match(/Content-Type: image\/(\w+)/)?.[1];
          if (contentType) fileExt = contentType;
          const dataStart = part.indexOf("\r\n\r\n") + 4;
          const dataEnd = part.lastIndexOf("\r\n");
          if (dataStart > 3 && dataEnd > dataStart) {
            const binaryData = part.substring(dataStart, dataEnd);
            fileData = Buffer.from(binaryData, "binary");
            break;
          }
        }
      }
      if (!fileData) {
        return res.status(400).json({ message: "No file data found" });
      }
      const fileName = `${nanoid3()}.${fileExt}`;
      const filePath = path4.join(uploadsDir, fileName);
      await fs2.writeFile(filePath, fileData);
      const url = `/attached_assets/profile_pictures/${fileName}`;
      res.json({ url });
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/contacts/bulk", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const organizationId = req.user.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const { contacts: phoneContacts } = req.body;
      if (!Array.isArray(phoneContacts)) {
        return res.status(400).json({ message: "Invalid request: contacts must be an array" });
      }
      const results = {
        imported: 0,
        skipped: 0,
        errors: []
      };
      const existingContacts = await storage.getContacts(organizationId);
      const existingPhones = new Set(existingContacts.map((c) => c.phone));
      for (let i = 0; i < phoneContacts.length; i++) {
        const phoneContact = phoneContacts[i];
        try {
          const contactData = insertContactSchema.parse({
            userId,
            firstName: phoneContact.firstName,
            lastName: phoneContact.lastName,
            phone: phoneContact.phone,
            email: phoneContact.email || void 0,
            status: "free",
            countryCode: phoneContact.countryCode || "GB"
          });
          if (existingPhones.has(contactData.phone)) {
            results.skipped++;
            continue;
          }
          await storage.createContact(organizationId, userId, contactData);
          results.imported++;
          existingPhones.add(contactData.phone);
        } catch (error) {
          results.errors.push(`Contact ${i + 1}: ${error.message}`);
          results.skipped++;
        }
      }
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const contact = await storage.getContact(req.params.id, req.user.organizationId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (contact.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this contact" });
      }
      const updateData = { ...req.body };
      if (updateData.hasLogin && updateData.password) {
        if (updateData.password.length !== 60) {
          updateData.password = await bcrypt3.hash(updateData.password, 10);
        }
      } else if (updateData.hasLogin === false) {
        updateData.password = null;
      } else if (!updateData.hasLogin && contact.hasLogin && !updateData.password) {
      }
      if (updateData.hasLogin && !updateData.email && !contact.email) {
        return res.status(400).json({ message: "Email is required when login is enabled" });
      }
      const updatedContact = await storage.updateContact(req.params.id, updateData);
      res.json(updatedContact);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const contact = await storage.getContact(req.params.id, req.user.organizationId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (contact.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to delete this contact" });
      }
      await storage.deleteContact(req.params.id);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/contacts/import", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const organizationId = req.user.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const { contacts: csvContacts } = req.body;
      if (!Array.isArray(csvContacts)) {
        return res.status(400).json({ message: "Invalid request: contacts must be an array" });
      }
      const results = {
        imported: 0,
        skipped: 0,
        errors: []
      };
      const existingContacts = await storage.getContacts(organizationId);
      const existingPhones = new Set(existingContacts.map((c) => c.phone));
      for (let i = 0; i < csvContacts.length; i++) {
        const csvContact = csvContacts[i];
        const rowNum = i + 2;
        try {
          if (!csvContact.firstName || !csvContact.lastName || !csvContact.phone) {
            results.errors.push(`Row ${rowNum}: Missing required fields (firstName, lastName, or phone)`);
            results.skipped++;
            continue;
          }
          if (existingPhones.has(csvContact.phone)) {
            results.errors.push(`Row ${rowNum}: Phone ${csvContact.phone} already exists`);
            results.skipped++;
            continue;
          }
          const validated = insertContactSchema.parse({
            firstName: csvContact.firstName,
            lastName: csvContact.lastName,
            phone: csvContact.phone,
            email: csvContact.email || null,
            notes: csvContact.notes || null
          });
          await storage.createContact(organizationId, userId, validated);
          existingPhones.add(csvContact.phone);
          results.imported++;
        } catch (error) {
          results.errors.push(`Row ${rowNum}: ${error.message}`);
          results.skipped++;
        }
      }
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/contacts/:id/roster-token", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const contact = await storage.getContact(req.params.id, req.user.organizationId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (contact.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (!contact.rosterToken) {
        const token = nanoid(32);
        await storage.updateContact(req.params.id, { rosterToken: token });
        return res.json({ token });
      }
      res.json({ token: contact.rosterToken });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/roster/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const contact = await storage.getContactByRosterToken(token);
      if (!contact) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      const organizationId = contact.organizationId;
      const availabilityRecords = await storage.getAvailabilityByContact(contact.id, organizationId);
      const jobIds = availabilityRecords.map((a) => a.jobId);
      const jobs2 = [];
      for (const jobId of jobIds) {
        const job = await storage.getJob(jobId);
        if (job) {
          jobs2.push(job);
        }
      }
      jobs2.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      res.json({
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName
        },
        jobs: jobs2.map((job) => ({
          id: job.id,
          name: job.name,
          location: job.location,
          startTime: job.startTime,
          endTime: job.endTime,
          notes: job.notes
        }))
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/contact/jobs", requireContactAuth, async (req, res) => {
    try {
      const contact = req.contact;
      const organizationId = contact.organizationId;
      const availabilityRecords = await storage.getAvailabilityByContact(contact.id, organizationId);
      const jobIds = availabilityRecords.map((a) => a.jobId);
      const jobsWithAvailability = [];
      for (const availability2 of availabilityRecords) {
        const job = await storage.getJob(availability2.jobId);
        if (job) {
          jobsWithAvailability.push({
            id: job.id,
            name: job.name,
            location: job.location,
            startTime: job.startTime,
            endTime: job.endTime,
            notes: job.notes,
            availabilityStatus: availability2.status,
            // "no_reply", "confirmed", "declined", "maybe"
            shiftPreference: availability2.shiftPreference,
            updatedAt: availability2.updatedAt
          });
        }
      }
      jobsWithAvailability.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      res.json({ jobs: jobsWithAvailability });
    } catch (error) {
      console.error("Get contact jobs error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/contact/schedule", requireContactAuth, async (req, res) => {
    try {
      const contact = req.contact;
      const organizationId = contact.organizationId;
      const availabilityRecords = await storage.getAvailabilityByContact(contact.id, organizationId);
      const now = /* @__PURE__ */ new Date();
      const upcoming = [];
      const past = [];
      for (const availability2 of availabilityRecords) {
        const job = await storage.getJob(availability2.jobId);
        if (!job) continue;
        const jobData = {
          id: job.id,
          name: job.name,
          location: job.location,
          startTime: job.startTime,
          endTime: job.endTime,
          notes: job.notes,
          availabilityStatus: availability2.status,
          shiftPreference: availability2.shiftPreference
        };
        if (new Date(job.startTime) >= now) {
          upcoming.push(jobData);
        } else {
          past.push(jobData);
        }
      }
      upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      past.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      res.json({ upcoming, past });
    } catch (error) {
      console.error("Get contact schedule error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/contact/invitations", requireContactAuth, async (req, res) => {
    try {
      const contact = req.contact;
      const organizationId = contact.organizationId;
      const allAvailability = await storage.getAvailabilityByContact(contact.id, organizationId);
      const pendingAvailability = allAvailability.filter(
        (a) => a.status === "no_reply" || a.status === "maybe"
      );
      const invitations = [];
      for (const availability2 of pendingAvailability) {
        const job = await storage.getJob(availability2.jobId);
        if (job) {
          invitations.push({
            id: job.id,
            name: job.name,
            location: job.location,
            startTime: job.startTime,
            endTime: job.endTime,
            notes: job.notes,
            availabilityStatus: availability2.status,
            shiftPreference: availability2.shiftPreference,
            availabilityId: availability2.id,
            // Include availability ID for updating
            createdAt: availability2.updatedAt
            // When the invitation was sent/updated
          });
        }
      }
      invitations.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      res.json({ invitations });
    } catch (error) {
      console.error("Get contact invitations error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/contact/availability/:availabilityId", requireContactAuth, async (req, res) => {
    try {
      const contact = req.contact;
      const { availabilityId } = req.params;
      const { status } = req.body;
      if (!status || !["confirmed", "declined", "maybe"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'confirmed', 'declined', or 'maybe'" });
      }
      const organizationId = contact.organizationId;
      const allAvailability = await storage.getAvailabilityByContact(contact.id, organizationId);
      const availability2 = allAvailability.find((a) => a.id === availabilityId);
      if (!availability2) {
        return res.status(404).json({ message: "Availability record not found" });
      }
      await storage.updateAvailability(availabilityId, {
        status
      });
      if (status === "confirmed") {
        await storage.updateContact(contact.id, { status: "on_job" });
      } else if (status === "declined") {
        await storage.updateContact(contact.id, { status: "free" });
      }
      res.json({ success: true, status });
    } catch (error) {
      console.error("Update contact availability error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/contact/messages", requireContactAuth, async (req, res) => {
    try {
      const contact = req.contact;
      const organizationId = contact.organizationId;
      const messages2 = await storage.getMessages(contact.id, organizationId);
      const messagesWithJobNames = await Promise.all(
        messages2.map(async (message) => {
          let jobName = void 0;
          if (message.jobId) {
            const job = await storage.getJob(message.jobId);
            if (job) {
              jobName = job.name;
            }
          }
          return {
            id: message.id,
            content: message.content,
            direction: message.direction,
            status: message.status,
            createdAt: message.createdAt,
            jobId: message.jobId,
            jobName
          };
        })
      );
      messagesWithJobNames.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      res.json(messagesWithJobNames);
    } catch (error) {
      console.error("Get contact messages error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/contact/device-token", requireContactAuth, async (req, res) => {
    try {
      const contact = req.contact;
      const { token, platform } = req.body;
      if (!token || !platform) {
        return res.status(400).json({ message: "Token and platform are required" });
      }
      if (!["ios", "android"].includes(platform)) {
        return res.status(400).json({ message: "Platform must be 'ios' or 'android'" });
      }
      const tokenStr = String(token).trim();
      if (platform === "ios") {
        const isValid = /^[0-9a-fA-F]{64}$/.test(tokenStr);
        if (!isValid) {
          console.error(`[DeviceToken] Invalid iOS token format!`);
          console.error(`Token: ${tokenStr}`);
          console.error(`Length: ${tokenStr.length} (expected 64)`);
          return res.status(400).json({
            message: `Invalid iOS device token format. Expected 64 hexadecimal characters, got ${tokenStr.length} characters. Token: ${tokenStr.substring(0, 20)}...`
          });
        }
        console.log(`[DeviceToken] \u2705 Valid iOS token (64 hex chars): ${tokenStr.substring(0, 20)}...${tokenStr.substring(44)}`);
      } else if (platform === "android") {
        if (tokenStr.length < 50) {
          console.error(`[DeviceToken] Invalid Android token length!`);
          console.error(`Token: ${tokenStr}`);
          console.error(`Length: ${tokenStr.length} (expected at least 50)`);
          return res.status(400).json({
            message: `Invalid Android device token format. Token too short: ${tokenStr.length} characters.`
          });
        }
        console.log(`[DeviceToken] \u2705 Valid Android token (${tokenStr.length} chars): ${tokenStr.substring(0, 20)}...${tokenStr.substring(tokenStr.length - 20)}`);
      }
      await storage.saveDeviceToken(contact.id, tokenStr, platform);
      console.log(`[DeviceToken] Registered ${platform} token for contact ${contact.id}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Register device token error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/contact/device-token", requireContactAuth, async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
      await storage.removeDeviceToken(token);
      console.log(`[DeviceToken] Removed token for contact`);
      res.json({ success: true });
    } catch (error) {
      console.error("Remove device token error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/contact/push-notification/delivered", requireContactAuth, async (req, res) => {
    try {
      const contact = req.contact;
      const { notificationId } = req.body;
      if (!notificationId) {
        return res.status(400).json({ message: "notificationId is required" });
      }
      const delivery = await storage.getPushNotificationDeliveryByNotificationId(notificationId);
      if (!delivery) {
        return res.status(404).json({ message: "Notification delivery record not found" });
      }
      if (delivery.contactId !== contact.id) {
        return res.status(403).json({ message: "This notification does not belong to you" });
      }
      await storage.updatePushNotificationDelivery(delivery.id, {
        status: "delivered",
        deliveredAt: /* @__PURE__ */ new Date()
      });
      console.log(`[PushNotification] Delivery confirmed for notification ${notificationId} (contact ${contact.id})`);
      res.json({ success: true });
    } catch (error) {
      console.error("Push notification delivery receipt error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/contact/push-notification/action", requireContactAuth, async (req, res) => {
    try {
      const contact = req.contact;
      const { notificationId, action, jobId } = req.body;
      if (!notificationId || !action || !jobId) {
        return res.status(400).json({ message: "notificationId, action, and jobId are required" });
      }
      if (!["accept", "decline"].includes(action)) {
        return res.status(400).json({ message: "action must be 'accept' or 'decline'" });
      }
      const delivery = await storage.getPushNotificationDeliveryByNotificationId(notificationId);
      if (!delivery) {
        return res.status(404).json({ message: "Notification delivery record not found" });
      }
      if (delivery.contactId !== contact.id) {
        return res.status(403).json({ message: "This notification does not belong to you" });
      }
      if (delivery.jobId !== jobId) {
        return res.status(400).json({ message: "jobId does not match notification" });
      }
      const organizationId = contact.organizationId;
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      let availability2 = await storage.getAvailabilityForContact(jobId, contact.id, organizationId);
      if (!availability2) {
        availability2 = await storage.createAvailability(organizationId, {
          contactId: contact.id,
          jobId,
          status: action === "accept" ? "confirmed" : "declined"
        });
      } else {
        await storage.updateAvailability(availability2.id, {
          status: action === "accept" ? "confirmed" : "declined"
        });
      }
      if (action === "accept") {
        await storage.updateContact(contact.id, { status: "on_job" });
      } else if (action === "decline") {
        await storage.updateContact(contact.id, { status: "free" });
      }
      const parsed = { status: action === "accept" ? "confirmed" : "declined" };
      await sendAcknowledgementSMS(organizationId, contact, job, parsed, contact.userId);
      if (delivery.status === "sent") {
        await storage.updatePushNotificationDelivery(delivery.id, {
          status: "delivered",
          deliveredAt: /* @__PURE__ */ new Date()
        });
      }
      console.log(`[PushNotification] Action ${action} processed for notification ${notificationId} (contact ${contact.id}, job ${jobId})`);
      res.json({
        success: true,
        status: action === "accept" ? "confirmed" : "declined"
      });
    } catch (error) {
      console.error("Push notification action error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/reports/resource-allocation", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const organizationId = req.user.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const contacts2 = await storage.getContacts(organizationId);
      const jobs2 = await storage.getJobs(organizationId);
      const allAvailability = await storage.getAllAvailability(organizationId);
      const user = await storage.getUser(userId);
      const now = /* @__PURE__ */ new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const jobMap = new Map(jobs2.map((job) => [job.id, job]));
      const contactsWithStatus = contacts2.map((contact) => {
        const hasJobToday = allAvailability.some((avail) => {
          if (avail.contactId !== contact.id || avail.status !== "confirmed") {
            return false;
          }
          const job = jobMap.get(avail.jobId);
          if (!job) {
            return false;
          }
          const jobStart = new Date(job.startTime);
          const jobEnd = new Date(job.endTime);
          return jobStart <= todayEnd && jobEnd >= todayStart;
        });
        return {
          ...contact,
          status: hasJobToday ? "on_job" : contact.status === "on_job" ? "free" : contact.status
        };
      });
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="resource-allocation-report.pdf"');
      doc.pipe(res);
      const primaryColor = "#0EA5E9";
      const successColor = "#10B981";
      const warningColor = "#F59E0B";
      const dangerColor = "#EF4444";
      const grayColor = "#6B7280";
      const lightGray = "#F3F4F6";
      const drawBox = (y, height, color) => {
        doc.rect(50, y, doc.page.width - 100, height).fill(color);
      };
      drawBox(30, 80, primaryColor);
      doc.fillColor("white").fontSize(24).font("Helvetica-Bold").text("RESOURCE ALLOCATION REPORT", 50, 50, { align: "center" });
      doc.fontSize(11).font("Helvetica").text(`Generated: ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })}`, 50, 80, { align: "center" });
      doc.moveDown(4);
      const contactsOnJob = contactsWithStatus.filter((c) => c.status === "on_job");
      const contactsAvailable = contactsWithStatus.filter((c) => c.status === "free");
      const contactsOffShift = contactsWithStatus.filter((c) => c.status === "off_shift");
      const contactJobMap = /* @__PURE__ */ new Map();
      allAvailability.forEach((avail) => {
        if (avail.status === "confirmed") {
          const job = jobs2.find((j) => j.id === avail.jobId);
          if (job) {
            contactJobMap.set(avail.contactId, job);
          }
        }
      });
      const summaryY = doc.y;
      const cardWidth = 120;
      const cardHeight = 60;
      const spacing = 20;
      doc.roundedRect(50, summaryY, cardWidth, cardHeight, 5).fillAndStroke(lightGray, grayColor);
      doc.fillColor(grayColor).fontSize(10).font("Helvetica").text("Total Contacts", 60, summaryY + 15);
      doc.fillColor("black").fontSize(24).font("Helvetica-Bold").text(contactsWithStatus.length.toString(), 60, summaryY + 30);
      doc.roundedRect(50 + cardWidth + spacing, summaryY, cardWidth, cardHeight, 5).fillAndStroke("#DCFCE7", successColor);
      doc.fillColor(successColor).fontSize(10).font("Helvetica").text("On Job", 60 + cardWidth + spacing, summaryY + 15);
      doc.fillColor("black").fontSize(24).font("Helvetica-Bold").text(contactsOnJob.length.toString(), 60 + cardWidth + spacing, summaryY + 30);
      doc.roundedRect(50 + (cardWidth + spacing) * 2, summaryY, cardWidth, cardHeight, 5).fillAndStroke("#DBEAFE", primaryColor);
      doc.fillColor(primaryColor).fontSize(10).font("Helvetica").text("Available", 60 + (cardWidth + spacing) * 2, summaryY + 15);
      doc.fillColor("black").fontSize(24).font("Helvetica-Bold").text(contactsAvailable.length.toString(), 60 + (cardWidth + spacing) * 2, summaryY + 30);
      doc.roundedRect(50 + (cardWidth + spacing) * 3, summaryY, cardWidth, cardHeight, 5).fillAndStroke("#FEF3C7", warningColor);
      doc.fillColor(warningColor).fontSize(10).font("Helvetica").text("Off Shift", 60 + (cardWidth + spacing) * 3, summaryY + 15);
      doc.fillColor("black").fontSize(24).font("Helvetica-Bold").text(contactsOffShift.length.toString(), 60 + (cardWidth + spacing) * 3, summaryY + 30);
      doc.moveDown(5);
      doc.fillColor(successColor).fontSize(16).font("Helvetica-Bold").text("\u25CF Contacts Assigned to Jobs", { continued: false });
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(successColor).stroke();
      doc.moveDown();
      if (contactsOnJob.length === 0) {
        doc.fillColor(grayColor).fontSize(10).font("Helvetica-Oblique").text("No contacts currently assigned to jobs.");
        doc.moveDown();
      } else {
        const jobGroups = /* @__PURE__ */ new Map();
        contactsOnJob.forEach((contact) => {
          const job = contactJobMap.get(contact.id);
          if (job) {
            if (!jobGroups.has(job.id)) {
              jobGroups.set(job.id, []);
            }
            jobGroups.get(job.id).push(contact);
          }
        });
        jobGroups.forEach((contactsList, jobId) => {
          const job = jobs2.find((j) => j.id === jobId);
          if (job) {
            const boxY = doc.y;
            doc.roundedRect(50, boxY, doc.page.width - 100, 10 + contactsList.length * 15 + 50, 5).fillAndStroke("#F0FDF4", "#86EFAC");
            doc.fillColor("black").fontSize(13).font("Helvetica-Bold").text(`\u{1F4CB} ${job.name}`, 60, boxY + 10);
            doc.fillColor(grayColor).fontSize(9).font("Helvetica");
            doc.text(`\u{1F4CD} ${job.location || "N/A"}`, 60, doc.y + 5);
            doc.text(`\u{1F4C5} ${new Date(job.startTime).toLocaleDateString("en-GB", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })} - ${new Date(job.endTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`, 60, doc.y + 3);
            if (job.notes) {
              doc.fillColor(grayColor).fontSize(8).font("Helvetica-Oblique").text(`Note: ${job.notes}`, 60, doc.y + 3, { width: doc.page.width - 120 });
            }
            doc.moveDown(0.5);
            doc.fillColor("black").fontSize(10).font("Helvetica-Bold").text("Team Members:", 60, doc.y + 5);
            contactsList.forEach((contact, index) => {
              doc.fillColor("black").fontSize(9).font("Helvetica").text(
                `  ${index + 1}. ${contact.firstName} ${contact.lastName}`,
                70,
                doc.y + 3
              );
              doc.fillColor(grayColor).fontSize(8).text(
                `     \u{1F4DE} ${contact.phone}${contact.email ? ` \u2022 \u{1F4E7} ${contact.email}` : ""}`,
                70,
                doc.y + 2
              );
            });
            doc.moveDown(1.5);
          }
        });
      }
      doc.moveDown();
      doc.fillColor(primaryColor).fontSize(16).font("Helvetica-Bold").text("\u25CF Available Contacts", { continued: false });
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(primaryColor).stroke();
      doc.moveDown();
      if (contactsAvailable.length === 0) {
        doc.fillColor(grayColor).fontSize(10).font("Helvetica-Oblique").text("No contacts currently available.");
      } else {
        contactsAvailable.forEach((contact, index) => {
          if (index % 2 === 0) {
            doc.roundedRect(50, doc.y - 2, doc.page.width - 100, 15, 3).fill("#EFF6FF");
          }
          doc.fillColor("black").fontSize(10).font("Helvetica").text(
            `${index + 1}. ${contact.firstName} ${contact.lastName}`,
            60,
            doc.y + 2,
            { continued: true, width: 200 }
          );
          doc.fillColor(grayColor).fontSize(9).text(
            ` \u2022 ${contact.phone}${contact.email ? ` \u2022 ${contact.email}` : ""}`,
            { continued: false }
          );
        });
      }
      doc.moveDown(2);
      doc.fillColor(warningColor).fontSize(16).font("Helvetica-Bold").text("\u25CF Off Shift Contacts", { continued: false });
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(warningColor).stroke();
      doc.moveDown();
      if (contactsOffShift.length === 0) {
        doc.fillColor(grayColor).fontSize(10).font("Helvetica-Oblique").text("No contacts currently off shift.");
      } else {
        contactsOffShift.forEach((contact, index) => {
          if (index % 2 === 0) {
            doc.roundedRect(50, doc.y - 2, doc.page.width - 100, 15, 3).fill("#FFFBEB");
          }
          doc.fillColor("black").fontSize(10).font("Helvetica").text(
            `${index + 1}. ${contact.firstName} ${contact.lastName}`,
            60,
            doc.y + 2,
            { continued: true, width: 200 }
          );
          doc.fillColor(grayColor).fontSize(9).text(
            ` \u2022 ${contact.phone}${contact.email ? ` \u2022 ${contact.email}` : ""}`,
            { continued: false }
          );
        });
      }
      doc.moveDown(3);
      const footerY = doc.page.height - 80;
      doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).strokeColor(grayColor).stroke();
      doc.fillColor(grayColor).fontSize(8).font("Helvetica").text(`HeyTeam Resource Allocation Report`, 50, footerY + 10, { align: "center" });
      doc.text(`\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} HeyTeam. All rights reserved.`, { align: "center" });
      doc.end();
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/jobs/:id/calendar-invite", async (req, res) => {
    try {
      const { id } = req.params;
      const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : null;
      if (!organizationId) {
        return res.status(400).json({ message: "organizationId query parameter is required" });
      }
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      const icsContent = generateICS(job);
      const safeFilename = job.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const filename = `${safeFilename}-${new Date(job.startTime).toISOString().split("T")[0]}.ics`;
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(icsContent);
    } catch (error) {
      console.error("Error generating calendar invite:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/templates", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const templates2 = await storage.getTemplates(req.user.organizationId);
      res.json(templates2);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/templates", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const validated = insertTemplateSchema.parse(req.body);
      const template = await storage.createTemplate(req.user.organizationId, req.user.id, validated);
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/templates/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      if (template.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this template" });
      }
      const validated = insertTemplateSchema.parse(req.body);
      const updated = await storage.updateTemplate(req.params.id, validated);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/templates/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      if (template.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to delete this template" });
      }
      await storage.deleteTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/send-message", requireAuth, async (req, res) => {
    try {
      const { jobId, templateId, contactIds } = req.body;
      const userId = req.user.id;
      const organizationId = req.user.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const availableCredits = await creditService3.getAvailableCreditsForOrganization(organizationId);
      if (availableCredits <= 0) {
        return res.status(400).json({ message: "Insufficient SMS credits" });
      }
      const jobRecord = await storage.getJob(jobId);
      const template = await storage.getTemplate(templateId);
      if (!jobRecord || !template) {
        return res.status(404).json({ message: "Job or template not found" });
      }
      const skillRequirements = await storage.getJobSkillRequirements(jobId);
      const job = {
        ...jobRecord,
        skillRequirements
      };
      const campaign = await storage.createCampaign(organizationId, userId, {
        jobId,
        templateId
      });
      let twilioClient = null;
      let fromNumber = "";
      try {
        twilioClient = await getTwilioClient();
        fromNumber = await getTwilioFromPhoneNumber();
      } catch (error) {
        console.log("Twilio not configured, messages will be logged only");
      }
      const prioritized = await prioritizeContacts(contactIds, job, organizationId);
      if (!prioritized.length) {
        return res.status(400).json({ message: "No eligible contacts to message" });
      }
      const skillAwarePrioritized = orderContactsBySkillPriority(prioritized, skillRequirements);
      const prioritizedContacts = skillAwarePrioritized.map((entry) => entry.contact);
      const maxDeliverable = Math.min(prioritizedContacts.length, availableCredits);
      const trimmedContacts = prioritizedContacts.slice(0, maxDeliverable);
      if (!trimmedContacts.length) {
        return res.status(400).json({ message: "Insufficient SMS credits to send messages" });
      }
      const trimmedContactIds = trimmedContacts.map((c) => c.id);
      const deviceTokens2 = await storage.getDeviceTokensForContacts(trimmedContactIds);
      const contactsWithTokens = deviceTokens2.map((dt) => ({
        contactId: dt.contactId,
        token: dt.token,
        platform: dt.platform
      }));
      const availabilityMap = /* @__PURE__ */ new Map();
      for (const contact of trimmedContacts) {
        const availability2 = await storage.getAvailabilityForContact(jobId, contact.id, organizationId);
        if (availability2) {
          availabilityMap.set(contact.id, availability2.id);
        }
      }
      let contactsToSms = [...trimmedContacts];
      let pushSuccessCount = 0;
      let pushFailedCount = 0;
      if (contactsWithTokens.length > 0) {
        const formattedDate = format2(new Date(job.startTime), "MMM d, yyyy 'at' h:mm a");
        const notificationTitle = "New Job Invitation";
        const notificationBody = `${job.name} - ${formattedDate}`;
        const pushResult = await sendPushNotificationsToContacts(
          contactsWithTokens,
          {
            title: notificationTitle,
            body: notificationBody,
            data: {
              type: "job_invitation",
              jobId: job.id,
              action: "view_invitations"
            }
          }
        );
        pushSuccessCount = pushResult.success.length;
        pushFailedCount = pushResult.failed.length;
        for (const { contactId, notificationId, token } of pushResult.notificationIds) {
          const contact = trimmedContacts.find((c) => c.id === contactId);
          if (contact) {
            await storage.createPushNotificationDelivery({
              contactId,
              jobId: job.id,
              campaignId: campaign.id,
              deviceToken: token,
              notificationId,
              status: "sent"
            });
          }
        }
        setTimeout(async () => {
          try {
            const undelivered = await storage.getUndeliveredNotifications(30);
            const undeliveredForThisCampaign = undelivered.filter(
              (d) => d.campaignId === campaign.id && d.jobId === job.id
            );
            if (undeliveredForThisCampaign.length > 0) {
              console.log(`[SendMessage] ${undeliveredForThisCampaign.length} push notifications not delivered after 30 seconds, sending SMS fallback`);
              const undeliveredContactIds = new Set(undeliveredForThisCampaign.map((d) => d.contactId));
              const contactsNeedingSMS = trimmedContacts.filter((c) => undeliveredContactIds.has(c.id));
              for (const delivery of undeliveredForThisCampaign) {
                await storage.updatePushNotificationDelivery(delivery.id, {
                  status: "sms_fallback",
                  smsFallbackSentAt: /* @__PURE__ */ new Date()
                });
              }
              if (contactsNeedingSMS.length > 0 && twilioClient && fromNumber) {
                const baseUrlFromRequest2 = `${req.protocol}://${req.get("host")}`;
                const rosterBaseUrl2 = (process.env.PUBLIC_BASE_URL || baseUrlFromRequest2).replace(/\/$/, "");
                await scheduleBatchedMessages(contactsNeedingSMS, {
                  job,
                  template,
                  campaign,
                  organizationId,
                  userId,
                  availableCredits: contactsNeedingSMS.length,
                  twilioClient,
                  fromNumber,
                  rosterBaseUrl: rosterBaseUrl2
                });
              }
            }
          } catch (error) {
            console.error("[SendMessage] Error checking undelivered notifications:", error);
          }
        }, 3e4);
        const pushSuccessSet = new Set(pushResult.success);
        contactsToSms = trimmedContacts.filter((contact) => !pushSuccessSet.has(contact.id));
        console.log(`[SendMessage] Push notifications: ${pushSuccessCount} sent, ${pushFailedCount} failed. SMS will be sent to ${contactsToSms.length} contacts immediately, and to push recipients if not delivered within 30 seconds.`);
      }
      const baseUrlFromRequest = `${req.protocol}://${req.get("host")}`;
      const rosterBaseUrl = (process.env.PUBLIC_BASE_URL || baseUrlFromRequest).replace(/\/$/, "");
      if (contactsToSms.length > 0) {
        await scheduleBatchedMessages(contactsToSms, {
          job,
          template,
          campaign,
          organizationId,
          userId,
          availableCredits: contactsToSms.length,
          twilioClient,
          fromNumber,
          rosterBaseUrl
        });
      }
      res.json({
        success: true,
        campaign,
        queuedContacts: trimmedContacts.map((contact) => contact.id),
        totalQueued: trimmedContacts.length,
        pushNotificationsSent: pushSuccessCount,
        pushNotificationsFailed: pushFailedCount,
        smsQueued: contactsToSms.length,
        batchSize: MESSAGE_BATCH_SIZE,
        batchDelayMinutes: MESSAGE_BATCH_DELAY_MS / 6e4
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/messages/bulk-sms", requireAuth, async (req, res) => {
    try {
      const { contactIds, message } = req.body;
      const userId = req.user.id;
      const organizationId = req.user.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: "Contact IDs required" });
      }
      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message content required" });
      }
      const availableCredits = await creditService3.getAvailableCreditsForOrganization(organizationId);
      if (availableCredits < contactIds.length) {
        return res.status(400).json({
          message: `Insufficient SMS credits. Available: ${availableCredits}, Required: ${contactIds.length}`
        });
      }
      let twilioClient = null;
      let fromNumber = "";
      try {
        twilioClient = await getTwilioClient();
        fromNumber = await getTwilioFromPhoneNumber();
      } catch (error) {
        console.log("Twilio not configured, messages will be logged only");
      }
      let sent = 0;
      let useTwilio = twilioClient && fromNumber;
      for (const contactId of contactIds) {
        const contact = await storage.getContact(contactId, organizationId);
        if (!contact || contact.isOptedOut) continue;
        if (useTwilio) {
          try {
            const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
            const twilioMessage = await twilioClient.messages.create({
              body: message,
              from: fromNumber,
              to: e164Phone
            });
            await storage.createMessage(organizationId, userId, {
              contactId,
              jobId: null,
              campaignId: null,
              direction: "outbound",
              content: message,
              status: "sent",
              twilioSid: twilioMessage.sid
            });
            sent++;
          } catch (error) {
            if (error.status === 401 || error.code === 20003) {
              console.log("Twilio authentication failed, switching to dev mode");
              useTwilio = false;
              console.log(`[DEV MODE] Would send SMS to ${contact.phone}: ${message}`);
              await storage.createMessage(organizationId, userId, {
                contactId,
                jobId: null,
                campaignId: null,
                direction: "outbound",
                content: message,
                status: "sent",
                twilioSid: `dev-${Date.now()}-${contactId}`
              });
              sent++;
            } else {
              console.error(`Failed to send SMS to ${contact.phone}:`, error);
              await storage.createMessage(organizationId, userId, {
                contactId,
                jobId: null,
                campaignId: null,
                direction: "outbound",
                content: message,
                status: "failed",
                twilioSid: null
              });
            }
          }
        } else {
          console.log(`[DEV MODE] Would send SMS to ${contact.phone}: ${message}`);
          await storage.createMessage(organizationId, userId, {
            contactId,
            jobId: null,
            campaignId: null,
            direction: "outbound",
            content: message,
            status: "sent",
            twilioSid: `dev-${Date.now()}-${contactId}`
          });
          sent++;
        }
      }
      await creditService3.consumeCreditsForOrganization(
        organizationId,
        sent,
        "Bulk SMS broadcast",
        null
      );
      res.json({ success: true, sent });
    } catch (error) {
      console.error("Bulk SMS error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }
      const sig = req.headers["stripe-signature"];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("STRIPE_WEBHOOK_SECRET not configured");
        return res.status(500).json({ message: "Webhook secret not configured" });
      }
      try {
        let event;
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err) {
          console.error("Webhook signature verification failed:", err.message);
          return res.status(400).send(`Webhook Error: ${err.message}`);
        }
        console.log(`Received Stripe webhook: ${event.type}`);
        switch (event.type) {
          case "checkout.session.completed": {
            const session2 = event.data.object;
            const userId = session2.metadata?.userId;
            if (!userId) {
              console.error("No userId in checkout session metadata");
              break;
            }
            if (session2.mode === "subscription" && session2.subscription) {
              const subscriptionId = session2.subscription;
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              const planId = session2.metadata?.planId;
              if (!planId) {
                console.error("No planId in session metadata");
                break;
              }
              const plan = await storage.getSubscriptionPlan(planId);
              if (!plan) {
                console.error(`Plan ${planId} not found`);
                break;
              }
              const subscribingUser = await storage.getUser(userId);
              if (!subscribingUser?.organizationId) {
                console.error(`User ${userId} missing organization; cannot grant subscription credits`);
                break;
              }
              const currency = session2.metadata?.currency || "GBP";
              const subData = subscription;
              const subscriptionData = {
                planId,
                currency,
                stripeSubscriptionId: subscriptionId,
                status: subscription.status
              };
              if (subData.current_period_start && typeof subData.current_period_start === "number") {
                subscriptionData.currentPeriodStart = new Date(subData.current_period_start * 1e3);
              }
              if (subData.current_period_end && typeof subData.current_period_end === "number") {
                subscriptionData.currentPeriodEnd = new Date(subData.current_period_end * 1e3);
              }
              let userSub = await storage.getSubscription(subscribingUser.organizationId) || await storage.getSubscription(userId);
              if (userSub) {
                await storage.updateSubscription(userSub.userId ?? userId, subscriptionData);
              } else {
                await storage.createSubscription(userId, subscriptionData);
                userSub = await storage.getSubscription(subscribingUser.organizationId) || await storage.getSubscription(userId);
              }
              let expiryDate;
              if (subData.current_period_end && typeof subData.current_period_end === "number") {
                expiryDate = new Date(subData.current_period_end * 1e3);
              } else {
                expiryDate = /* @__PURE__ */ new Date();
                expiryDate.setMonth(expiryDate.getMonth() + 1);
              }
              await creditService3.grantCredits(
                userId,
                "subscription",
                plan.monthlyCredits,
                planId,
                expiryDate
              );
              console.log(`Granted ${plan.monthlyCredits} credits to user ${userId} for subscription ${planId}`);
              const user = subscribingUser;
              if (user?.resellerId) {
                const reseller = await storage.getReseller(user.resellerId);
                if (reseller && reseller.status === "active") {
                  const existing = await storage.getResellerTransactionByStripeEventId(event.id);
                  if (existing) {
                    console.log(`Event ${event.id} already processed, skipping reseller transaction`);
                  } else {
                    let revenueAmount = 0;
                    if (currency === "GBP") {
                      revenueAmount = plan.priceGBP;
                    } else if (currency === "USD") {
                      revenueAmount = plan.priceUSD;
                    } else if (currency === "EUR") {
                      revenueAmount = plan.priceEUR;
                    }
                    const commissionAmount = Math.round(revenueAmount * (reseller.commissionRate / 100));
                    await storage.createResellerTransaction({
                      resellerId: reseller.id,
                      userId,
                      type: "subscription_start",
                      amount: revenueAmount,
                      currency,
                      commissionAmount,
                      occurredAt: /* @__PURE__ */ new Date(),
                      stripeEventId: event.id,
                      stripeCheckoutId: session2.id
                    });
                    console.log(`Recorded reseller transaction for ${reseller.name}: ${revenueAmount} ${currency}, commission: ${commissionAmount}`);
                  }
                }
              }
            } else if (session2.mode === "payment") {
              const bundleId = session2.metadata?.bundleId;
              if (!bundleId) {
                console.error("No bundleId in session metadata");
                break;
              }
              const bundle = await storage.getSmsBundle(bundleId);
              if (!bundle) {
                console.error(`Bundle ${bundleId} not found`);
                break;
              }
              const expiryDate = /* @__PURE__ */ new Date();
              expiryDate.setFullYear(expiryDate.getFullYear() + 10);
              const bundlePurchasingUser = await storage.getUser(userId);
              if (!bundlePurchasingUser?.organizationId) {
                console.error(`User ${userId} missing organization; cannot grant bundle credits`);
                break;
              }
              await creditService3.grantCredits(
                userId,
                "bundle",
                bundle.credits,
                bundleId,
                expiryDate
              );
              console.log(`Granted ${bundle.credits} credits to user ${userId} for bundle ${bundleId}`);
              const user = bundlePurchasingUser;
              if (user?.resellerId) {
                const reseller = await storage.getReseller(user.resellerId);
                if (reseller && reseller.status === "active") {
                  const existing = await storage.getResellerTransactionByStripeEventId(event.id);
                  if (existing) {
                    console.log(`Event ${event.id} already processed, skipping reseller transaction`);
                  } else {
                    const currency = session2.metadata?.currency || user.currency || "GBP";
                    let revenueAmount = 0;
                    if (currency === "GBP") {
                      revenueAmount = bundle.priceGBP;
                    } else if (currency === "USD") {
                      revenueAmount = bundle.priceUSD;
                    } else if (currency === "EUR") {
                      revenueAmount = bundle.priceEUR;
                    }
                    const commissionAmount = Math.round(revenueAmount * (reseller.commissionRate / 100));
                    await storage.createResellerTransaction({
                      resellerId: reseller.id,
                      userId,
                      type: "bundle_purchase",
                      amount: revenueAmount,
                      currency,
                      commissionAmount,
                      occurredAt: /* @__PURE__ */ new Date(),
                      stripeEventId: event.id,
                      stripeCheckoutId: session2.id
                    });
                    console.log(`Recorded reseller transaction for ${reseller.name}: ${revenueAmount} ${currency}, commission: ${commissionAmount}`);
                  }
                }
              }
            }
            break;
          }
          case "invoice.payment_succeeded": {
            const invoice = event.data.object;
            const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
            if (!subscriptionId) {
              console.log("Invoice not for a subscription, skipping");
              break;
            }
            const subscriptions2 = await storage.getAllSubscriptions() || [];
            const userSub = subscriptions2.find((s) => s.stripeSubscriptionId === subscriptionId);
            if (!userSub) {
              console.error(`Subscription ${subscriptionId} not found in database`);
              break;
            }
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const subData = subscription;
            const updateData = {
              status: subscription.status
            };
            if (subData.current_period_start && typeof subData.current_period_start === "number") {
              updateData.currentPeriodStart = new Date(subData.current_period_start * 1e3);
            }
            if (subData.current_period_end && typeof subData.current_period_end === "number") {
              updateData.currentPeriodEnd = new Date(subData.current_period_end * 1e3);
            }
            await storage.updateSubscription(userSub.userId, updateData);
            if (invoice.billing_reason === "subscription_cycle" && userSub.planId) {
              const plan = await storage.getSubscriptionPlan(userSub.planId);
              if (plan) {
                let expiryDate;
                if (subData.current_period_end && typeof subData.current_period_end === "number") {
                  expiryDate = new Date(subData.current_period_end * 1e3);
                } else {
                  expiryDate = /* @__PURE__ */ new Date();
                  expiryDate.setMonth(expiryDate.getMonth() + 1);
                }
                await creditService3.grantCredits(
                  userSub.userId,
                  "subscription",
                  plan.monthlyCredits,
                  userSub.planId,
                  expiryDate
                );
                console.log(`Granted ${plan.monthlyCredits} credits to user ${userSub.userId} for renewal`);
                const user = await storage.getUser(userSub.userId);
                if (user?.resellerId) {
                  const reseller = await storage.getReseller(user.resellerId);
                  if (reseller && reseller.status === "active") {
                    const existing = await storage.getResellerTransactionByStripeEventId(event.id);
                    if (existing) {
                      console.log(`Event ${event.id} already processed, skipping reseller transaction`);
                    } else {
                      const currency = userSub.currency || user.currency || "GBP";
                      let revenueAmount = 0;
                      if (currency === "GBP") {
                        revenueAmount = plan.priceGBP;
                      } else if (currency === "USD") {
                        revenueAmount = plan.priceUSD;
                      } else if (currency === "EUR") {
                        revenueAmount = plan.priceEUR;
                      }
                      const commissionAmount = Math.round(revenueAmount * (reseller.commissionRate / 100));
                      await storage.createResellerTransaction({
                        resellerId: reseller.id,
                        userId: user.id,
                        type: "subscription_renewal",
                        amount: revenueAmount,
                        currency,
                        commissionAmount,
                        occurredAt: /* @__PURE__ */ new Date(),
                        stripeEventId: event.id
                      });
                      console.log(`Recorded reseller renewal transaction for ${reseller.name}: ${revenueAmount} ${currency}, commission: ${commissionAmount}`);
                    }
                  }
                }
              }
            }
            break;
          }
          case "customer.subscription.deleted": {
            const subscription = event.data.object;
            const subscriptionId = subscription.id;
            const subscriptions2 = await storage.getAllSubscriptions?.() || [];
            const userSub = subscriptions2.find((s) => s.stripeSubscriptionId === subscriptionId);
            if (userSub) {
              await storage.updateSubscription(userSub.userId, {
                status: "canceled"
              });
              console.log(`Subscription ${subscriptionId} cancelled for user ${userSub.userId}`);
            }
            break;
          }
          default:
            console.log(`Unhandled event type: ${event.type}`);
        }
        res.json({ received: true });
      } catch (error) {
        console.error("Stripe webhook error:", error);
        res.status(500).json({ message: error.message });
      }
    }
  );
  app2.post("/webhook/twilio/sms", async (req, res) => {
    try {
      const { From, Body, MessageSid } = req.body;
      let phoneWithoutCountry = normalizePhoneNumber(From);
      const countryCodesToTry = ["1", "44", "61", "64", "353", "91", "65", "52", "49", "33", "34", "39"];
      let contact = null;
      for (const code of countryCodesToTry) {
        if (phoneWithoutCountry.startsWith(code)) {
          const stripped = phoneWithoutCountry.substring(code.length);
          contact = await storage.getContactByPhone(stripped);
          if (contact) {
            break;
          }
        }
      }
      if (!contact) {
        contact = await storage.getContactByPhone(phoneWithoutCountry);
      }
      if (!contact) {
        return res.status(200).send("OK");
      }
      if (Body.toLowerCase().includes("stop") || Body.toLowerCase().includes("unsubscribe")) {
        await storage.updateContact(contact.id, { isOptedOut: true });
        return res.status(200).send("OK");
      }
      const messages2 = await storage.getMessages(contact.id, contact.organizationId);
      const recentMessages = messages2.filter(
        (m) => m.direction === "outbound" && m.jobId
      ).slice(-5);
      const jobId = recentMessages.length > 0 ? recentMessages[recentMessages.length - 1].jobId : null;
      await storage.createMessage(contact.organizationId, contact.userId, {
        contactId: contact.id,
        jobId,
        campaignId: null,
        direction: "inbound",
        content: Body,
        status: "received",
        twilioSid: MessageSid
      });
      if (jobId) {
        const parsed = parseReply(Body);
        const availability2 = await storage.getAvailabilityForContact(jobId, contact.id, contact.organizationId);
        console.log("Parsed reply:", parsed);
        if (availability2) {
          await storage.updateAvailability(availability2.id, {
            status: parsed.status,
            shiftPreference: parsed.shiftPreference || availability2.shiftPreference
          });
          if (parsed.status === "confirmed") {
            await storage.updateContact(contact.id, { status: "on_job" });
            console.log("on job");
          } else if (parsed.status === "declined") {
            await storage.updateContact(contact.id, { status: "free" });
          }
        }
        const job = await storage.getJob(jobId);
        if (job && parsed.status !== "no_reply") {
          await sendAcknowledgementSMS(contact.organizationId, contact, job, parsed, contact.userId);
          if (parsed.status === "confirmed") {
            await checkAndNotifyJobFulfillment(job, contact.organizationId);
          }
        }
      }
      res.status(200).send("OK");
    } catch (error) {
      console.error("Twilio webhook error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/messages/history", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const organizationId = req.user.organizationId;
      const messages2 = await storage.getAllMessagesForUser(organizationId);
      const enrichedMessages = await Promise.all(
        messages2.map(async (msg) => {
          const contact = await storage.getContact(msg.contactId, organizationId);
          const job = msg.jobId ? await storage.getJob(msg.jobId) : null;
          return {
            ...msg,
            contactName: contact ? `${contact.firstName} ${contact.lastName}` : "Unknown",
            jobName: job?.name || null
          };
        })
      );
      res.json(enrichedMessages);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/messages/:contactId", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const contact = await storage.getContact(req.params.contactId, req.user.organizationId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const messages2 = await storage.getMessages(req.params.contactId, req.user.organizationId);
      res.json(messages2);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/availability", requireAuth, async (req, res) => {
    try {
      const validated = insertAvailabilitySchema.parse(req.body);
      const contact = await storage.getContact(validated.contactId, req.user.organizationId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (contact.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to create availability for this contact" });
      }
      const availability2 = await storage.createAvailability(req.user.organizationId, validated);
      res.json(availability2);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/availability/:id", requireAuth, async (req, res) => {
    try {
      const { status, shiftPreference } = req.body;
      const allAvailability = await storage.getAllAvailability(req.user.id);
      const availabilityRecord = allAvailability.find((a) => a.id === req.params.id);
      if (!availabilityRecord) {
        return res.status(404).json({ message: "Availability record not found or not authorized" });
      }
      const updated = await storage.updateAvailability(req.params.id, {
        status,
        shiftPreference
      });
      if (status) {
        const contact = await storage.getContact(availabilityRecord.contactId, req.user.organizationId);
        if (contact) {
          if (status === "confirmed") {
            await storage.updateContact(contact.id, { status: "on_job" });
          } else if (status === "declined") {
            await storage.updateContact(contact.id, { status: "free" });
          }
        }
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/subscription", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const subscription = await storage.getSubscription(req.user.organizationId);
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      res.json(subscription);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/credits", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const organizationId = req.user.organizationId;
      const [available, breakdown] = await Promise.all([
        creditService3.getAvailableCredits(req.user.id),
        creditService3.getCreditBreakdown(req.user.id)
      ]);
      res.json({
        available,
        breakdown
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/subscription-plans", async (req, res) => {
    try {
      const plans = await storage.getSubscriptionPlans();
      res.json(plans.filter((p) => p.isActive));
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/sms-bundles", async (req, res) => {
    try {
      const bundles = await storage.getSmsBundles();
      res.json(bundles.filter((b) => b.isActive));
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/create-bundle-checkout-session", requireAuth, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }
      const userId = req.user.id;
      const { bundleId, currency } = req.body;
      const bundle = await storage.getSmsBundle(bundleId);
      if (!bundle) {
        return res.status(404).json({ message: "Bundle not found" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const stripeCurrency = currency.toLowerCase();
      let priceAmount = bundle.priceGBP;
      if (currency === "USD") {
        priceAmount = bundle.priceUSD;
      } else if (currency === "EUR") {
        priceAmount = bundle.priceEUR;
      }
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id
          }
        });
        customerId = customer.id;
        await storage.updateUser(userId, { stripeCustomerId: customerId });
      }
      const session2 = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: stripeCurrency,
              product_data: {
                name: bundle.name,
                description: `${bundle.credits.toLocaleString()} SMS credits`
              },
              unit_amount: priceAmount
            },
            quantity: 1
          }
        ],
        success_url: `${req.headers.origin}/billing?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/billing`,
        metadata: {
          userId,
          bundleId,
          credits: bundle.credits.toString(),
          type: "bundle_purchase"
        }
      });
      res.json({ url: session2.url });
    } catch (error) {
      console.error("Bundle checkout session error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/create-checkout-session", async (req, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }
      let userId = req.session.userId;
      if (!userId) {
        userId = req.headers["x-user-id"];
      }
      if (!userId) {
        return res.status(401).json({ message: "Not Authenticated" });
      }
      const { planId, currency = "GBP" } = req.body;
      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }
      if (!["GBP", "USD", "EUR"].includes(currency)) {
        return res.status(400).json({ message: "Invalid currency" });
      }
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan || !plan.isActive) {
        return res.status(404).json({ message: "Plan not found" });
      }
      let priceAmount;
      let stripeCurrency;
      switch (currency) {
        case "USD":
          priceAmount = plan.priceUSD;
          stripeCurrency = "usd";
          break;
        case "EUR":
          priceAmount = plan.priceEUR;
          stripeCurrency = "eur";
          break;
        default:
          priceAmount = plan.priceGBP;
          stripeCurrency = "gbp";
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id
          }
        });
        customerId = customer.id;
        await storage.updateUser(userId, { stripeCustomerId: customerId });
      }
      const session2 = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: stripeCurrency,
              product_data: {
                name: `${plan.name} Plan`,
                description: `${plan.monthlyCredits} messages per month`
              },
              recurring: {
                interval: "month"
              },
              unit_amount: priceAmount
              // Already in cents/pence from database
            },
            quantity: 1
          }
        ],
        success_url: `${req.headers.origin}/billing?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/billing`,
        metadata: {
          userId,
          planId,
          currency
        }
      });
      await storage.updateUser(userId, { currency });
      res.json({ url: session2.url });
    } catch (error) {
      console.error("Checkout session error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/stripe/process-session", requireAuth, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }
      const session2 = await stripe.checkout.sessions.retrieve(sessionId);
      if (session2.status !== "complete") {
        return res.status(400).json({ message: "Checkout session is not complete" });
      }
      const userId = session2.metadata?.userId;
      if (!userId || userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      const organizationId = req.user.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      let creditsGranted = 0;
      let purchaseType = "";
      if (session2.mode === "subscription" && session2.subscription) {
        purchaseType = "subscription";
        const subscriptionId = session2.subscription;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const planId = session2.metadata?.planId;
        if (!planId) {
          return res.status(400).json({ message: "No planId in session metadata" });
        }
        const plan = await storage.getSubscriptionPlan(planId);
        if (!plan) {
          return res.status(404).json({ message: `Plan ${planId} not found` });
        }
        const currency = session2.metadata?.currency || "GBP";
        const subData = subscription;
        const subscriptionData = {
          planId,
          currency,
          stripeSubscriptionId: subscriptionId,
          status: subscription.status
        };
        if (subData.current_period_start && typeof subData.current_period_start === "number") {
          subscriptionData.currentPeriodStart = new Date(subData.current_period_start * 1e3);
        }
        if (subData.current_period_end && typeof subData.current_period_end === "number") {
          subscriptionData.currentPeriodEnd = new Date(subData.current_period_end * 1e3);
        }
        let existingSubscription = organizationId && await storage.getSubscription(organizationId) || await storage.getSubscription(userId);
        if (existingSubscription) {
          await storage.updateSubscription(existingSubscription.userId ?? userId, subscriptionData);
        } else {
          await storage.createSubscription(userId, subscriptionData);
          existingSubscription = organizationId && await storage.getSubscription(organizationId) || await storage.getSubscription(userId);
        }
        await storage.updateUser(userId, { subscriptionId });
        let expiryDate;
        if (subData.current_period_end && typeof subData.current_period_end === "number") {
          expiryDate = new Date(subData.current_period_end * 1e3);
        } else {
          expiryDate = /* @__PURE__ */ new Date();
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        }
        await creditService3.grantCredits(
          userId,
          "subscription",
          plan.monthlyCredits,
          planId,
          expiryDate
        );
        creditsGranted = plan.monthlyCredits;
        console.log(`Granted ${creditsGranted} credits to user ${userId} for subscription ${planId}`);
        const user = await storage.getUser(userId);
        if (user?.resellerId) {
          const reseller = await storage.getReseller(user.resellerId);
          if (reseller && reseller.status === "active") {
            const existingTransactions = await storage.getResellerTransactions(reseller.id);
            const alreadyRecorded = existingTransactions.some(
              (t) => t.stripeCheckoutId === session2.id
            );
            if (!alreadyRecorded) {
              const resellerCurrency = session2.metadata?.currency || user.currency || "GBP";
              let revenueAmount = 0;
              if (resellerCurrency === "GBP") {
                revenueAmount = plan.priceGBP;
              } else if (resellerCurrency === "USD") {
                revenueAmount = plan.priceUSD;
              } else if (resellerCurrency === "EUR") {
                revenueAmount = plan.priceEUR;
              }
              const commissionAmount = Math.round(
                revenueAmount * (reseller.commissionRate / 100)
              );
              await storage.createResellerTransaction({
                resellerId: reseller.id,
                userId,
                type: "subscription_purchase",
                amount: revenueAmount,
                currency: resellerCurrency,
                commissionAmount,
                occurredAt: /* @__PURE__ */ new Date(),
                stripeCheckoutId: session2.id
              });
            }
          }
        }
      } else if (session2.mode === "payment") {
        purchaseType = "bundle";
        const bundleId = session2.metadata?.bundleId;
        console.log("Processing bundle purchase:", { bundleId, metadata: session2.metadata });
        if (!bundleId) {
          console.error("No bundleId in session metadata:", session2.metadata);
          return res.status(400).json({ message: "No bundleId in session metadata" });
        }
        const bundle = await storage.getSmsBundle(bundleId);
        if (!bundle) {
          console.error(`Bundle ${bundleId} not found in database`);
          return res.status(404).json({ message: `Bundle ${bundleId} not found` });
        }
        console.log(`Found bundle: ${bundle.name}, credits: ${bundle.credits}`);
        const expiryDate = /* @__PURE__ */ new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 10);
        await creditService3.grantCredits(
          userId,
          "bundle",
          bundle.credits,
          bundleId,
          expiryDate
        );
        creditsGranted = bundle.credits;
        console.log(`Granted ${creditsGranted} credits to user ${userId} for bundle ${bundleId}`);
        const user = await storage.getUser(userId);
        if (user?.resellerId) {
          const reseller = await storage.getReseller(user.resellerId);
          if (reseller && reseller.status === "active") {
            const existingTransactions = await storage.getResellerTransactions(reseller.id);
            const alreadyRecorded = existingTransactions.some(
              (t) => t.stripeCheckoutId === session2.id
            );
            if (!alreadyRecorded) {
              const currency = session2.metadata?.currency || user.currency || "GBP";
              let revenueAmount = 0;
              if (currency === "GBP") {
                revenueAmount = bundle.priceGBP;
              } else if (currency === "USD") {
                revenueAmount = bundle.priceUSD;
              } else if (currency === "EUR") {
                revenueAmount = bundle.priceEUR;
              }
              const commissionAmount = Math.round(
                revenueAmount * (reseller.commissionRate / 100)
              );
              await storage.createResellerTransaction({
                resellerId: reseller.id,
                userId,
                type: "bundle_purchase",
                amount: revenueAmount,
                currency,
                commissionAmount,
                occurredAt: /* @__PURE__ */ new Date(),
                stripeCheckoutId: session2.id
              });
            }
          }
        }
      } else {
        console.error("Unknown session mode:", session2.mode, "Session:", JSON.stringify(session2, null, 2));
        return res.status(400).json({
          message: `Unsupported checkout session mode: ${session2.mode}. Expected 'subscription' or 'payment'.`
        });
      }
      const successMessage = purchaseType === "bundle" ? "SMS bundle purchased successfully" : "Subscription activated successfully";
      res.json({
        success: true,
        creditsGranted,
        purchaseType,
        message: successMessage
      });
    } catch (error) {
      console.error("Process session error:", error);
      res.status(500).json({ message: error.message || "Failed to process session" });
    }
  });
  app2.post("/api/stripe/create-portal-session", requireAuth, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user || !user.stripeCustomerId) {
        return res.status(404).json({ message: "No Stripe customer found. Please subscribe to a plan first." });
      }
      const subscription = req.user.organizationId ? await storage.getSubscription(req.user.organizationId) : await storage.getSubscription(userId);
      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(404).json({ message: "No active subscription found." });
      }
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${req.headers.origin}/billing`
      });
      res.json({ url: portalSession.url });
    } catch (error) {
      console.error("Create portal session error:", error);
      res.status(500).json({ message: error.message || "Failed to create portal session" });
    }
  });
  app2.post("/api/subscription/cancel", requireAuth, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }
      const userId = req.user.id;
      const subscription = req.user.organizationId ? await storage.getSubscription(req.user.organizationId) : await storage.getSubscription(userId);
      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(404).json({ message: "No active subscription found" });
      }
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
      await storage.updateSubscription(userId, {
        status: "canceled"
      });
      res.json({
        success: true,
        message: "Subscription will be canceled at the end of the current billing period",
        cancelAtPeriodEnd: true
      });
    } catch (error) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({ message: error.message || "Failed to cancel subscription" });
    }
  });
  app2.post("/api/subscription/cancel-with-reason", requireAuth, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }
      const userId = req.user.id;
      const organizationId = req.user.organizationId;
      const { reason, comments } = req.body;
      if (!reason) {
        return res.status(400).json({ message: "Cancellation reason is required" });
      }
      if (!organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const user = await storage.getUser(userId);
      const organization = await storage.getOrganization(organizationId);
      const subscription = await storage.getSubscription(organizationId);
      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(404).json({ message: "No active subscription found" });
      }
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
      await storage.updateSubscription(userId, {
        status: "canceled"
      });
      const feedbackMessage = `Subscription Cancellation - Reason: ${reason}`;
      const fullFeedbackMessage = comments ? `${feedbackMessage}
Additional Comments: ${comments}` : feedbackMessage;
      await storage.createFeedback(organizationId, userId, {
        message: fullFeedbackMessage,
        userId
      });
      try {
        const settings = await storage.getPlatformSettings();
        if (user) {
          await sendFeedbackNotificationEmail(settings.feedbackEmail, {
            message: fullFeedbackMessage,
            user: {
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              username: user.username
            },
            organizationName: organization?.name ?? null
          });
        }
      } catch (notifyError) {
        console.error("Cancellation feedback notification error:", notifyError);
      }
      try {
        if (user) {
          await sendCancellationNotification(user, reason);
        }
      } catch (emailError) {
        console.error("Failed to send cancellation notification email:", emailError);
      }
      res.json({
        success: true,
        message: "Subscription will be canceled at the end of the current billing period. Thank you for your feedback.",
        cancelAtPeriodEnd: true
      });
    } catch (error) {
      console.error("Cancel subscription with reason error:", error);
      res.status(500).json({ message: error.message || "Failed to cancel subscription" });
    }
  });
  app2.get("/api/credit-grants", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const grants = await storage.getCreditGrants(userId);
      res.json(grants);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/credit-transactions", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const transactions = await storage.getCreditTransactions(userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  async function requireAdmin(req, res, next) {
    try {
      const adminId = req.session?.adminId;
      if (!adminId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const admin2 = await storage.getAdminUser(adminId);
      if (!admin2) {
        delete req.session.adminId;
        return res.status(401).json({ message: "Not authenticated" });
      }
      req.admin = admin2;
      next();
    } catch (error) {
      console.error("Admin middleware error:", error);
      res.status(500).json({ message: "Authentication error" });
    }
  }
  app2.get("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getPlatformSettings();
      res.json(settings);
    } catch (error) {
      console.error("Get platform settings error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const updates = platformSettingsUpdateSchema.parse(req.body);
      const normalizedUpdates = Object.fromEntries(
        Object.entries(updates).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
      );
      if (Object.keys(normalizedUpdates).length === 0) {
        const current = await storage.getPlatformSettings();
        return res.json(current);
      }
      const settings = await storage.updatePlatformSettings(normalizedUpdates);
      res.json(settings);
    } catch (error) {
      console.error("Update platform settings error:", error);
      if (error instanceof z4.ZodError) {
        return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(", ") });
      }
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/feedback", requireAuth, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const parsed = insertFeedbackSchema.parse(req.body);
      const feedback2 = await storage.createFeedback(
        req.user.organizationId,
        req.user.id,
        {
          ...parsed,
          userId: req.user.id
        }
      );
      try {
        const [settings, organization] = await Promise.all([
          storage.getPlatformSettings(),
          req.user.organizationId ? storage.getOrganization(req.user.organizationId) : Promise.resolve(void 0)
        ]);
        await sendFeedbackNotificationEmail(settings.feedbackEmail, {
          message: parsed.message,
          user: {
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            username: req.user.username
          },
          organizationName: organization?.name ?? null
        });
      } catch (notifyError) {
        console.error("Feedback notification error:", notifyError);
      }
      res.json(feedback2);
    } catch (error) {
      console.error("Create feedback error:", error);
      res.status(400).json({ message: error.message });
    }
  });
  app2.get("/api/admin/feedback", requireAdmin, async (req, res) => {
    try {
      const allFeedback = await storage.getAllFeedback();
      const feedbackWithUsers = await Promise.all(
        allFeedback.map(async (fb) => {
          const user = await storage.getUser(fb.userId);
          return {
            ...fb,
            user: user ? {
              id: user.id,
              username: user.username,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName
            } : null
          };
        })
      );
      res.json(feedbackWithUsers);
    } catch (error) {
      console.error("Get all feedback error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/admin/feedback/:id/status", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status || !["new", "reviewed", "implemented"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'new', 'reviewed', or 'implemented'" });
      }
      const updatedFeedback = await storage.updateFeedbackStatus(id, status);
      res.json(updatedFeedback);
    } catch (error) {
      console.error("Update feedback status error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allSubscriptions = await storage.getAllSubscriptions();
      const subscriptionByOrg = /* @__PURE__ */ new Map();
      for (const subscription of allSubscriptions) {
        if (subscription.organizationId && !subscriptionByOrg.has(subscription.organizationId)) {
          subscriptionByOrg.set(subscription.organizationId, subscription);
        }
      }
      const usersWithDetails = await Promise.all(
        allUsers.map(async (user) => {
          const [totalCredits, creditTransactions2] = await Promise.all([
            storage.getTotalCredits(user.id),
            storage.getCreditTransactions(user.id)
          ]);
          const subscription = user.organizationId ? subscriptionByOrg.get(user.organizationId) : void 0;
          const smsVolume = creditTransactions2.filter((t) => t.delta < 0 && t.messageId).reduce((sum, t) => sum + Math.abs(t.delta), 0);
          let planName = "Trial";
          let monthlyPayment = 0;
          if (subscription?.planId) {
            const plan = await storage.getSubscriptionPlan(subscription.planId);
            planName = plan?.name || "Unknown";
            if (plan) {
              const currency = subscription.currency || user.currency || "GBP";
              if (currency === "GBP") {
                monthlyPayment = plan.priceGBP / 100;
              } else if (currency === "USD") {
                monthlyPayment = plan.priceUSD / 100;
              } else if (currency === "EUR") {
                monthlyPayment = plan.priceEUR / 100;
              }
            }
          }
          return {
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin,
            isActive: user.isActive,
            currency: user.currency || "GBP",
            credits: totalCredits,
            smsVolume,
            referralCode: user.referralCode || null,
            createdAt: user.createdAt || null,
            subscription: {
              planId: subscription?.planId || null,
              planName,
              status: subscription?.status || "trial",
              currency: subscription?.currency || user.currency || "GBP",
              currentPeriodEnd: subscription?.currentPeriodEnd || null,
              trialEndsAt: subscription?.trialEndsAt || null,
              monthlyPayment
            }
          };
        })
      );
      res.json(usersWithDetails);
    } catch (error) {
      console.error("Admin users list error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/users/:userId/subscription", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { planId } = req.body;
      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }
      const now = /* @__PURE__ */ new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1e3);
      await storage.updateSubscription(userId, {
        planId,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd
      });
      res.json({ success: true, message: `Subscription updated to ${plan.name}` });
    } catch (error) {
      console.error("Admin update subscription error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/users/:userId/credits", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { amount, reason, expiresAt } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }
      const expiry = expiresAt ? new Date(expiresAt) : null;
      const targetUser = await storage.getUser(userId);
      if (!targetUser?.organizationId) {
        return res.status(400).json({ message: "Target user not associated with an organization" });
      }
      await creditService3.grantCredits(
        userId,
        "subscription",
        // sourceType - admin grants are like subscription grants
        amount,
        // creditsGranted
        reason || "Admin grant",
        // sourceRef
        expiry
        // expiresAt
      );
      const totalCredits = await storage.getTotalCredits(userId);
      res.json({
        success: true,
        message: `Granted ${amount} credits`,
        totalCredits
      });
    } catch (error) {
      console.error("Admin grant credits error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/users/:userId/reset-password", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const hashedPassword = await bcrypt3.hash(newPassword, 10);
      await storage.updateUser(userId, { password: hashedPassword });
      res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      console.error("Admin reset password error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/users/:userId/disable", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.disableUser(userId);
      res.json({ success: true, message: "User disabled successfully", user });
    } catch (error) {
      console.error("Admin disable user error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/users/:userId/enable", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.enableUser(userId);
      res.json({ success: true, message: "User enabled successfully", user });
    } catch (error) {
      console.error("Admin enable user error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/admin-users", requireAdmin, async (req, res) => {
    try {
      const adminUsers2 = await storage.getAllAdminUsers();
      const safeAdminUsers = adminUsers2.map(({ password, ...adminUser }) => adminUser);
      res.json(safeAdminUsers);
    } catch (error) {
      console.error("Get admin users error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/admin-users", requireAdmin, async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const existingAdmin = await storage.getAdminUserByEmail(email);
      if (existingAdmin) {
        return res.status(400).json({ message: "Admin user with this email already exists" });
      }
      const hashedPassword = await bcrypt3.hash(password, 10);
      const adminUser = await storage.createAdminUser({
        name,
        email,
        password: hashedPassword
      });
      const { password: _, ...safeAdminUser } = adminUser;
      res.json({ success: true, adminUser: safeAdminUser });
    } catch (error) {
      console.error("Create admin user error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/admin/admin-users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAdminUser(id);
      res.json({ success: true, message: "Admin user deleted successfully" });
    } catch (error) {
      console.error("Delete admin user error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/subscription-plans", requireAdmin, async (req, res) => {
    try {
      const plans = await storage.getSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error("Admin get subscription plans error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/admin/subscription-plans/:planId/pricing", requireAdmin, async (req, res) => {
    try {
      const { planId } = req.params;
      const { priceGBP, priceUSD, priceEUR } = req.body;
      if (!priceGBP || !priceUSD || !priceEUR) {
        return res.status(400).json({ message: "All currency prices are required" });
      }
      if (priceGBP <= 0 || priceUSD <= 0 || priceEUR <= 0) {
        return res.status(400).json({ message: "Prices must be positive" });
      }
      const updatedPlan = await storage.updateSubscriptionPlanPricing(planId, {
        priceGBP,
        priceUSD,
        priceEUR
      });
      res.json(updatedPlan);
    } catch (error) {
      console.error("Admin update plan pricing error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/sms-bundles", requireAdmin, async (req, res) => {
    try {
      const bundles = await storage.getSmsBundles();
      res.json(bundles);
    } catch (error) {
      console.error("Admin get SMS bundles error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/admin/sms-bundles/:bundleId/pricing", requireAdmin, async (req, res) => {
    try {
      const { bundleId } = req.params;
      const { priceGBP, priceUSD, priceEUR } = req.body;
      if (!priceGBP || !priceUSD || !priceEUR) {
        return res.status(400).json({ message: "All currency prices are required" });
      }
      if (priceGBP <= 0 || priceUSD <= 0 || priceEUR <= 0) {
        return res.status(400).json({ message: "Prices must be positive" });
      }
      const updatedBundle = await storage.updateSmsBundlePricing(bundleId, {
        priceGBP,
        priceUSD,
        priceEUR
      });
      res.json(updatedBundle);
    } catch (error) {
      console.error("Admin update bundle pricing error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/resellers", requireAdmin, async (req, res) => {
    try {
      const resellers2 = await storage.getAllResellers();
      const resellersWithStats = await Promise.all(
        resellers2.map(async (reseller) => {
          const transactions = await storage.getResellerTransactions(reseller.id);
          const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
          const totalCommission = transactions.reduce((sum, t) => sum + t.commissionAmount, 0);
          const allUsers = await storage.getAllUsers();
          const referredUsers = allUsers.filter((u) => u.resellerId === reseller.id);
          return {
            ...reseller,
            referredUsersCount: referredUsers.length,
            totalRevenue,
            totalCommission,
            transactionCount: transactions.length
          };
        })
      );
      res.json(resellersWithStats);
    } catch (error) {
      console.error("Admin get resellers error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/resellers", requireAdmin, async (req, res) => {
    try {
      const { name, email, commissionRate } = req.body;
      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      if (commissionRate !== void 0 && (commissionRate < 0 || commissionRate > 100)) {
        return res.status(400).json({ message: "Commission rate must be between 0 and 100" });
      }
      const referralCode = `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Math.random().toString(36).substring(2, 8)}`;
      const reseller = await storage.createReseller({
        name,
        email,
        commissionRate: commissionRate || 20,
        referralCode,
        status: "active"
      });
      res.json(reseller);
    } catch (error) {
      console.error("Admin create reseller error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/admin/resellers/:resellerId", requireAdmin, async (req, res) => {
    try {
      const { resellerId } = req.params;
      const { name, email, commissionRate, status } = req.body;
      const updates = {};
      if (name !== void 0) updates.name = name;
      if (email !== void 0) updates.email = email;
      if (status !== void 0) updates.status = status;
      if (commissionRate !== void 0) {
        if (commissionRate < 0 || commissionRate > 100) {
          return res.status(400).json({ message: "Commission rate must be between 0 and 100" });
        }
        updates.commissionRate = commissionRate;
      }
      const updatedReseller = await storage.updateReseller(resellerId, updates);
      res.json(updatedReseller);
    } catch (error) {
      console.error("Admin update reseller error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/admin/resellers/:resellerId", requireAdmin, async (req, res) => {
    try {
      const { resellerId } = req.params;
      const transactions = await storage.getResellerTransactions(resellerId);
      if (transactions.length > 0) {
        return res.status(400).json({
          message: "Cannot delete reseller with existing transactions. Please disable the reseller instead."
        });
      }
      const payouts = await storage.getResellerPayouts(resellerId);
      if (payouts.length > 0) {
        return res.status(400).json({
          message: "Cannot delete reseller with payout history. Please disable the reseller instead."
        });
      }
      const allUsers = await storage.getAllUsers();
      const referredUsers = allUsers.filter((u) => u.resellerId === resellerId);
      if (referredUsers.length > 0) {
        return res.status(400).json({
          message: `Cannot delete reseller with ${referredUsers.length} referred users. Please disable the reseller instead.`
        });
      }
      await storage.deleteReseller(resellerId);
      res.json({ success: true, message: "Reseller deleted" });
    } catch (error) {
      console.error("Admin delete reseller error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/resellers/:resellerId/report", requireAdmin, async (req, res) => {
    try {
      const { resellerId } = req.params;
      const { month, year } = req.query;
      if (!month || !year) {
        return res.status(400).json({ message: "Month and year are required" });
      }
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      if (monthNum < 1 || monthNum > 12 || yearNum < 2e3 || yearNum > 2100) {
        return res.status(400).json({ message: "Invalid month or year" });
      }
      const reseller = await storage.getReseller(resellerId);
      if (!reseller) {
        return res.status(404).json({ message: "Reseller not found" });
      }
      const transactions = await storage.getResellerTransactionsByMonth(resellerId, monthNum, yearNum);
      const newRevenue = transactions.filter((t) => t.type === "subscription_start").reduce((sum, t) => sum + t.amount, 0);
      const recurringRevenue = transactions.filter((t) => t.type === "subscription_renewal").reduce((sum, t) => sum + t.amount, 0);
      const bundleRevenue = transactions.filter((t) => t.type === "bundle_purchase").reduce((sum, t) => sum + t.amount, 0);
      const totalRevenue = newRevenue + recurringRevenue + bundleRevenue;
      const totalCommission = transactions.reduce((sum, t) => sum + t.commissionAmount, 0);
      let payout = await storage.getResellerPayout(resellerId, monthNum, yearNum);
      if (!payout) {
        payout = await storage.createOrUpdateResellerPayout({
          resellerId,
          month: monthNum,
          year: yearNum,
          newRevenue,
          recurringRevenue,
          totalRevenue,
          commissionAmount: totalCommission,
          currency: "GBP",
          // Default currency
          transactionCount: transactions.length,
          status: "pending",
          lastCalculatedAt: /* @__PURE__ */ new Date()
        });
      } else {
        payout = await storage.createOrUpdateResellerPayout({
          resellerId,
          month: monthNum,
          year: yearNum,
          newRevenue,
          recurringRevenue,
          totalRevenue,
          commissionAmount: totalCommission,
          currency: payout.currency,
          transactionCount: transactions.length,
          status: payout.status,
          lastCalculatedAt: /* @__PURE__ */ new Date()
        });
      }
      res.json({
        reseller: {
          id: reseller.id,
          name: reseller.name,
          email: reseller.email,
          commissionRate: reseller.commissionRate
        },
        period: {
          month: monthNum,
          year: yearNum
        },
        revenue: {
          new: newRevenue,
          recurring: recurringRevenue,
          bundles: bundleRevenue,
          total: totalRevenue
        },
        commission: {
          amount: totalCommission,
          rate: reseller.commissionRate
        },
        transactions: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          currency: t.currency,
          commissionAmount: t.commissionAmount,
          occurredAt: t.occurredAt
        })),
        payout
      });
    } catch (error) {
      console.error("Admin get reseller report error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const admin2 = await storage.getAdminUserByEmail(email);
      if (!admin2) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const validPassword = await bcrypt3.compare(password, admin2.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.adminId = admin2.id;
      res.json({ success: true, admin: sanitizeAdmin(admin2) });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: error.message || "Failed to login" });
    }
  });
  app2.post("/api/admin/auth/logout", async (req, res) => {
    delete req.session.adminId;
    res.json({ success: true });
  });
  app2.get("/api/admin/auth/me", async (req, res) => {
    try {
      const adminId = req.session.adminId;
      if (!adminId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const admin2 = await storage.getAdminUser(adminId);
      if (!admin2) {
        delete req.session.adminId;
        return res.status(401).json({ message: "Not authenticated" });
      }
      res.json({ admin: sanitizeAdmin(admin2) });
    } catch (error) {
      console.error("Admin auth me error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/auth/change-password", requireAdmin, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }
      const admin2 = req.admin;
      const valid = await bcrypt3.compare(currentPassword, admin2.password);
      if (!valid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      const hashedPassword = await bcrypt3.hash(newPassword, 10);
      const updatedAdmin = await storage.updateAdminUser(admin2.id, { password: hashedPassword });
      res.json({ success: true, admin: sanitizeAdmin(updatedAdmin) });
    } catch (error) {
      console.error("Admin change password error:", error);
      res.status(500).json({ message: error.message || "Failed to change password" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}
async function sendAcknowledgementSMS(organizationId, contact, job, parsed, userId) {
  try {
    let twilioClient = null;
    let fromNumber = "";
    try {
      twilioClient = await getTwilioClient();
      fromNumber = await getTwilioFromPhoneNumber();
    } catch (error) {
      console.log("Twilio not configured, acknowledgement will be logged only");
      return;
    }
    let message = "";
    const jobDate = new Date(job.startTime).toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    const jobTime = new Date(job.startTime).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit"
    });
    if (parsed.status === "confirmed") {
      if (parsed.shiftPreference) {
        message = `Thanks ${contact.firstName}! You're confirmed for ${job.name} (${parsed.shiftPreference}) on ${jobDate} at ${jobTime}. Location: ${job.location}. See you there!`;
      } else {
        message = `Thanks ${contact.firstName}! You're confirmed for ${job.name} on ${jobDate} at ${jobTime}. Location: ${job.location}. See you there!`;
      }
    } else if (parsed.status === "declined") {
      message = `Thanks for letting us know, ${contact.firstName}. We've noted you're unavailable for ${job.name} on ${jobDate}. We'll contact you about future opportunities.`;
    } else if (parsed.status === "maybe") {
      message = `Thanks ${contact.firstName}. We've noted your tentative availability for ${job.name} on ${jobDate}. We'll confirm closer to the date.`;
    }
    if (!message) {
      return;
    }
    try {
      const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
      const twilioMessage = await twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: e164Phone
      });
      await storage.createMessage(organizationId, userId, {
        contactId: contact.id,
        jobId: job.id,
        campaignId: null,
        direction: "outbound",
        content: message,
        status: "sent",
        twilioSid: twilioMessage.sid
      });
      await creditService3.consumeCreditsForOrganization(
        organizationId,
        1,
        `Acknowledgement SMS for job ${job.id}`,
        null
      );
      console.log(`Sent acknowledgement SMS to ${contact.firstName} ${contact.lastName} for ${job.name}`);
    } catch (error) {
      console.error("Failed to send acknowledgement SMS:", error);
    }
  } catch (error) {
    console.error("Acknowledgement SMS error:", error);
  }
}

// server/vite.ts
import express2 from "express";
import fs from "fs";
import path3 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";
var vite_config_default = defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const plugins = [
    react(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["attached_assets/pwa/favicon.ico", "attached_assets/pwa/apple-touch-icon.png", "attached_assets/pwa/mask-icon.svg"],
      manifest: {
        name: "HeyTeam - Workforce Coordination",
        short_name: "HeyTeam",
        description: "Lightweight workforce coordination app for managers to message crew, collect availability responses, and manage job schedules",
        theme_color: "#0EA5E9",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/attached_assets/pwa/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/attached_assets/pwa/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ],
        shortcuts: [
          {
            name: "Jobs",
            short_name: "Jobs",
            description: "View and manage jobs",
            url: "/jobs",
            icons: [{ src: "/attached_assets/pwa/pwa-192x192.png", sizes: "192x192" }]
          },
          {
            name: "Contacts",
            short_name: "Contacts",
            description: "Manage contacts",
            url: "/contacts",
            icons: [{ src: "/attached_assets/pwa/pwa-192x192.png", sizes: "192x192" }]
          },
          {
            name: "Send Message",
            short_name: "Send",
            description: "Send messages to contacts",
            url: "/jobs/new/send",
            icons: [{ src: "/attached_assets/pwa/pwa-192x192.png", sizes: "192x192" }]
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,jpg,jpeg,gif}"],
        // Cache attached_assets directory
        additionalManifestEntries: [
          { url: "/attached_assets/pwa/pwa-192x192.png", revision: null },
          { url: "/attached_assets/pwa/pwa-512x512.png", revision: null }
        ],
        runtimeCaching: [
          {
            urlPattern: /^\/attached_assets\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "attached-assets-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
                // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
                // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
                // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5
                // 5 minutes
              },
              networkTimeoutSeconds: 10
            }
          }
        ]
      },
      devOptions: {
        enabled: false
        // Disable in development to avoid issues
      }
    })
  ];
  if (mode !== "production" && env.REPL_ID) {
    const cartographerPlugin = await import("@replit/vite-plugin-cartographer").then((m) => m.cartographer());
    const devBannerPlugin = await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner());
    plugins.push(cartographerPlugin, devBannerPlugin);
  }
  return {
    plugins,
    resolve: {
      alias: {
        "@": path2.resolve(import.meta.dirname, "client", "src"),
        "@shared": path2.resolve(import.meta.dirname, "shared"),
        "@assets": path2.resolve(import.meta.dirname, "attached_assets")
      }
    },
    define: {
      "import.meta.env.VITE_GOOGLE_API_KEY": JSON.stringify(
        env.VITE_GOOGLE_API_KEY || env.GOOGLE_API_KEY || "AIzaSyDIqb3FH1I2KcF-4AcAjvzwVHlzes-JhvQ"
      )
    },
    root: path2.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path2.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"]
      }
    }
  };
});

// server/vite.ts
import { nanoid as nanoid2 } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid2()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path3.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var MemoryStore = createMemoryStore(session);
var app = express3();
app.use(cors({
  origin: true,
  // Allow any origin
  credentials: true,
  // Allow cookies/sessions
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Contact-ID",
    "X-User-ID",
    "Accept",
    "Origin"
  ],
  exposedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Contact-ID",
    "X-User-ID"
  ]
}));
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 864e5
      // 24 hours
    }),
    cookie: {
      secure: false,
      // Allow cookies to work over HTTP
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1e3,
      // 7 days
      sameSite: "lax"
      // Allow cookies to be sent in cross-site requests
    }
  })
);
app.use((req, res, next) => {
  const start = Date.now();
  const path4 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path4.startsWith("/api")) {
      let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, () => {
    log(`serving on port ${port}`);
  });
})();
