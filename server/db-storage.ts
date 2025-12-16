import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, and, desc, sql, inArray, lt } from "drizzle-orm";
import { constructE164Phone, normalizePhoneNumber } from "./lib/phone-utils";
import {
  organizations, users, contacts, jobs, templates, campaigns, messages,
  availability, subscriptions,
  passwordResetTokens, subscriptionPlans, smsBundles, creditGrants, creditTransactions,
  adminUsers, resellers, resellerTransactions, resellerPayouts, feedback, platformSettings,
  jobSkillRequirements, deviceTokens, pushNotificationDeliveries,
  type Organization, type InsertOrganization,
  type User, type InsertUser,
  type Contact, type InsertContact,
  type Job, type InsertJob,
  type Template, type InsertTemplate,
  type Campaign, type InsertCampaign,
  type Message, type InsertMessage,
  type Availability, type InsertAvailability,
  type Subscription, type InsertSubscription,
  type PasswordResetToken, type InsertPasswordResetToken,
  type SubscriptionPlan, type InsertSubscriptionPlan,
  type SmsBundle, type InsertSmsBundle,
  type CreditGrant, type InsertCreditGrant,
  type CreditTransaction, type InsertCreditTransaction,
  type AdminUser, type InsertAdminUser,
  type Reseller, type InsertReseller,
  type ResellerTransaction, type InsertResellerTransaction,
  type ResellerPayout, type InsertResellerPayout,
  type Feedback, type InsertFeedback,
  type PlatformSettings, type InsertPlatformSettings,
  type JobSkillRequirement, type InsertJobSkillRequirement,
  type DeviceToken, type InsertDeviceToken,
  type PushNotificationDelivery, type InsertPushNotificationDelivery,
} from "@shared/schema";
import type { IStorage } from "./storage";

