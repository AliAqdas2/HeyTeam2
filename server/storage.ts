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
  type Reseller, type InsertReseller,
  type ResellerTransaction, type InsertResellerTransaction,
  type ResellerPayout, type InsertResellerPayout,
  type Feedback, type InsertFeedback,
  type PlatformSettings, type InsertPlatformSettings,
  type JobSkillRequirement, type InsertJobSkillRequirement,
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
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  getAdminUserByEmail(email: string): Promise<AdminUser | undefined>;
  createAdminUser(adminUser: InsertAdminUser): Promise<AdminUser>;
  updateAdminUser(id: string, updates: Partial<InsertAdminUser>): Promise<AdminUser>;
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

  getContacts(organizationId: string): Promise<Contact[]>;
  getContact(id: string, organizationId: string): Promise<Contact | undefined>;
  getContactById(id: string): Promise<Contact | undefined>; // Get contact by ID only (for auth)
  getContactByRosterToken(token: string): Promise<Contact | undefined>;
  getContactByPhone(phone: string, organizationId?: string): Promise<Contact | undefined>;
  getContactByEmail(email: string, organizationId?: string): Promise<Contact | undefined>;
  createContact(organizationId: string, userId: string, contact: InsertContact): Promise<Contact>;
  bulkCreateContacts(organizationId: string, userId: string, contacts: InsertContact[]): Promise<Contact[]>;
  updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact>;
  updateContactPassword(contactId: string, password: string): Promise<Contact>;
  deleteContact(id: string): Promise<void>;

  getJobs(organizationId: string): Promise<Job[]>;
  getJob(id: string, organizationId: string): Promise<Job | undefined>;
  createJob(organizationId: string, userId: string, job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<InsertJob>): Promise<Job>;
  deleteJob(id: string): Promise<void>;
  getJobSkillRequirements(jobId: string): Promise<JobSkillRequirement[]>;
  replaceJobSkillRequirements(jobId: string, requirements: InsertJobSkillRequirement[]): Promise<JobSkillRequirement[]>;

  getTemplates(organizationId: string): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(organizationId: string, userId: string, template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, updates: Partial<InsertTemplate>): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;

  createCampaign(organizationId: string, userId: string, campaign: InsertCampaign): Promise<Campaign>;
  getCampaignsForJob(jobId: string, organizationId: string): Promise<Campaign[]>;

  getMessages(contactId: string, organizationId: string): Promise<Message[]>;
  getMessagesForJob(jobId: string, organizationId: string): Promise<Message[]>;
  getAllMessagesForUser(organizationId: string): Promise<Message[]>;
  createMessage(organizationId: string, userId: string, message: InsertMessage): Promise<Message>;
  updateMessageStatus(id: string, status: string): Promise<Message>;

  getAvailability(jobId: string, organizationId: string): Promise<Availability[]>;
  getAllAvailability(organizationId: string): Promise<Availability[]>;
  getAvailabilityByContact(contactId: string, organizationId: string): Promise<Availability[]>;
  getAvailabilityForContact(jobId: string, contactId: string, organizationId: string): Promise<Availability | undefined>;
  getConfirmedContactsForJob(jobId: string, organizationId: string): Promise<Contact[]>;
  getCurrentJobForContact(contactId: string, organizationId: string): Promise<Job | undefined>;
  createAvailability(organizationId: string, availability: InsertAvailability): Promise<Availability>;
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
  getCreditGrantsByOrganization(organizationId: string): Promise<CreditGrant[]>;
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
  consumeCreditsAtomicByOrganization(
    organizationId: string,
    amount: number,
    reason: string,
    messageId: string | null
  ): Promise<CreditTransaction[]>;
  
  // Platform settings
  getPlatformSettings(): Promise<PlatformSettings>;
  updatePlatformSettings(updates: Partial<InsertPlatformSettings>): Promise<PlatformSettings>;
  
  // Reseller methods
  getAllResellers(): Promise<Reseller[]>;
  getReseller(id: string): Promise<Reseller | undefined>;
  getResellerByReferralCode(code: string): Promise<Reseller | undefined>;
  createReseller(reseller: InsertReseller): Promise<Reseller>;
  updateReseller(id: string, updates: Partial<InsertReseller>): Promise<Reseller>;
  deleteReseller(id: string): Promise<void>;
  
  // Reseller transaction methods
  createResellerTransaction(transaction: InsertResellerTransaction): Promise<ResellerTransaction>;
  getResellerTransactions(resellerId: string): Promise<ResellerTransaction[]>;
  getResellerTransactionsByMonth(resellerId: string, month: number, year: number): Promise<ResellerTransaction[]>;
  getResellerTransactionByStripeEventId(eventId: string): Promise<ResellerTransaction | undefined>;
  
  // Reseller payout methods
  getResellerPayout(resellerId: string, month: number, year: number): Promise<ResellerPayout | undefined>;
  getResellerPayouts(resellerId: string): Promise<ResellerPayout[]>;
  createOrUpdateResellerPayout(payout: InsertResellerPayout): Promise<ResellerPayout>;

  // Feedback methods
  createFeedback(organizationId: string, userId: string, feedback: InsertFeedback): Promise<Feedback>;
  getAllFeedback(): Promise<Feedback[]>;
  updateFeedbackStatus(id: string, status: string): Promise<Feedback>;
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
  private organizations: Map<string, Organization> = new Map();
  private adminUsers: Map<string, AdminUser> = new Map();
  private resellers: Map<string, Reseller> = new Map();
  private resellerTransactions: Map<string, ResellerTransaction> = new Map();
  private resellerPayouts: Map<string, ResellerPayout> = new Map();
  private feedbacks: Map<string, Feedback> = new Map();
  private jobSkillRequirements: Map<string, JobSkillRequirement> = new Map();
  private platformSettingsData: PlatformSettings = {
    id: randomUUID(),
    feedbackEmail: "Feedback@HeyTeam.ai",
    supportEmail: "support@heyteam.ai",
    updatedAt: new Date(),
  };
  
  // Simple mutex for atomic credit operations
  private creditLocks: Map<string, Promise<any>> = new Map();

  // Organization methods
  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.organizations.get(id);
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const id = randomUUID();
    const now = new Date();
    const organization: Organization = { ...org, id, createdAt: now, updatedAt: now };
    this.organizations.set(id, organization);
    return organization;
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization> {
    const org = this.organizations.get(id);
    if (!org) throw new Error("Organization not found");
    Object.assign(org, { ...updates, updatedAt: new Date() });
    this.organizations.set(id, org);
    return org;
  }

  async getUsersInOrganization(organizationId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter((u) => u.organizationId === organizationId);
  }

  async updateUserTeamRole(userId: string, teamRole: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    user.teamRole = teamRole;
    this.users.set(userId, user);
    return user;
  }

  // Admin user methods
  async getAllAdminUsers(): Promise<AdminUser[]> {
    return Array.from(this.adminUsers.values());
  }

  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    return this.adminUsers.get(id);
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    return Array.from(this.adminUsers.values()).find((admin) => admin.email === email);
  }

  async createAdminUser(insertAdminUser: InsertAdminUser): Promise<AdminUser> {
    const id = randomUUID();
    const adminUser: AdminUser = { ...insertAdminUser, id, createdAt: new Date() };
    this.adminUsers.set(id, adminUser);
    return adminUser;
  }

  async updateAdminUser(id: string, updates: Partial<InsertAdminUser>): Promise<AdminUser> {
    const admin = this.adminUsers.get(id);
    if (!admin) {
      throw new Error("Admin user not found");
    }
    const updated: AdminUser = {
      ...admin,
      ...updates,
    };
    this.adminUsers.set(id, updated);
    return updated;
  }

  async deleteAdminUser(id: string): Promise<void> {
    this.adminUsers.delete(id);
  }

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
    const now = new Date();
    const user: User = {
      id,
      username: insertUser.username,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      password: insertUser.password,
      email: insertUser.email,
      countryCode: insertUser.countryCode ?? null,
      mobileNumber: insertUser.mobileNumber ?? null,
      emailVerified: false,
      mobileVerified: false,
      currency: "GBP",
      organizationId: null,
      teamRole: "member",
      isAdmin: false,
      isActive: true,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      resellerId: null,
      referralCode: null,
      createdAt: now,
    };
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

  async disableUser(userId: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    user.isActive = false;
    this.users.set(userId, user);
    return user;
  }

  async enableUser(userId: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    user.isActive = true;
    this.users.set(userId, user);
    return user;
  }

  async getContacts(organizationId: string): Promise<Contact[]> {
    return Array.from(this.contacts.values()).filter((c) => c.organizationId === organizationId);
  }

  async getContact(id: string, organizationId: string): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    return contact && contact.organizationId === organizationId ? contact : undefined;
  }

  async getContactById(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async getContactByRosterToken(token: string): Promise<Contact | undefined> {
    return Array.from(this.contacts.values()).find((c) => c.rosterToken === token);
  }

  async getContactByPhone(phone: string, organizationId: string): Promise<Contact | undefined> {
    return Array.from(this.contacts.values()).find((c) => c.phone === phone && c.organizationId === organizationId);
  }

  async getContactByEmail(email: string, organizationId?: string): Promise<Contact | undefined> {
    const contacts = Array.from(this.contacts.values());
    return contacts.find((c) => {
      if (!c.email || c.email !== email) return false;
      if (organizationId && c.organizationId !== organizationId) return false;
      return c.hasLogin === true; // Only return contacts with login enabled
    });
  }

  async createContact(organizationId: string, userId: string, insertContact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const now = new Date();
    const contact: Contact = {
      ...insertContact,
      id,
      organizationId,
      userId,
      countryCode: insertContact.countryCode ?? "US",
      email: insertContact.email ?? null,
      address: insertContact.address ?? null,
      profilePicture: insertContact.profilePicture ?? null,
      notes: insertContact.notes ?? null,
      skills: insertContact.skills ?? [],
      qualifications: insertContact.qualifications ?? [],
      blackoutPeriods: insertContact.blackoutPeriods ?? [],
      isOptedOut: insertContact.isOptedOut ?? false,
      quietHoursStart: insertContact.quietHoursStart ?? "22:00",
      quietHoursEnd: insertContact.quietHoursEnd ?? "07:00",
      tags: insertContact.tags ?? [],
      rosterToken: insertContact.rosterToken ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async bulkCreateContacts(organizationId: string, userId: string, insertContacts: InsertContact[]): Promise<Contact[]> {
    const createdContacts: Contact[] = [];
    for (const insertContact of insertContacts) {
      const id = randomUUID();
      const now = new Date();
      const contact: Contact = {
        ...insertContact,
        id,
        organizationId,
        userId,
        countryCode: insertContact.countryCode ?? "US",
        email: insertContact.email ?? null,
        address: insertContact.address ?? null,
        profilePicture: insertContact.profilePicture ?? null,
        notes: insertContact.notes ?? null,
        skills: insertContact.skills ?? [],
        qualifications: insertContact.qualifications ?? [],
        blackoutPeriods: insertContact.blackoutPeriods ?? [],
        isOptedOut: insertContact.isOptedOut ?? false,
        quietHoursStart: insertContact.quietHoursStart ?? "22:00",
        quietHoursEnd: insertContact.quietHoursEnd ?? "07:00",
        tags: insertContact.tags ?? [],
        rosterToken: insertContact.rosterToken ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.contacts.set(id, contact);
      createdContacts.push(contact);
    }
    return createdContacts;
  }

  async updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact> {
    const contact = this.contacts.get(id);
    if (!contact) throw new Error("Contact not found");
    Object.assign(contact, updates);
    this.contacts.set(id, contact);
    return contact;
  }

  async updateContactPassword(contactId: string, password: string): Promise<Contact> {
    const contact = this.contacts.get(contactId);
    if (!contact) throw new Error("Contact not found");
    contact.password = password;
    this.contacts.set(contactId, contact);
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
    const job: Job = {
      ...insertJob,
      id,
      userId,
      notes: insertJob.notes ?? null,
      requiredHeadcount: insertJob.requiredHeadcount ?? null,
      createdAt: now,
      updatedAt: now,
    };
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
    for (const [key, requirement] of Array.from(this.jobSkillRequirements.entries())) {
      if (requirement.jobId === id) {
        this.jobSkillRequirements.delete(key);
      }
    }
  }

  async getJobSkillRequirements(jobId: string): Promise<JobSkillRequirement[]> {
    return Array.from(this.jobSkillRequirements.values()).filter((requirement) => requirement.jobId === jobId);
  }

  async replaceJobSkillRequirements(
    jobId: string,
    requirements: InsertJobSkillRequirement[],
  ): Promise<JobSkillRequirement[]> {
    for (const [key, requirement] of Array.from(this.jobSkillRequirements.entries())) {
      if (requirement.jobId === jobId) {
        this.jobSkillRequirements.delete(key);
      }
    }

    const now = new Date();
    const created: JobSkillRequirement[] = requirements.map((requirement) => {
      const id = randomUUID();
      const record: JobSkillRequirement = {
        id,
        jobId,
        skill: requirement.skill,
        headcount: requirement.headcount ?? 1,
        notes: requirement.notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.jobSkillRequirements.set(id, record);
      return record;
    });

    return created;
  }

  async getTemplates(userId: string): Promise<Template[]> {
    return Array.from(this.templates.values()).filter((t) => t.userId === userId);
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    return this.templates.get(id);
  }

  async createTemplate(userId: string, insertTemplate: InsertTemplate): Promise<Template> {
    const id = randomUUID();
    const template: Template = {
      ...insertTemplate,
      id,
      userId,
      type: insertTemplate.type ?? "standard",
      includeRosterLink: insertTemplate.includeRosterLink ?? false,
      createdAt: new Date(),
    };
    this.templates.set(id, template);
    return template;
  }

  async updateTemplate(id: string, updates: Partial<InsertTemplate>): Promise<Template> {
    const template = this.templates.get(id);
    if (!template) throw new Error("Template not found");
    Object.assign(template, updates);
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
    const now = new Date();
    const message: Message = {
      ...insertMessage,
      id,
      userId,
      status: insertMessage.status ?? "queued",
      jobId: insertMessage.jobId ?? null,
      campaignId: insertMessage.campaignId ?? null,
      twilioSid: insertMessage.twilioSid ?? null,
      createdAt: now,
      updatedAt: now,
    };
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

  async getAvailabilityByContact(contactId: string): Promise<Availability[]> {
    return Array.from(this.availability.values()).filter((a) => a.contactId === contactId);
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

  async getCurrentJobForContact(contactId: string): Promise<Job | undefined> {
    const contactAvailability = Array.from(this.availability.values())
      .filter((a) => a.contactId === contactId && a.status === "confirmed")
      .sort((a, b) => {
        const jobA = this.jobs.get(a.jobId);
        const jobB = this.jobs.get(b.jobId);
        if (!jobA || !jobB) return 0;
        return jobA.startTime.getTime() - jobB.startTime.getTime();
      });
    
    if (contactAvailability.length === 0) return undefined;
    return this.jobs.get(contactAvailability[0].jobId);
  }

  async createAvailability(insertAvailability: InsertAvailability): Promise<Availability> {
    const id = randomUUID();
    const availability: Availability = {
      ...insertAvailability,
      id,
      status: insertAvailability.status ?? "no_reply",
      shiftPreference: insertAvailability.shiftPreference ?? null,
      updatedAt: new Date(),
    };
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
    const subscription: Subscription = {
      ...insertSubscription,
      id,
      userId,
      status: insertSubscription.status ?? "trial",
      currency: insertSubscription.currency ?? "GBP",
      planId: insertSubscription.planId ?? null,
      trialEndsAt: insertSubscription.trialEndsAt ?? null,
      currentPeriodStart: insertSubscription.currentPeriodStart ?? null,
      currentPeriodEnd: insertSubscription.currentPeriodEnd ?? null,
      stripeSubscriptionId: insertSubscription.stripeSubscriptionId ?? null,
      createdAt: now,
      updatedAt: now,
    };
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
    const plan: SubscriptionPlan = {
      ...insertPlan,
      id,
      description: insertPlan.description ?? null,
      targetAudience: insertPlan.targetAudience ?? "",
      featureBullets: insertPlan.featureBullets ?? "",
      useCase: insertPlan.useCase ?? "",
      supportLevel: insertPlan.supportLevel ?? "email",
      customTemplates: insertPlan.customTemplates ?? false,
      autoFollowUp: insertPlan.autoFollowUp ?? false,
      multiManager: insertPlan.multiManager ?? false,
      aiFeatures: insertPlan.aiFeatures ?? false,
      dedicatedNumber: insertPlan.dedicatedNumber ?? false,
      stripePriceIdGBP: insertPlan.stripePriceIdGBP ?? null,
      stripePriceIdUSD: insertPlan.stripePriceIdUSD ?? null,
      stripePriceIdEUR: insertPlan.stripePriceIdEUR ?? null,
      isActive: insertPlan.isActive ?? true,
      createdAt: new Date(),
    };
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
    const bundle: SmsBundle = {
      ...insertBundle,
      id,
      description: insertBundle.description ?? null,
      planId: insertBundle.planId ?? null,
      stripePriceIdGBP: insertBundle.stripePriceIdGBP ?? null,
      stripePriceIdUSD: insertBundle.stripePriceIdUSD ?? null,
      stripePriceIdEUR: insertBundle.stripePriceIdEUR ?? null,
      isActive: insertBundle.isActive ?? true,
      createdAt: new Date(),
    };
    this.smsBundles.set(id, bundle);
    return bundle;
  }

  async getCreditGrants(userId: string): Promise<CreditGrant[]> {
    return Array.from(this.creditGrants.values()).filter((g) => g.userId === userId);
  }

  async getCreditGrantsByOrganization(organizationId: string): Promise<CreditGrant[]> {
    return Array.from(this.creditGrants.values()).filter((g) => g.organizationId === organizationId);
  }

  async createCreditGrant(userId: string, insertGrant: InsertCreditGrant): Promise<CreditGrant> {
    const id = randomUUID();
    const organizationId = insertGrant.organizationId ?? this.users.get(userId)?.organizationId;
    if (!organizationId) {
      throw new Error("User not associated with an organization");
    }
    const grant: CreditGrant = {
      ...insertGrant,
      id,
      organizationId,
      userId,
      sourceRef: insertGrant.sourceRef ?? null,
      creditsConsumed: insertGrant.creditsConsumed ?? 0,
      expiresAt: insertGrant.expiresAt ?? null,
      createdAt: new Date(),
    };
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
    const organizationId = insertTransaction.organizationId ?? this.users.get(userId)?.organizationId;
    if (!organizationId) {
      throw new Error("User not associated with an organization");
    }
    const transaction: CreditTransaction = {
      ...insertTransaction,
      id,
      userId,
      organizationId,
      messageId: insertTransaction.messageId ?? null,
      createdAt: new Date(),
    };
    this.creditTransactions.set(id, transaction);
    return transaction;
  }

  async getTotalCredits(userId: string): Promise<number> {
    const grants = await this.getCreditGrants(userId);
    return grants.reduce((total, grant) => total + grant.creditsRemaining, 0);
  }

  // Helper to acquire lock for atomic credit operations
  private async withCreditLock<T>(lockKey: string, operation: () => Promise<T>): Promise<T> {
    // Wait for any existing lock to be released
    while (this.creditLocks.has(lockKey)) {
      await this.creditLocks.get(lockKey);
    }
    
    // Create a new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    
    this.creditLocks.set(lockKey, lockPromise);
    
    try {
      return await operation();
    } finally {
      this.creditLocks.delete(lockKey);
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
          organizationId: grant.organizationId,
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

  async consumeCreditsAtomicByOrganization(
    organizationId: string,
    amount: number,
    reason: string,
    messageId: string | null
  ): Promise<CreditTransaction[]> {
    return this.withCreditLock(`org:${organizationId}`, async () => {
      if (amount <= 0) {
        throw new Error("Amount must be positive");
      }

      const now = new Date();
      const grants = Array.from(this.creditGrants.values())
        .filter((g) => g.organizationId === organizationId && g.creditsRemaining > 0)
        .filter((g) => !g.expiresAt || g.expiresAt > now)
        .sort((a, b) => {
          if (a.expiresAt && b.expiresAt) {
            return a.expiresAt.getTime() - b.expiresAt.getTime();
          }
          if (a.expiresAt && !b.expiresAt) return -1;
          if (!a.expiresAt && b.expiresAt) return 1;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

      const totalAvailable = grants.reduce((sum, g) => sum + g.creditsRemaining, 0);
      if (totalAvailable < amount) {
        throw new Error(`Insufficient credits. Available: ${totalAvailable}, Required: ${amount}`);
      }

      let remaining = amount;
      const transactions: CreditTransaction[] = [];

      for (const grant of grants) {
        if (remaining === 0) break;

        const toConsume = Math.min(remaining, grant.creditsRemaining);

        grant.creditsConsumed += toConsume;
        grant.creditsRemaining -= toConsume;
        this.creditGrants.set(grant.id, grant);

        const txId = randomUUID();
        const transaction: CreditTransaction = {
          id: txId,
          userId: grant.userId,
          organizationId,
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
          organizationId: grant.organizationId,
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

  async getPlatformSettings(): Promise<PlatformSettings> {
    return this.platformSettingsData;
  }

  async updatePlatformSettings(updates: Partial<InsertPlatformSettings>): Promise<PlatformSettings> {
    this.platformSettingsData = {
      ...this.platformSettingsData,
      ...updates,
      updatedAt: new Date(),
    };
    return this.platformSettingsData;
  }

  async updateSubscriptionPlanPricing(id: string, prices: { priceGBP: number; priceUSD: number; priceEUR: number }): Promise<SubscriptionPlan> {
    const plan = this.subscriptionPlans.get(id);
    if (!plan) throw new Error("Subscription plan not found");
    Object.assign(plan, prices);
    this.subscriptionPlans.set(id, plan);
    return plan;
  }

  async updateSmsBundlePricing(id: string, prices: { priceGBP: number; priceUSD: number; priceEUR: number }): Promise<SmsBundle> {
    const bundle = this.smsBundles.get(id);
    if (!bundle) throw new Error("SMS bundle not found");
    Object.assign(bundle, prices);
    this.smsBundles.set(id, bundle);
    return bundle;
  }

  // Reseller methods
  async getAllResellers(): Promise<Reseller[]> {
    return Array.from(this.resellers.values());
  }

  async getReseller(id: string): Promise<Reseller | undefined> {
    return this.resellers.get(id);
  }

  async getResellerByReferralCode(code: string): Promise<Reseller | undefined> {
    return Array.from(this.resellers.values()).find((r) => r.referralCode === code);
  }

  async createReseller(insertReseller: InsertReseller): Promise<Reseller> {
    const id = randomUUID();
    const now = new Date();
    const reseller: Reseller = {
      ...insertReseller,
      id,
      commissionRate: insertReseller.commissionRate ?? 20,
      status: insertReseller.status ?? "active",
      createdAt: now,
      updatedAt: now,
    };
    this.resellers.set(id, reseller);
    return reseller;
  }

  async updateReseller(id: string, updates: Partial<InsertReseller>): Promise<Reseller> {
    const reseller = this.resellers.get(id);
    if (!reseller) throw new Error("Reseller not found");
    Object.assign(reseller, { ...updates, updatedAt: new Date() });
    this.resellers.set(id, reseller);
    return reseller;
  }

  async deleteReseller(id: string): Promise<void> {
    this.resellers.delete(id);
  }

  async createResellerTransaction(insertTransaction: InsertResellerTransaction): Promise<ResellerTransaction> {
    const id = randomUUID();
    const now = new Date();
    const transaction: ResellerTransaction = {
      ...insertTransaction,
      id,
      stripeEventId: insertTransaction.stripeEventId ?? null,
      stripeInvoiceId: insertTransaction.stripeInvoiceId ?? null,
      stripeCheckoutId: insertTransaction.stripeCheckoutId ?? null,
      occurredAt: insertTransaction.occurredAt || now,
      createdAt: now,
    };
    this.resellerTransactions.set(id, transaction);
    return transaction;
  }

  async getResellerTransactions(resellerId: string): Promise<ResellerTransaction[]> {
    return Array.from(this.resellerTransactions.values())
      .filter((t) => t.resellerId === resellerId)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

  async getResellerTransactionsByMonth(resellerId: string, month: number, year: number): Promise<ResellerTransaction[]> {
    return Array.from(this.resellerTransactions.values()).filter((t) => {
      if (t.resellerId !== resellerId) return false;
      const occurredAt = t.occurredAt;
      return occurredAt.getMonth() + 1 === month && occurredAt.getFullYear() === year;
    });
  }

  async getResellerTransactionByStripeEventId(eventId: string): Promise<ResellerTransaction | undefined> {
    return Array.from(this.resellerTransactions.values()).find((t) => t.stripeEventId === eventId);
  }

  async getResellerPayout(resellerId: string, month: number, year: number): Promise<ResellerPayout | undefined> {
    return Array.from(this.resellerPayouts.values()).find(
      (p) => p.resellerId === resellerId && p.month === month && p.year === year
    );
  }

  async getResellerPayouts(resellerId: string): Promise<ResellerPayout[]> {
    return Array.from(this.resellerPayouts.values())
      .filter((p) => p.resellerId === resellerId)
      .sort((a, b) => b.year - a.year || b.month - a.month);
  }

  async createOrUpdateResellerPayout(insertPayout: InsertResellerPayout): Promise<ResellerPayout> {
    const existing = await this.getResellerPayout(
      insertPayout.resellerId,
      insertPayout.month,
      insertPayout.year
    );

    if (existing) {
      Object.assign(existing, { ...insertPayout, updatedAt: new Date() });
      this.resellerPayouts.set(existing.id, existing);
      return existing;
    } else {
      const id = randomUUID();
      const now = new Date();
      const payout: ResellerPayout = {
        ...insertPayout,
        id,
        currency: insertPayout.currency ?? "GBP",
        newRevenue: insertPayout.newRevenue ?? 0,
        recurringRevenue: insertPayout.recurringRevenue ?? 0,
        totalRevenue: insertPayout.totalRevenue ?? 0,
        commissionAmount: insertPayout.commissionAmount ?? 0,
        transactionCount: insertPayout.transactionCount ?? 0,
        status: insertPayout.status ?? "pending",
        lastCalculatedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      this.resellerPayouts.set(id, payout);
      return payout;
    }
  }

  async createFeedback(insertFeedback: InsertFeedback): Promise<Feedback> {
    const id = randomUUID();
    const feedback: Feedback = {
      ...insertFeedback,
      id,
      userId: (insertFeedback as any).userId,
      status: "new",
      createdAt: new Date(),
    };
    this.feedbacks.set(id, feedback);
    return feedback;
  }

  async getAllFeedback(): Promise<Feedback[]> {
    return Array.from(this.feedbacks.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateFeedbackStatus(id: string, status: string): Promise<Feedback> {
    const feedback = this.feedbacks.get(id);
    if (!feedback) {
      throw new Error("Feedback not found");
    }
    feedback.status = status;
    this.feedbacks.set(id, feedback);
    return feedback;
  }
}

import { DbStorage } from "./db-storage";

export const storage = new DbStorage();
