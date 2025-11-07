import {
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
  type Organization, type InsertOrganization,
  type AdminUser, type InsertAdminUser,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Organization methods
  getOrganization(id: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization>;
  getUsersInOrganization(organizationId: string): Promise<User[]>;
  updateUserTeamRole(userId: string, teamRole: string): Promise<User>;
  
  // Admin user methods
  getAllAdminUsers(): Promise<AdminUser[]>;
  getAdminUserByEmail(email: string): Promise<AdminUser | undefined>;
  createAdminUser(adminUser: InsertAdminUser): Promise<AdminUser>;
  deleteAdminUser(id: string): Promise<void>;

  // User methods
  getUser(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  updateUserPassword(userId: string, password: string): Promise<User>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User>;
  disableUser(userId: string): Promise<User>;
  enableUser(userId: string): Promise<User>;
  
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(token: string): Promise<void>;

  getContacts(userId: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  getContactByRosterToken(token: string): Promise<Contact | undefined>;
  getContactByPhone(phone: string): Promise<Contact | undefined>;
  createContact(userId: string, contact: InsertContact): Promise<Contact>;
  updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;

  getJobs(userId: string): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(userId: string, job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<InsertJob>): Promise<Job>;
  deleteJob(id: string): Promise<void>;

  getTemplates(userId: string): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(userId: string, template: InsertTemplate): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;

  createCampaign(userId: string, campaign: InsertCampaign): Promise<Campaign>;
  getCampaignsForJob(jobId: string): Promise<Campaign[]>;

  getMessages(contactId: string): Promise<Message[]>;
  getMessagesForJob(jobId: string): Promise<Message[]>;
  getAllMessagesForUser(userId: string): Promise<Message[]>;
  createMessage(userId: string, message: InsertMessage): Promise<Message>;
  updateMessageStatus(id: string, status: string): Promise<Message>;

  getAvailability(jobId: string): Promise<Availability[]>;
  getAllAvailability(userId: string): Promise<Availability[]>;
  getAvailabilityByContact(contactId: string): Promise<Availability[]>;
  getAvailabilityForContact(jobId: string, contactId: string): Promise<Availability | undefined>;
  getConfirmedContactsForJob(jobId: string): Promise<Contact[]>;
  getCurrentJobForContact(contactId: string): Promise<Job | undefined>;
  createAvailability(availability: InsertAvailability): Promise<Availability>;
  updateAvailability(id: string, updates: Partial<InsertAvailability>): Promise<Availability>;

  getSubscription(userId: string): Promise<Subscription | undefined>;
  getAllSubscriptions(): Promise<Subscription[]>;
  createSubscription(userId: string, subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(userId: string, updates: Partial<InsertSubscription>): Promise<Subscription>;
  
  // Credit system methods
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlanPricing(id: string, prices: { priceGBP: number; priceUSD: number; priceEUR: number }): Promise<SubscriptionPlan>;
  
  getSmsBundles(): Promise<SmsBundle[]>;
  getSmsBundle(id: string): Promise<SmsBundle | undefined>;
  createSmsBundle(bundle: InsertSmsBundle): Promise<SmsBundle>;
  updateSmsBundlePricing(id: string, prices: { priceGBP: number; priceUSD: number; priceEUR: number }): Promise<SmsBundle>;
  
  getCreditGrants(userId: string): Promise<CreditGrant[]>;
  createCreditGrant(userId: string, grant: InsertCreditGrant): Promise<CreditGrant>;
  updateCreditGrant(id: string, updates: Partial<InsertCreditGrant>): Promise<CreditGrant>;
  
  getCreditTransactions(userId: string): Promise<CreditTransaction[]>;
  createCreditTransaction(userId: string, transaction: InsertCreditTransaction): Promise<CreditTransaction>;
  
  getTotalCredits(userId: string): Promise<number>;
  
  // Atomic credit operations
  consumeCreditsAtomic(
    userId: string,
    amount: number,
    reason: string,
    messageId: string | null
  ): Promise<CreditTransaction[]>;
  
  refundCreditsAtomic(
    userId: string,
    transactionIds: string[],
    reason: string
  ): Promise<CreditTransaction[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private contacts: Map<string, Contact> = new Map();
  private jobs: Map<string, Job> = new Map();
  private templates: Map<string, Template> = new Map();
  private campaigns: Map<string, Campaign> = new Map();
  private messages: Map<string, Message> = new Map();
  private availability: Map<string, Availability> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private passwordResetTokens: Map<string, PasswordResetToken> = new Map();
  private subscriptionPlans: Map<string, SubscriptionPlan> = new Map();
  private smsBundles: Map<string, SmsBundle> = new Map();
  private creditGrants: Map<string, CreditGrant> = new Map();
  private creditTransactions: Map<string, CreditTransaction> = new Map();
  
  // Simple mutex for atomic credit operations
  private creditLocks: Map<string, Promise<any>> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id, stripeCustomerId: null, stripeSubscriptionId: null };
    this.users.set(id, user);
    
    // Create trial subscription (30 days)
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.createSubscription(id, {
      planId: null,
      status: "trial",
      trialEndsAt,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      stripeSubscriptionId: null,
    });
    
    // Grant 10 trial credits (expires with trial)
    await this.createCreditGrant(id, {
      userId: id,
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
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    Object.assign(user, updates);
    this.users.set(id, user);
    return user;
  }

  async updateUserPassword(userId: string, password: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    user.password = password;
    this.users.set(userId, user);
    return user;
  }

  async createPasswordResetToken(insertToken: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const id = randomUUID();
    const token: PasswordResetToken = { ...insertToken, id, createdAt: new Date() };
    this.passwordResetTokens.set(token.token, token);
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return this.passwordResetTokens.get(token);
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    this.passwordResetTokens.delete(token);
  }

  async updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    user.stripeCustomerId = stripeCustomerId;
    user.stripeSubscriptionId = stripeSubscriptionId;
    this.users.set(userId, user);
    return user;
  }

  async getContacts(userId: string): Promise<Contact[]> {
    return Array.from(this.contacts.values()).filter((c) => c.userId === userId);
  }

  async getContact(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async getContactByRosterToken(token: string): Promise<Contact | undefined> {
    return Array.from(this.contacts.values()).find((c) => c.rosterToken === token);
  }

  async getContactByPhone(phone: string): Promise<Contact | undefined> {
    return Array.from(this.contacts.values()).find((c) => c.phone === phone);
  }

  async createContact(userId: string, insertContact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const contact: Contact = { ...insertContact, id, userId, createdAt: new Date() };
    this.contacts.set(id, contact);
    return contact;
  }

  async updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact> {
    const contact = this.contacts.get(id);
    if (!contact) throw new Error("Contact not found");
    Object.assign(contact, updates);
    this.contacts.set(id, contact);
    return contact;
  }

  async deleteContact(id: string): Promise<void> {
    this.contacts.delete(id);
  }

  async getJobs(userId: string): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter((j) => j.userId === userId);
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async createJob(userId: string, insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const now = new Date();
    const job: Job = { ...insertJob, id, userId, createdAt: now, updatedAt: now };
    this.jobs.set(id, job);
    return job;
  }

  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job> {
    const job = this.jobs.get(id);
    if (!job) throw new Error("Job not found");
    Object.assign(job, { ...updates, updatedAt: new Date() });
    this.jobs.set(id, job);
    return job;
  }

  async deleteJob(id: string): Promise<void> {
    this.jobs.delete(id);
  }

  async getTemplates(userId: string): Promise<Template[]> {
    return Array.from(this.templates.values()).filter((t) => t.userId === userId);
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    return this.templates.get(id);
  }

  async createTemplate(userId: string, insertTemplate: InsertTemplate): Promise<Template> {
    const id = randomUUID();
    const template: Template = { ...insertTemplate, id, userId, createdAt: new Date() };
    this.templates.set(id, template);
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    this.templates.delete(id);
  }

  async createCampaign(userId: string, insertCampaign: InsertCampaign): Promise<Campaign> {
    const id = randomUUID();
    const campaign: Campaign = { ...insertCampaign, id, userId, sentAt: new Date() };
    this.campaigns.set(id, campaign);
    return campaign;
  }

  async getCampaignsForJob(jobId: string): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).filter((c) => c.jobId === jobId);
  }

  async getMessages(contactId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((m) => m.contactId === contactId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getMessagesForJob(jobId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((m) => m.jobId === jobId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getAllMessagesForUser(userId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((m) => m.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createMessage(userId: string, insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = { ...insertMessage, id, userId, createdAt: new Date() };
    this.messages.set(id, message);
    return message;
  }

  async updateMessageStatus(id: string, status: string): Promise<Message> {
    const message = this.messages.get(id);
    if (!message) throw new Error("Message not found");
    message.status = status;
    this.messages.set(id, message);
    return message;
  }

  async getAvailability(jobId: string): Promise<Availability[]> {
    return Array.from(this.availability.values()).filter((a) => a.jobId === jobId);
  }

  async getAllAvailability(userId: string): Promise<Availability[]> {
    // Get all jobs for this user
    const userJobs = await this.getJobs(userId);
    const jobIds = new Set(userJobs.map(j => j.id));
    
    // Filter availability entries that belong to user's jobs
    return Array.from(this.availability.values()).filter((a) => jobIds.has(a.jobId));
  }

  async getAvailabilityForContact(jobId: string, contactId: string): Promise<Availability | undefined> {
    return Array.from(this.availability.values()).find(
      (a) => a.jobId === jobId && a.contactId === contactId
    );
  }

  async getConfirmedContactsForJob(jobId: string): Promise<Contact[]> {
    const confirmed = Array.from(this.availability.values()).filter(
      (a) => a.jobId === jobId && a.status === "confirmed"
    );
    return confirmed
      .map((a) => this.contacts.get(a.contactId))
      .filter((c): c is Contact => c !== undefined);
  }

  async createAvailability(insertAvailability: InsertAvailability): Promise<Availability> {
    const id = randomUUID();
    const availability: Availability = { ...insertAvailability, id, updatedAt: new Date() };
    this.availability.set(id, availability);
    return availability;
  }

  async updateAvailability(id: string, updates: Partial<InsertAvailability>): Promise<Availability> {
    const avail = this.availability.get(id);
    if (!avail) throw new Error("Availability not found");
    Object.assign(avail, { ...updates, updatedAt: new Date() });
    this.availability.set(id, avail);
    return avail;
  }

  async getSubscription(userId: string): Promise<Subscription | undefined> {
    return Array.from(this.subscriptions.values()).find((s) => s.userId === userId);
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values());
  }

  async createSubscription(userId: string, insertSubscription: InsertSubscription): Promise<Subscription> {
    const id = randomUUID();
    const now = new Date();
    const subscription: Subscription = { ...insertSubscription, id, userId, createdAt: now, updatedAt: now };
    this.subscriptions.set(id, subscription);
    return subscription;
  }

  async updateSubscription(userId: string, updates: Partial<InsertSubscription>): Promise<Subscription> {
    const subscription = Array.from(this.subscriptions.values()).find((s) => s.userId === userId);
    if (!subscription) throw new Error("Subscription not found");
    Object.assign(subscription, { ...updates, updatedAt: new Date() });
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  // Credit system methods
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return Array.from(this.subscriptionPlans.values());
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    return this.subscriptionPlans.get(id);
  }

  async createSubscriptionPlan(insertPlan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const id = randomUUID();
    const plan: SubscriptionPlan = { ...insertPlan, id, createdAt: new Date() };
    this.subscriptionPlans.set(id, plan);
    return plan;
  }

  async getSmsBundles(): Promise<SmsBundle[]> {
    return Array.from(this.smsBundles.values());
  }

  async getSmsBundle(id: string): Promise<SmsBundle | undefined> {
    return this.smsBundles.get(id);
  }

  async createSmsBundle(insertBundle: InsertSmsBundle): Promise<SmsBundle> {
    const id = randomUUID();
    const bundle: SmsBundle = { ...insertBundle, id, createdAt: new Date() };
    this.smsBundles.set(id, bundle);
    return bundle;
  }

  async getCreditGrants(userId: string): Promise<CreditGrant[]> {
    return Array.from(this.creditGrants.values()).filter((g) => g.userId === userId);
  }

  async createCreditGrant(userId: string, insertGrant: InsertCreditGrant): Promise<CreditGrant> {
    const id = randomUUID();
    const grant: CreditGrant = { ...insertGrant, id, createdAt: new Date() };
    this.creditGrants.set(id, grant);
    return grant;
  }

  async updateCreditGrant(id: string, updates: Partial<InsertCreditGrant>): Promise<CreditGrant> {
    const grant = this.creditGrants.get(id);
    if (!grant) throw new Error("Credit grant not found");
    Object.assign(grant, updates);
    this.creditGrants.set(id, grant);
    return grant;
  }

  async getCreditTransactions(userId: string): Promise<CreditTransaction[]> {
    return Array.from(this.creditTransactions.values()).filter((t) => t.userId === userId);
  }

  async createCreditTransaction(userId: string, insertTransaction: InsertCreditTransaction): Promise<CreditTransaction> {
    const id = randomUUID();
    const transaction: CreditTransaction = { ...insertTransaction, id, createdAt: new Date() };
    this.creditTransactions.set(id, transaction);
    return transaction;
  }

  async getTotalCredits(userId: string): Promise<number> {
    const grants = await this.getCreditGrants(userId);
    return grants.reduce((total, grant) => total + grant.creditsRemaining, 0);
  }

  // Helper to acquire lock for atomic credit operations
  private async withCreditLock<T>(userId: string, operation: () => Promise<T>): Promise<T> {
    // Wait for any existing lock to be released
    while (this.creditLocks.has(userId)) {
      await this.creditLocks.get(userId);
    }
    
    // Create a new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    
    this.creditLocks.set(userId, lockPromise);
    
    try {
      return await operation();
    } finally {
      this.creditLocks.delete(userId);
      releaseLock!();
    }
  }

  async consumeCreditsAtomic(
    userId: string,
    amount: number,
    reason: string,
    messageId: string | null
  ): Promise<CreditTransaction[]> {
    return this.withCreditLock(userId, async () => {
      if (amount <= 0) {
        throw new Error("Amount must be positive");
      }

      // Get all active grants sorted by expiry (earliest first)
      const grants = Array.from(this.creditGrants.values())
        .filter(g => g.userId === userId && g.creditsRemaining > 0)
        .filter(g => !g.expiresAt || g.expiresAt > new Date())
        .sort((a, b) => {
          if (a.expiresAt && b.expiresAt) {
            return a.expiresAt.getTime() - b.expiresAt.getTime();
          }
          if (a.expiresAt && !b.expiresAt) return -1;
          if (!a.expiresAt && b.expiresAt) return 1;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

      // Check if user has enough credits
      const totalAvailable = grants.reduce((sum, g) => sum + g.creditsRemaining, 0);
      if (totalAvailable < amount) {
        throw new Error(`Insufficient credits. Available: ${totalAvailable}, Required: ${amount}`);
      }

      // Consume credits from grants using FIFO
      let remaining = amount;
      const transactions: CreditTransaction[] = [];

      for (const grant of grants) {
        if (remaining === 0) break;

        const toConsume = Math.min(remaining, grant.creditsRemaining);
        
        // Update grant atomically
        grant.creditsConsumed += toConsume;
        grant.creditsRemaining -= toConsume;
        this.creditGrants.set(grant.id, grant);

        // Create transaction record
        const txId = randomUUID();
        const transaction: CreditTransaction = {
          id: txId,
          userId,
          grantId: grant.id,
          messageId,
          delta: -toConsume,
          reason,
          createdAt: new Date(),
        };

        this.creditTransactions.set(txId, transaction);
        transactions.push(transaction);

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
    return this.withCreditLock(userId, async () => {
      const refundTransactions: CreditTransaction[] = [];

      for (const txId of transactionIds) {
        const originalTx = this.creditTransactions.get(txId);

        if (!originalTx) {
          throw new Error(`Transaction ${txId} not found`);
        }

        if (originalTx.userId !== userId) {
          throw new Error(`Transaction ${txId} does not belong to user`);
        }

        if (originalTx.delta >= 0) {
          throw new Error(`Transaction ${txId} is not a consumption`);
        }

        // Get the grant and restore credits atomically
        const grant = this.creditGrants.get(originalTx.grantId);

        if (!grant) {
          throw new Error(`Grant ${originalTx.grantId} not found`);
        }

        const refundAmount = Math.abs(originalTx.delta);

        // Update grant atomically
        grant.creditsConsumed -= refundAmount;
        grant.creditsRemaining += refundAmount;
        this.creditGrants.set(grant.id, grant);

        // Create refund transaction
        const refundTxId = randomUUID();
        const refundTx: CreditTransaction = {
          id: refundTxId,
          userId,
          grantId: grant.id,
          messageId: originalTx.messageId,
          delta: refundAmount,
          reason: `Refund: ${reason}`,
          createdAt: new Date(),
        };

        this.creditTransactions.set(refundTxId, refundTx);
        refundTransactions.push(refundTx);
      }

      return refundTransactions;
    });
  }
}

import { DbStorage } from "./db-storage";

export const storage = new DbStorage();