export class DbStorage implements IStorage {
  private db;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.db = drizzle(pool);
  }

  // Organization methods
  async getOrganization(id: string): Promise<Organization | undefined> {
    const result = await this.db.select().from(organizations).where(eq(organizations.id, id));
    return result[0];
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const result = await this.db.insert(organizations).values(org).returning();
    return result[0];
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization> {
    const result = await this.db
      .update(organizations)
      .set(updates)
      .where(eq(organizations.id, id))
      .returning();
    return result[0];
  }

  async getUsersInOrganization(organizationId: string): Promise<User[]> {
    return await this.db.select().from(users).where(eq(users.organizationId, organizationId));
  }

  async updateUserTeamRole(userId: string, teamRole: string): Promise<User> {
    const result = await this.db
      .update(users)
      .set({ teamRole })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  // Admin user methods
  async getAllAdminUsers(): Promise<AdminUser[]> {
    return await this.db.select().from(adminUsers);
  }

  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const result = await this.db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return result[0];
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    const result = await this.db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return result[0];
  }

  async createAdminUser(insertAdminUser: InsertAdminUser): Promise<AdminUser> {
    const result = await this.db.insert(adminUsers).values(insertAdminUser).returning();
    return result[0];
  }

  async updateAdminUser(id: string, updates: Partial<InsertAdminUser>): Promise<AdminUser> {
    const result = await this.db
      .update(adminUsers)
      .set(updates)
      .where(eq(adminUsers.id, id))
      .returning();
    return result[0];
  }

  async deleteAdminUser(id: string): Promise<void> {
    await this.db.delete(adminUsers).where(eq(adminUsers.id, id));
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    let userData: any = insertUser;
    let organizationIdOverride = (insertUser as any).organizationId as string | undefined;

    // If no organizationId provided, create a new organization for the user
    if (!organizationIdOverride) {
      const org = await this.createOrganization({
        name: `${insertUser.username}'s Organization`,
      });

      organizationIdOverride = org.id;
      userData = {
        ...insertUser,
        organizationId: organizationIdOverride,
        teamRole: (insertUser as any).teamRole || "owner",
      };
    }

    // Create user
    const result = await this.db.insert(users).values(userData).returning();
    const user = result[0];
    const organizationId = user.organizationId;

    if (!organizationId) {
      throw new Error("User is not associated with an organization");
    }

    // Create trial subscription (30 days)
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.createSubscription(user.id, {
      planId: null,
      status: "trial",
      trialEndsAt,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      stripeSubscriptionId: undefined,
    });

    // Grant 10 trial credits (expires with trial)
    await this.createCreditGrant(user.id, {
      organizationId,
      userId: user.id,
      sourceType: "trial",
      sourceRef: null,
      creditsGranted: 10,
      creditsConsumed: 0,
      creditsRemaining: 10,
      expiresAt: trialEndsAt,
    });

    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const result = await this.db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async updateUserPassword(userId: string, password: string): Promise<User> {
    const result = await this.db
      .update(users)
      .set({ password })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User> {
    const result = await this.db
      .update(users)
      .set({ stripeCustomerId, stripeSubscriptionId })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async disableUser(userId: string): Promise<User> {
    const result = await this.db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async enableUser(userId: string): Promise<User> {
    const result = await this.db
      .update(users)
      .set({ isActive: true })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async createPasswordResetToken(insertToken: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const result = await this.db.insert(passwordResetTokens).values(insertToken).returning();
    return result[0];
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const result = await this.db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return result[0];
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    await this.db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
  }

  async getContacts(organizationId: string): Promise<Contact[]> {
    return await this.db.select().from(contacts).where(eq(contacts.organizationId, organizationId));
  }

  async getContact(id: string, organizationId: string): Promise<Contact | undefined> {
    const result = await this.db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.organizationId, organizationId)));
    return result[0];
  }

  async getContactById(id: string): Promise<Contact | undefined> {
    const result = await this.db.select().from(contacts).where(eq(contacts.id, id));
    return result[0];
  }

  async getContactByRosterToken(token: string): Promise<Contact | undefined> {
    const result = await this.db.select().from(contacts).where(eq(contacts.rosterToken, token));
    return result[0];
  }

  async getContactByPhone(phone: string, organizationId?: string): Promise<Contact | undefined> {
    // First try exact match (in case phone is stored as full E.164)
    let result = await this.db.select().from(contacts).where((eq(contacts.phone, phone)));
    if (result[0]) {
      return result[0];
    }
    
    // Normalize the incoming phone number (from Twilio, it's already E.164 format)
    const normalizedIncoming = normalizePhoneNumber(phone);
    
    // Get all contacts for this organization and reconstruct their E.164 numbers using the same logic as when sending
    const allContacts = await this.db
    .select()
    .from(contacts)
    .where(organizationId ? eq(contacts.organizationId, organizationId) : undefined);
    
    for (const contact of allContacts) {
      if (!contact.countryCode || !contact.phone) continue;
      
      // Reconstruct E.164 format using the same function used when sending messages
      // This ensures consistency between sending and receiving
      const reconstructedE164 = constructE164Phone(contact.countryCode, contact.phone);
      const normalizedReconstructed = normalizePhoneNumber(reconstructedE164);
      
      // Compare normalized numbers
      if (normalizedIncoming === normalizedReconstructed) {
        return contact;
      }
    }
    
    return undefined;
  }

  async getContactByEmail(email: string, organizationId?: string): Promise<Contact | undefined> {
    const conditions = [
      eq(contacts.email, email),
      eq(contacts.hasLogin, true), // Only return contacts with login enabled
    ];
    
    if (organizationId) {
      conditions.push(eq(contacts.organizationId, organizationId));
    }
    
    const result = await this.db
      .select()
      .from(contacts)
      .where(and(...conditions));
    
    return result[0];
  }

  async createContact(organizationId: string, userId: string, contact: InsertContact): Promise<Contact> {
    const result = await this.db.insert(contacts).values({ ...contact, organizationId, userId }).returning();
    return result[0];
  }

  async updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact> {
    const result = await this.db
      .update(contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return result[0];
  }

  async updateContactPassword(contactId: string, password: string): Promise<Contact> {
    const result = await this.db
      .update(contacts)
      .set({ password, updatedAt: new Date() })
      .where(eq(contacts.id, contactId))
      .returning();
    return result[0];
  }

  async deleteContact(id: string): Promise<void> {
    await this.db.delete(contacts).where(eq(contacts.id, id));
  }

  async getJobs(organizationId: string): Promise<Job[]> {
    return await this.db.select().from(jobs).where(eq(jobs.organizationId, organizationId));
  }


  async getJob(id: string): Promise<Job | undefined> {
    const result = await this.db.select().from(jobs).where(eq(jobs.id, id));
    return result[0];
  }

  async createJob(organizationId: string, userId: string, job: InsertJob): Promise<Job> {
    const result = await this.db.insert(jobs).values({ ...job, organizationId, userId }).returning();
    return result[0];
  }

  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job> {
    const result = await this.db
      .update(jobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();
    return result[0];
  }

  async deleteJob(id: string): Promise<void> {
    await this.db.delete(jobs).where(eq(jobs.id, id));
  }

  async getJobSkillRequirements(jobId: string): Promise<JobSkillRequirement[]> {
    return await this.db
      .select()
      .from(jobSkillRequirements)
      .where(eq(jobSkillRequirements.jobId, jobId));
  }

  async replaceJobSkillRequirements(
    jobId: string,
    requirements: InsertJobSkillRequirement[],
  ): Promise<JobSkillRequirement[]> {
    return await this.db.transaction(async (tx) => {
      await tx.delete(jobSkillRequirements).where(eq(jobSkillRequirements.jobId, jobId));

      if (!requirements.length) {
        return [];
      }

      const now = new Date();
      const data = requirements.map((requirement) => ({
        jobId,
        skill: requirement.skill,
        headcount: requirement.headcount ?? 1,
        notes: requirement.notes ?? null,
        createdAt: now,
        updatedAt: now,
      }));

      const inserted = await tx
        .insert(jobSkillRequirements)
        .values(data)
        .returning();

      return inserted;
    });
  }

  async getTemplates(organizationId: string): Promise<Template[]> {
    return await this.db.select().from(templates).where(eq(templates.organizationId, organizationId));
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const result = await this.db.select().from(templates).where(eq(templates.id, id));
    return result[0];
  }

  async createTemplate(organizationId: string, userId: string, template: InsertTemplate): Promise<Template> {
    const result = await this.db.insert(templates).values({ ...template, organizationId, userId }).returning();
    return result[0];
  }

  async updateTemplate(id: string, updates: Partial<InsertTemplate>): Promise<Template> {
    const result = await this.db
      .update(templates)
      .set(updates)
      .where(eq(templates.id, id))
      .returning();
    return result[0];
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.db.delete(templates).where(eq(templates.id, id));
  }

  async bulkCreateContacts(organizationId: string, userId: string, insertContacts: InsertContact[]): Promise<Contact[]> {
    const contactsWithIds = insertContacts.map(c => ({ ...c, organizationId, userId }));
    const result = await this.db.insert(contacts).values(contactsWithIds).returning();
    return result;
  }

  async createCampaign(organizationId: string, userId: string, campaign: InsertCampaign): Promise<Campaign> {
    const result = await this.db.insert(campaigns).values({ ...campaign, organizationId, userId }).returning();
    return result[0];
  }

  async getCampaignsForJob(jobId: string, organizationId: string): Promise<Campaign[]> {
    return await this.db.select().from(campaigns).where(and(eq(campaigns.jobId, jobId), eq(campaigns.organizationId, organizationId)));
  }

  async getMessages(contactId: string, organizationId: string): Promise<Message[]> {
    return await this.db.select().from(messages).where(and(eq(messages.contactId, contactId), eq(messages.organizationId, organizationId)));
  }

  async getMessagesForJob(jobId: string, organizationId: string): Promise<Message[]> {
    return await this.db.select().from(messages).where(and(eq(messages.jobId, jobId), eq(messages.organizationId, organizationId)));
  }

  async getAllMessagesForUser(organizationId: string): Promise<Message[]> {
    return await this.db.select().from(messages)
      .where(eq(messages.organizationId, organizationId))
      .orderBy(desc(messages.createdAt));
  }

  async createMessage(organizationId: string, userId: string, message: InsertMessage): Promise<Message> {
    const result = await this.db.insert(messages).values({ ...message, organizationId, userId }).returning();
    return result[0];
  }

  async updateMessageStatus(id: string, status: string): Promise<Message> {
    const result = await this.db
      .update(messages)
      .set({ status, updatedAt: new Date() })
      .where(eq(messages.id, id))
      .returning();
    return result[0];
  }

  async getAvailability(jobId: string, organizationId: string): Promise<Availability[]> {
    const result = await this.db
      .select({ availability })
      .from(availability)
      .innerJoin(jobs, eq(availability.jobId, jobs.id))
      .where(and(eq(availability.jobId, jobId), eq(jobs.organizationId, organizationId)));

    return result.map(r => r.availability);
  }

  async getAllAvailability(organizationId: string): Promise<Availability[]> {
    const result = await this.db
      .select({ availability })
      .from(availability)
      .innerJoin(jobs, eq(availability.jobId, jobs.id))
      .where(eq(jobs.organizationId, organizationId));

    return result.map(r => r.availability);
  }

  async getAvailabilityByContact(contactId: string, organizationId: string): Promise<Availability[]> {
    const result = await this.db
      .select({ availability })
      .from(availability)
      .innerJoin(contacts, eq(availability.contactId, contacts.id))
      .where(and(eq(availability.contactId, contactId), eq(contacts.organizationId, organizationId)));

    return result.map(r => r.availability);
  }

  async getAvailabilityForContact(
    jobId: string,
    contactId: string,
    organizationId: string
  ): Promise<Availability | undefined> {
    const result = await this.db
      .select({ availability })
      .from(availability)
      .innerJoin(jobs, eq(availability.jobId, jobs.id))
      .innerJoin(contacts, eq(availability.contactId, contacts.id))
      .where(
        and(
          eq(availability.jobId, jobId),
          eq(availability.contactId, contactId),
          eq(jobs.organizationId, organizationId),
          eq(contacts.organizationId, organizationId)
        )
      )
      .limit(1);

    return result[0]?.availability;
  }

  async getConfirmedContactsForJob(jobId: string, organizationId: string): Promise<Contact[]> {
    const result = await this.db
      .select({ contact: contacts })
      .from(availability)
      .innerJoin(jobs, eq(availability.jobId, jobs.id))
      .innerJoin(contacts, eq(availability.contactId, contacts.id))
      .where(
        and(
          eq(availability.jobId, jobId),
          eq(availability.status, "confirmed"),
          eq(jobs.organizationId, organizationId),
          eq(contacts.organizationId, organizationId)
        )
      );

    return result.map(r => r.contact);
  }

  async getCurrentJobForContact(contactId: string, organizationId: string): Promise<Job | undefined> {
    const result = await this.db
      .select({ job: jobs })
      .from(availability)
      .innerJoin(jobs, eq(availability.jobId, jobs.id))
      .innerJoin(contacts, eq(availability.contactId, contacts.id))
      .where(
        and(
          eq(availability.contactId, contactId),
          eq(availability.status, "confirmed"),
          eq(jobs.organizationId, organizationId),
          eq(contacts.organizationId, organizationId)
        )
      )
      .orderBy(jobs.startTime)
      .limit(1);

    return result[0]?.job;
  }

  async createAvailability(organizationId: string, avail: InsertAvailability): Promise<Availability> {
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

  async updateAvailability(id: string, updates: Partial<InsertAvailability>): Promise<Availability> {
    const result = await this.db
      .update(availability)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(availability.id, id))
      .returning();
    return result[0];
  }

  async getSubscription(organizationId: string): Promise<Subscription | undefined> {
    const result = await this.db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId));
    return result[0];
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return await this.db.select().from(subscriptions);
  }

  async createSubscription(userId: string, subscription: InsertSubscription): Promise<Subscription> {
    const user = await this.getUser(userId);
    if (!user?.organizationId) {
      throw new Error("User not associated with an organization");
    }

    const result = await this.db
      .insert(subscriptions)
      .values({ ...subscription, userId, organizationId: user.organizationId })
      .returning();

    return result[0];
  }

  async updateSubscription(userId: string, updates: Partial<InsertSubscription>): Promise<Subscription> {
    const result = await this.db
      .update(subscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptions.userId, userId))
      .returning();
    return result[0];
  }

  // Credit system methods
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await this.db.select().from(subscriptionPlans);
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const result = await this.db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return result[0];
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const result = await this.db.insert(subscriptionPlans).values(plan).returning();
    return result[0];
  }

  async updateSubscriptionPlanPricing(id: string, prices: { priceGBP: number; priceUSD: number; priceEUR: number }): Promise<SubscriptionPlan> {
    const result = await this.db
      .update(subscriptionPlans)
      .set(prices)
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return result[0];
  }

  async getSmsBundles(): Promise<SmsBundle[]> {
    return await this.db.select().from(smsBundles);
  }

  async getSmsBundle(id: string): Promise<SmsBundle | undefined> {
    const result = await this.db.select().from(smsBundles).where(eq(smsBundles.id, id));
    return result[0];
  }

  async createSmsBundle(bundle: InsertSmsBundle): Promise<SmsBundle> {
    const result = await this.db.insert(smsBundles).values(bundle).returning();
    return result[0];
  }

  async updateSmsBundlePricing(id: string, prices: { priceGBP: number; priceUSD: number; priceEUR: number }): Promise<SmsBundle> {
    const result = await this.db
      .update(smsBundles)
      .set(prices)
      .where(eq(smsBundles.id, id))
      .returning();
    return result[0];
  }

  async getCreditGrants(userId: string): Promise<CreditGrant[]> {
    return await this.db.select().from(creditGrants).where(eq(creditGrants.userId, userId));
  }

  async getCreditGrantsByOrganization(organizationId: string): Promise<CreditGrant[]> {
    return await this.db.select().from(creditGrants).where(eq(creditGrants.organizationId, organizationId));
  }

  async createCreditGrant(userId: string, grant: InsertCreditGrant): Promise<CreditGrant> {
    const organizationId = grant.organizationId ?? (await this.getUser(userId))?.organizationId;
    if (!organizationId) {
      throw new Error("User not associated with an organization");
    }

    const result = await this.db
      .insert(creditGrants)
      .values({ ...grant, organizationId, userId })
      .returning();

    return result[0];
  }

  async updateCreditGrant(id: string, updates: Partial<InsertCreditGrant>): Promise<CreditGrant> {
    const result = await this.db
      .update(creditGrants)
      .set(updates)
      .where(eq(creditGrants.id, id))
      .returning();
    return result[0];
  }

  async getCreditTransactions(userId: string): Promise<CreditTransaction[]> {
    return await this.db.select().from(creditTransactions).where(eq(creditTransactions.userId, userId));
  }

  async createCreditTransaction(userId: string, transaction: InsertCreditTransaction): Promise<CreditTransaction> {
    const organizationId = transaction.organizationId ?? (await this.getUser(userId))?.organizationId;
    if (!organizationId) {
      throw new Error("User not associated with an organization");
    }

    const result = await this.db
      .insert(creditTransactions)
      .values({ ...transaction, organizationId, userId })
      .returning();

    return result[0];
  }

  async getTotalCredits(userId: string): Promise<number> {
    const grants = await this.getCreditGrants(userId);
    return grants.reduce((total, grant) => total + grant.creditsRemaining, 0);
  }

  async consumeCreditsAtomic(
    userId: string,
    amount: number,
    reason: string,
    messageId: string | null
  ): Promise<CreditTransaction[]> {
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }

    // Use database transaction for atomicity
    return await this.db.transaction(async (tx) => {
      const user = await this.getUser(userId);
      if (!user?.organizationId) {
        throw new Error("User not associated with an organization");
      }
      const organizationId = user.organizationId;

      // Get all active grants sorted by expiry (earliest first)
      // Transaction isolation provides the necessary locking
      const now = new Date();
      const allGrants = await tx
        .select()
        .from(creditGrants)
        .where(eq(creditGrants.userId, userId))
        .for("update");

      const activeGrants = allGrants
        .filter(g => g.creditsRemaining > 0)
        .filter(g => !g.expiresAt || g.expiresAt > now)
        .sort((a, b) => {
          if (a.expiresAt && b.expiresAt) {
            return a.expiresAt.getTime() - b.expiresAt.getTime();
          }
          if (a.expiresAt && !b.expiresAt) return -1;
          if (!a.expiresAt && b.expiresAt) return 1;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

      // Check if user has enough credits
      const totalAvailable = activeGrants.reduce((sum, g) => sum + g.creditsRemaining, 0);
      if (totalAvailable < amount) {
        throw new Error(`Insufficient credits. Available: ${totalAvailable}, Required: ${amount}`);
      }

      // Consume credits from grants using FIFO
      let remaining = amount;
      const transactions: CreditTransaction[] = [];

      for (const grant of activeGrants) {
        if (remaining === 0) break;

        const toConsume = Math.min(remaining, grant.creditsRemaining);
        
        // Update grant
        await tx
          .update(creditGrants)
          .set({
            creditsConsumed: grant.creditsConsumed + toConsume,
            creditsRemaining: grant.creditsRemaining - toConsume,
          })
          .where(
            and(
              eq(creditGrants.id, grant.id),
              eq(creditGrants.organizationId, organizationId)
            )
          );

        // Create transaction record
        const txResult = await tx
          .insert(creditTransactions)
          .values({
            organizationId,
            userId,
            grantId: grant.id,
            messageId,
            delta: -toConsume,
            reason,
          })
          .returning();

        transactions.push(txResult[0]);
        remaining -= toConsume;
      }

      return transactions;
    });
  }

  async consumeCreditsAtomicByOrganization(
    organizationId: string,
    amount: number,
    reason: string,
    messageId: string | null
  ): Promise<CreditTransaction[]> {
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }

    return await this.db.transaction(async (tx) => {
      const now = new Date();
      const allGrants = await tx
        .select()
        .from(creditGrants)
        .where(eq(creditGrants.organizationId, organizationId))
        .for("update");

      const activeGrants = allGrants
        .filter((g) => g.creditsRemaining > 0)
        .filter((g) => !g.expiresAt || g.expiresAt > now)
        .sort((a, b) => {
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
      const transactions: CreditTransaction[] = [];

      for (const grant of activeGrants) {
        if (remaining === 0) break;

        const toConsume = Math.min(remaining, grant.creditsRemaining);

        await tx
          .update(creditGrants)
          .set({
            creditsConsumed: grant.creditsConsumed + toConsume,
            creditsRemaining: grant.creditsRemaining - toConsume,
          })
          .where(eq(creditGrants.id, grant.id));

        const txResult = await tx
          .insert(creditTransactions)
          .values({
            organizationId,
            userId: grant.userId,
            grantId: grant.id,
            messageId,
            delta: -toConsume,
            reason,
          })
          .returning();

        transactions.push(txResult[0]);
        remaining -= toConsume;
      }

      return transactions;
    });
  }

  async refundCreditsAtomic(
    userId: string,
    transactionIds: string[],
    reason: string
  ): Promise<CreditTransaction[]> {
    // Use database transaction for atomicity
    return await this.db.transaction(async (tx) => {
      const user = await this.getUser(userId);
      if (!user?.organizationId) {
        throw new Error("User not associated with an organization");
      }
      const organizationId = user.organizationId;

      const refundTransactions: CreditTransaction[] = [];

      for (const txId of transactionIds) {
        const originalTxResult = await tx
          .select()
          .from(creditTransactions)
          .where(eq(creditTransactions.id, txId));

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

        // Get the grant (transaction isolation provides locking)
        const grantResult = await tx
          .select()
          .from(creditGrants)
          .where(
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

        // Update grant to restore credits
        await tx
          .update(creditGrants)
          .set({
            creditsConsumed: grant.creditsConsumed - refundAmount,
            creditsRemaining: grant.creditsRemaining + refundAmount,
          })
          .where(eq(creditGrants.id, grant.id));

        // Create refund transaction
        const refundTxResult = await tx
          .insert(creditTransactions)
          .values({
            organizationId,
            userId,
            grantId: grant.id,
            messageId: originalTx.messageId,
            delta: refundAmount,
            reason: `Refund: ${reason}`,
          })
          .returning();

        refundTransactions.push(refundTxResult[0]);
      }

      return refundTransactions;
    });
  }

  async getPlatformSettings(): Promise<PlatformSettings> {
    const existing = await this.db.select().from(platformSettings).limit(1);
    if (existing[0]) {
      return existing[0];
    }

    const inserted = await this.db
      .insert(platformSettings)
      .values({
        feedbackEmail: "Feedback@HeyTeam.ai",
        supportEmail: "support@heyteam.ai",
      })
      .returning();

    return inserted[0];
  }

  async updatePlatformSettings(updates: Partial<InsertPlatformSettings>): Promise<PlatformSettings> {
    const current = await this.getPlatformSettings();

    const result = await this.db
      .update(platformSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(platformSettings.id, current.id))
      .returning();

    return result[0];
  }

  // Reseller methods
  async getAllResellers(): Promise<Reseller[]> {
    return await this.db.select().from(resellers);
  }

  async getReseller(id: string): Promise<Reseller | undefined> {
    const result = await this.db.select().from(resellers).where(eq(resellers.id, id));
    return result[0];
  }

  async getResellerByReferralCode(code: string): Promise<Reseller | undefined> {
    const result = await this.db.select().from(resellers).where(eq(resellers.referralCode, code));
    return result[0];
  }

  async createReseller(reseller: InsertReseller): Promise<Reseller> {
    const result = await this.db.insert(resellers).values(reseller).returning();
    return result[0];
  }

  async updateReseller(id: string, updates: Partial<InsertReseller>): Promise<Reseller> {
    const result = await this.db
      .update(resellers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(resellers.id, id))
      .returning();
    return result[0];
  }

  async deleteReseller(id: string): Promise<void> {
    await this.db.delete(resellers).where(eq(resellers.id, id));
  }

  async createResellerTransaction(transaction: InsertResellerTransaction): Promise<ResellerTransaction> {
    const result = await this.db.insert(resellerTransactions).values(transaction).returning();
    return result[0];
  }

  async getResellerTransactions(resellerId: string): Promise<ResellerTransaction[]> {
    return await this.db
      .select()
      .from(resellerTransactions)
      .where(eq(resellerTransactions.resellerId, resellerId))
      .orderBy(desc(resellerTransactions.occurredAt));
  }

  async getResellerTransactionsByMonth(resellerId: string, month: number, year: number): Promise<ResellerTransaction[]> {
    const { sql } = await import("drizzle-orm");
    return await this.db
      .select()
      .from(resellerTransactions)
      .where(
        and(
          eq(resellerTransactions.resellerId, resellerId),
          sql`EXTRACT(MONTH FROM ${resellerTransactions.occurredAt}) = ${month}`,
          sql`EXTRACT(YEAR FROM ${resellerTransactions.occurredAt}) = ${year}`
        )
      );
  }

  async getResellerTransactionByStripeEventId(eventId: string): Promise<ResellerTransaction | undefined> {
    const result = await this.db
      .select()
      .from(resellerTransactions)
      .where(eq(resellerTransactions.stripeEventId, eventId));
    return result[0];
  }

  async getResellerPayout(resellerId: string, month: number, year: number): Promise<ResellerPayout | undefined> {
    const result = await this.db
      .select()
      .from(resellerPayouts)
      .where(
        and(
          eq(resellerPayouts.resellerId, resellerId),
          eq(resellerPayouts.month, month),
          eq(resellerPayouts.year, year)
        )
      );
    return result[0];
  }

  async getResellerPayouts(resellerId: string): Promise<ResellerPayout[]> {
    return await this.db
      .select()
      .from(resellerPayouts)
      .where(eq(resellerPayouts.resellerId, resellerId))
      .orderBy(desc(resellerPayouts.year), desc(resellerPayouts.month));
  }

  async createOrUpdateResellerPayout(payout: InsertResellerPayout): Promise<ResellerPayout> {
    const existing = await this.getResellerPayout(payout.resellerId, payout.month, payout.year);
    
    if (existing) {
      const result = await this.db
        .update(resellerPayouts)
        .set({ ...payout, updatedAt: new Date() })
        .where(eq(resellerPayouts.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await this.db.insert(resellerPayouts).values(payout).returning();
      return result[0];
    }
  }

  // Feedback methods
  async createFeedback(
    organizationId: string,
    userId: string,
    insertFeedback: InsertFeedback
  ): Promise<Feedback> {
    const result = await this.db
      .insert(feedback)
      .values({
        ...insertFeedback,
        organizationId,
        userId,
        status: "new",
      })
      .returning();

    return result[0];
  }

  async getAllFeedback(): Promise<Feedback[]> {
    return await this.db.select().from(feedback).orderBy(desc(feedback.createdAt));
  }

  async updateFeedbackStatus(id: string, status: string): Promise<Feedback> {
    const result = await this.db
      .update(feedback)
      .set({ status })
      .where(eq(feedback.id, id))
      .returning();
    return result[0];
  }

  // Device token methods
  async saveDeviceToken(contactId: string, token: string, platform: string): Promise<void> {
    // Check if token already exists
    const existing = await this.db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.token, token))
      .limit(1);

    if (existing.length > 0) {
      // Update existing token
      await this.db
        .update(deviceTokens)
        .set({
          contactId,
          platform,
          updatedAt: new Date(),
        })
        .where(eq(deviceTokens.token, token));
    } else {
      // Insert new token
      await this.db.insert(deviceTokens).values({
        contactId,
        token,
        platform,
      });
    }
  }

  async getDeviceTokensForContact(contactId: string): Promise<DeviceToken[]> {
    return await this.db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.contactId, contactId));
  }

  async getDeviceTokensForContacts(contactIds: string[]): Promise<DeviceToken[]> {
    if (contactIds.length === 0) {
      return [];
    }
    return await this.db
      .select()
      .from(deviceTokens)
      .where(inArray(deviceTokens.contactId, contactIds));
  }

  async removeDeviceToken(token: string): Promise<void> {
    await this.db.delete(deviceTokens).where(eq(deviceTokens.token, token));
  }

  // Push Notification Delivery methods
  async createPushNotificationDelivery(delivery: InsertPushNotificationDelivery): Promise<PushNotificationDelivery> {
    const result = await this.db.insert(pushNotificationDeliveries).values(delivery).returning();
    return result[0];
  }

  async updatePushNotificationDelivery(id: string, updates: Partial<InsertPushNotificationDelivery>): Promise<PushNotificationDelivery> {
    const result = await this.db
      .update(pushNotificationDeliveries)
      .set(updates)
      .where(eq(pushNotificationDeliveries.id, id))
      .returning();
    return result[0];
  }

  async getPushNotificationDeliveryByNotificationId(notificationId: string): Promise<PushNotificationDelivery | undefined> {
    const result = await this.db
      .select()
      .from(pushNotificationDeliveries)
      .where(eq(pushNotificationDeliveries.notificationId, notificationId));
    return result[0];
  }

  async getUndeliveredNotifications(olderThanSeconds: number): Promise<PushNotificationDelivery[]> {
    const cutoffTime = new Date(Date.now() - olderThanSeconds * 1000);
    return await this.db
      .select()
      .from(pushNotificationDeliveries)
      .where(
        and(
          eq(pushNotificationDeliveries.status, "sent"),
          lt(pushNotificationDeliveries.createdAt, cutoffTime)
        )
      );
  }
}
