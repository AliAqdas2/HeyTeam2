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
  referralCode: text("referral_code"), // Optional referral code that brought this user
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  location: text("location").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  requiredHeadcount: integer("required_headcount"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("standard"),
  includeRosterLink: boolean("include_roster_link").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  templateId: varchar("template_id").notNull().references(() => templates.id),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  grantId: varchar("grant_id").notNull().references(() => creditGrants.id, { onDelete: 'cascade' }),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: 'set null' }),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
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
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(["free", "on_job", "off_shift"]).default("free"),
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  userId: true,
  sentAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  userId: true,
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
  createdAt: true,
  updatedAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

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
