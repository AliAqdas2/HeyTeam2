import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const resellers = pgTable("resellers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  commissionRate: integer("commission_rate").notNull().default(20), // Commission percentage (e.g., 20 = 20%)
  referralCode: text("referral_code").notNull().unique(), // Unique code for signup URL
  status: text("status").notNull().default("active"), // "active", "suspended"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(), // Now used for company name
  firstName: text("first_name"), // Team member first name
  lastName: text("last_name"), // Team member last name
  password: text("password").notNull(),
  email: text("email").notNull(),
  countryCode: text("country_code").default("US"), // Country code for mobile number
  mobileNumber: text("mobile_number"), // Mobile number without country code
  emailVerified: boolean("email_verified").notNull().default(false),
  mobileVerified: boolean("mobile_verified").notNull().default(false),
  currency: text("currency").notNull().default("GBP"), // User's preferred currency: GBP, USD, EUR
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  teamRole: text("team_role").notNull().default("member"), // "owner", "admin", "member"
  isAdmin: boolean("is_admin").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true), // For soft delete
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  resellerId: varchar("reseller_id").references(() => resellers.id, { onDelete: 'set null' }), // Which reseller referred this user
  referralCode: text("referral_code"), // Optional referral code that brought this user (deprecated - use resellerId)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Keep for audit trail and created_by
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
  status: text("status").notNull().default("free"), // "free", "on_job", "off_shift"
  rosterToken: varchar("roster_token").unique(), // Unique token for viewing roster
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Keep for audit trail and created_by
  name: text("name").notNull(),
  location: text("location").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  requiredHeadcount: integer("required_headcount"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const jobSkillRequirements = pgTable("job_skill_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  skill: text("skill").notNull(),
  headcount: integer("headcount").notNull().default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Keep for audit trail and created_by
  name: text("name").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("standard"),
  includeRosterLink: boolean("include_roster_link").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Keep for audit trail and created_by
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  templateId: varchar("template_id").notNull().references(() => templates.id),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Keep for audit trail and created_by
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }),
  direction: text("direction").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("queued"),
  twilioSid: text("twilio_sid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const availability = pgTable("availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default("no_reply"),
  shiftPreference: text("shift_preference"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  targetAudience: text("target_audience").notNull().default(""),
  featureBullets: text("feature_bullets").notNull().default(""),
  useCase: text("use_case").notNull().default(""),
  monthlyCredits: integer("monthly_credits").notNull(), // SMS messages included
  supportLevel: text("support_level").notNull().default("email"), // email, priority, dedicated
  customTemplates: boolean("custom_templates").notNull().default(false),
  autoFollowUp: boolean("auto_follow_up").notNull().default(false),
  multiManager: boolean("multi_manager").notNull().default(false),
  aiFeatures: boolean("ai_features").notNull().default(false),
  dedicatedNumber: boolean("dedicated_number").notNull().default(false),
  priceGBP: integer("price_gbp").notNull(), // Price in pence
  priceUSD: integer("price_usd").notNull(), // Price in cents
  priceEUR: integer("price_eur").notNull(), // Price in cents
  stripePriceIdGBP: text("stripe_price_id_gbp"),
  stripePriceIdUSD: text("stripe_price_id_usd"),
  stripePriceIdEUR: text("stripe_price_id_eur"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const smsBundles = pgTable("sms_bundles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").references(() => subscriptionPlans.id, { onDelete: 'cascade' }), // Link to subscription plan
  name: text("name").notNull(),
  description: text("description"),
  credits: integer("credits").notNull(),
  priceGBP: integer("price_gbp").notNull(), // Price in pence
  priceUSD: integer("price_usd").notNull(), // Price in cents
  priceEUR: integer("price_eur").notNull(), // Price in cents
  stripePriceIdGBP: text("stripe_price_id_gbp"),
  stripePriceIdUSD: text("stripe_price_id_usd"),
  stripePriceIdEUR: text("stripe_price_id_eur"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const creditGrants = pgTable("credit_grants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Keep for audit trail
  sourceType: text("source_type").notNull(),
  sourceRef: text("source_ref"),
  creditsGranted: integer("credits_granted").notNull(),
  creditsConsumed: integer("credits_consumed").notNull().default(0),
  creditsRemaining: integer("credits_remaining").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Keep for audit trail
  grantId: varchar("grant_id").notNull().references(() => creditGrants.id, { onDelete: 'cascade' }),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: 'set null' }),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Keep for audit trail and billing contact
  planId: varchar("plan_id").references(() => subscriptionPlans.id),
  status: text("status").notNull().default("trial"),
  currency: text("currency").notNull().default("GBP"), // GBP, USD, EUR
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const resellerTransactions = pgTable("reseller_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resellerId: varchar("reseller_id").notNull().references(() => resellers.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeEventId: text("stripe_event_id").unique(), // Stripe event ID for idempotency
  stripeInvoiceId: text("stripe_invoice_id"), // For tracking specific Stripe invoices
  stripeCheckoutId: text("stripe_checkout_id"), // For initial purchases
  type: text("type").notNull(), // "subscription_start", "subscription_renewal", "bundle_purchase"
  amount: integer("amount").notNull(), // Amount in smallest currency unit (cents/pence)
  currency: text("currency").notNull(), // GBP, USD, EUR
  commissionAmount: integer("commission_amount").notNull(), // Commission earned in smallest currency unit
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const resellerPayouts = pgTable("reseller_payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resellerId: varchar("reseller_id").notNull().references(() => resellers.id, { onDelete: 'cascade' }),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(), // e.g., 2025
  newRevenue: integer("new_revenue").notNull().default(0), // From new signups
  recurringRevenue: integer("recurring_revenue").notNull().default(0), // From renewals
  totalRevenue: integer("total_revenue").notNull().default(0), // Total revenue
  commissionAmount: integer("commission_amount").notNull().default(0), // Total commission owed
  currency: text("currency").notNull().default("GBP"), // Primary currency for report
  transactionCount: integer("transaction_count").notNull().default(0), // Number of transactions
  status: text("status").notNull().default("pending"), // "pending", "paid"
  lastCalculatedAt: timestamp("last_calculated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const feedback = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Keep for audit trail
  message: text("message").notNull(),
  status: text("status").notNull().default("new"), // "new", "reviewed", "implemented"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const platformSettings = pgTable("platform_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  feedbackEmail: text("feedback_email").notNull().default('Feedback@HeyTeam.ai'),
  supportEmail: text("support_email").notNull().default('support@heyteam.ai'),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true, // Company name
  password: true,
  email: true,
  countryCode: true,
  mobileNumber: true,
  firstName: true,
  lastName: true,
  resellerId: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  userId: true,
  organizationId: true, // Will be set automatically from user's organization
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(["free", "on_job", "off_shift"]).default("free"),
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  userId: true,
  organizationId: true, // Will be set automatically from user's organization
  createdAt: true,
  updatedAt: true,
});

export const insertJobSkillRequirementSchema = createInsertSchema(jobSkillRequirements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobSkillRequirementForJobSchema = insertJobSkillRequirementSchema.omit({
  jobId: true,
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  userId: true,
  organizationId: true, // Will be set automatically from user's organization
  createdAt: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  userId: true,
  organizationId: true, // Will be set automatically from user's organization
  sentAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  userId: true,
  organizationId: true, // Will be set automatically from user's organization
  createdAt: true,
  updatedAt: true,
});

export const insertAvailabilitySchema = createInsertSchema(availability).omit({
  id: true,
  updatedAt: true,
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
});

export const insertSmsBundleSchema = createInsertSchema(smsBundles).omit({
  id: true,
  createdAt: true,
});

export const insertCreditGrantSchema = createInsertSchema(creditGrants).omit({
  id: true,
  createdAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  userId: true,
  organizationId: true, // Will be set automatically from user's organization
  createdAt: true,
  updatedAt: true,
});

export const insertPlatformSettingsSchema = createInsertSchema(platformSettings).omit({
  id: true,
  updatedAt: true,
}).extend({
  feedbackEmail: z.string().email(),
  supportEmail: z.string().email(),
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export type InsertJobSkillRequirement = z.infer<typeof insertJobSkillRequirementSchema>;
export type JobSkillRequirement = typeof jobSkillRequirements.$inferSelect;
export type InsertJobSkillRequirementForJob = z.infer<typeof insertJobSkillRequirementForJobSchema>;

export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertAvailability = z.infer<typeof insertAvailabilitySchema>;
export type Availability = typeof availability.$inferSelect;

export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

export type InsertSmsBundle = z.infer<typeof insertSmsBundleSchema>;
export type SmsBundle = typeof smsBundles.$inferSelect;

export type InsertCreditGrant = z.infer<typeof insertCreditGrantSchema>;
export type CreditGrant = typeof creditGrants.$inferSelect;

export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export type InsertPlatformSettings = z.infer<typeof insertPlatformSettingsSchema>;
export type PlatformSettings = typeof platformSettings.$inferSelect;

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
});

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

export const insertResellerSchema = createInsertSchema(resellers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReseller = z.infer<typeof insertResellerSchema>;
export type Reseller = typeof resellers.$inferSelect;

export const insertResellerTransactionSchema = createInsertSchema(resellerTransactions).omit({
  id: true,
  createdAt: true,
});

export type InsertResellerTransaction = z.infer<typeof insertResellerTransactionSchema>;
export type ResellerTransaction = typeof resellerTransactions.$inferSelect;

export const insertResellerPayoutSchema = createInsertSchema(resellerPayouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertResellerPayout = z.infer<typeof insertResellerPayoutSchema>;
export type ResellerPayout = typeof resellerPayouts.$inferSelect;

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  userId: true,
  organizationId: true, // Will be set automatically from user's organization
  createdAt: true,
  status: true,
});

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;
