import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, and, desc, or, sql } from "drizzle-orm";
import {
  organizations, users, contacts, jobs, templates, campaigns, messages,
  availability, subscriptions,
  passwordResetTokens, subscriptionPlans, smsBundles, creditGrants, creditTransactions,
  adminUsers,
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

  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    const result = await this.db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return result[0];
  }

  async createAdminUser(insertAdminUser: InsertAdminUser): Promise<AdminUser> {
    const result = await this.db.insert(adminUsers).values(insertAdminUser).returning();
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
    // Create a new organization for the user
    const org = await this.createOrganization({
      name: `${insertUser.username}'s Organization`,
    });
    
    // Create user with organization and default team role
    const userData = {
      ...insertUser,
      organizationId: org.id,
      teamRole: "owner",
    };
    
    const result = await this.db.insert(users).values(userData).returning();
    const user = result[0];
    
    // Create trial subscription (30 days)
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.createSubscription(user.id, {
      planId: null,
      status: "trial",
      trialEndsAt,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      stripeSubscriptionId: null,
    });
    
    // Grant 10 trial credits (expires with trial)
    await this.createCreditGrant(user.id, {
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

  async getContacts(userId: string): Promise<Contact[]> {
    return await this.db.select().from(contacts).where(eq(contacts.userId, userId));
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const result = await this.db.select().from(contacts).where(eq(contacts.id, id));
    return result[0];
  }

  async getContactByRosterToken(token: string): Promise<Contact | undefined> {
    const result = await this.db.select().from(contacts).where(eq(contacts.rosterToken, token));
    return result[0];
  }

  async getContactByPhone(phone: string): Promise<Contact | undefined> {
    // Twilio sends full E.164 format (e.g., +441234567890)
    // We need to match against our separate countryCode + phone fields
    
    // First try exact match on phone field (for backward compatibility)
    let result = await this.db.select().from(contacts).where(eq(contacts.phone, phone));
    if (result.length > 0) {
      return result[0];
    }
    
    // If no exact match, fetch all contacts and match using constructE164Phone logic
    // Strip all non-digit characters from incoming number for comparison
    const cleanedIncoming = phone.replace(/\D/g, '');
    
    if (!cleanedIncoming || cleanedIncoming.length < 10) {
      return undefined;
    }
    
    // Get all contacts to check against
    const allContacts = await this.db.select().from(contacts);
    
    // Country dial code mapping
    const COUNTRY_DIAL_CODES: Record<string, string> = {
      "US": "+1", "CA": "+1", "GB": "+44", "AU": "+61", "NZ": "+64",
      "IE": "+353", "IN": "+91", "SG": "+65", "MX": "+52", "DE": "+49",
      "FR": "+33", "ES": "+34", "IT": "+39",
    };
    
    // Helper to construct E164 from contact's countryCode + phone
    const constructE164 = (countryCode: string, contactPhone: string): string => {
      let cleaned = contactPhone.replace(/\D/g, '');
      
      // If phone starts with +, handle it
      if (contactPhone.trim().startsWith('+')) {
        return '+' + cleaned;
      }
      
      // Remove leading 0 for most countries (except Italy)
      if (cleaned.startsWith('0') && countryCode !== 'IT') {
        cleaned = cleaned.substring(1);
      }
      
      // Prepend country dial code
      const dialCode = COUNTRY_DIAL_CODES[countryCode] || "+1";
      return dialCode + cleaned;
    };
    
    // Find matching contact
    for (const contact of allContacts) {
      const constructedE164 = constructE164(contact.countryCode, contact.phone);
      const cleanedConstructed = constructedE164.replace(/\D/g, '');
      
      if (cleanedConstructed === cleanedIncoming) {
        return contact;
      }
    }
    
    return undefined;
  }

  async createContact(userId: string, contact: InsertContact): Promise<Contact> {
    const result = await this.db.insert(contacts).values({ ...contact, userId }).returning();
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

  async deleteContact(id: string): Promise<void> {
    await this.db.delete(contacts).where(eq(contacts.id, id));
  }

  async getJobs(userId: string): Promise<Job[]> {
    return await this.db.select().from(jobs).where(eq(jobs.userId, userId));
  }

  async getJob(id: string): Promise<Job | undefined> {
    const result = await this.db.select().from(jobs).where(eq(jobs.id, id));
    return result[0];
  }

  async createJob(userId: string, job: InsertJob): Promise<Job> {
    const result = await this.db.insert(jobs).values({ ...job, userId }).returning();
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

  async getTemplates(userId: string): Promise<Template[]> {
    return await this.db.select().from(templates).where(eq(templates.userId, userId));
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const result = await this.db.select().from(templates).where(eq(templates.id, id));
    return result[0];
  }

  async createTemplate(userId: string, template: InsertTemplate): Promise<Template> {
    const result = await this.db.insert(templates).values({ ...template, userId }).returning();
    return result[0];
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.db.delete(templates).where(eq(templates.id, id));
  }

  async createCampaign(userId: string, campaign: InsertCampaign): Promise<Campaign> {
    const result = await this.db.insert(campaigns).values({ ...campaign, userId }).returning();
    return result[0];
  }

  async getCampaignsForJob(jobId: string): Promise<Campaign[]> {
    return await this.db.select().from(campaigns).where(eq(campaigns.jobId, jobId));
  }

  async getMessages(contactId: string): Promise<Message[]> {
    return await this.db.select().from(messages).where(eq(messages.contactId, contactId));
  }

  async getMessagesForJob(jobId: string): Promise<Message[]> {
    return await this.db.select().from(messages).where(eq(messages.jobId, jobId));
  }

  async getAllMessagesForUser(userId: string): Promise<Message[]> {
    return await this.db.select().from(messages)
      .where(eq(messages.userId, userId))
      .orderBy(desc(messages.createdAt));
  }

  async createMessage(userId: string, message: InsertMessage): Promise<Message> {
    const result = await this.db.insert(messages).values({ ...message, userId }).returning();
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

  async getAvailability(jobId: string): Promise<Availability[]> {
    return await this.db.select().from(availability).where(eq(availability.jobId, jobId));
  }

  async getAllAvailability(userId: string): Promise<Availability[]> {
    // Get all availability entries for jobs belonging to this user
    const result = await this.db
      .select({ availability: availability })
      .from(availability)
      .innerJoin(jobs, eq(availability.jobId, jobs.id))
      .where(eq(jobs.userId, userId));
    return result.map(r => r.availability);
  }

  async getAvailabilityByContact(contactId: string): Promise<Availability[]> {
    return await this.db.select().from(availability).where(eq(availability.contactId, contactId));
  }

  async getAvailabilityForContact(jobId: string, contactId: string): Promise<Availability | undefined> {
    const result = await this.db
      .select()
      .from(availability)
      .where(and(eq(availability.jobId, jobId), eq(availability.contactId, contactId)));
    return result[0];
  }

  async getConfirmedContactsForJob(jobId: string): Promise<Contact[]> {
    const result = await this.db
      .select({ contact: contacts })
      .from(availability)
      .innerJoin(contacts, eq(availability.contactId, contacts.id))
      .where(and(eq(availability.jobId, jobId), eq(availability.status, "confirmed")));
    return result.map(r => r.contact);
  }

  async getCurrentJobForContact(contactId: string): Promise<Job | undefined> {
    const result = await this.db
      .select({ job: jobs })
      .from(availability)
      .innerJoin(jobs, eq(availability.jobId, jobs.id))
      .where(and(eq(availability.contactId, contactId), eq(availability.status, "confirmed")))
      .orderBy(jobs.startTime)
      .limit(1);
    return result[0]?.job;
  }

  async createAvailability(avail: InsertAvailability): Promise<Availability> {
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

  async getSubscription(userId: string): Promise<Subscription | undefined> {
    const result = await this.db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return result[0];
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return await this.db.select().from(subscriptions);
  }

  async createSubscription(userId: string, subscription: InsertSubscription): Promise<Subscription> {
    const result = await this.db.insert(subscriptions).values({ ...subscription, userId }).returning();
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

  async createCreditGrant(userId: string, grant: InsertCreditGrant): Promise<CreditGrant> {
    const result = await this.db.insert(creditGrants).values({ ...grant, userId }).returning();
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
    const result = await this.db.insert(creditTransactions).values({ ...transaction, userId }).returning();
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
      // Get all active grants sorted by expiry (earliest first), with FOR UPDATE lock
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
          .where(eq(creditGrants.id, grant.id));

        // Create transaction record
        const txResult = await tx
          .insert(creditTransactions)
          .values({
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

  async refundCreditsAtomic(
    userId: string,
    transactionIds: string[],
    reason: string
  ): Promise<CreditTransaction[]> {
    // Use database transaction for atomicity
    return await this.db.transaction(async (tx) => {
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

        if (originalTx.delta >= 0) {
          throw new Error(`Transaction ${txId} is not a consumption`);
        }

        // Get the grant and lock it
        const grantResult = await tx
          .select()
          .from(creditGrants)
          .where(eq(creditGrants.id, originalTx.grantId))
          .for("update");

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
}
