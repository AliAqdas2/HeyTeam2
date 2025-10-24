import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import path from "path";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import { storage } from "./storage";
import { CreditService } from "./lib/credit-service";
import { getTwilioClient, getTwilioFromPhoneNumber } from "./lib/twilio-client";
import { renderTemplate } from "./lib/template-renderer";
import { parseReply } from "./lib/reply-parser";
import { generateICS } from "./lib/ics-generator";
import { insertJobSchema, insertContactSchema, insertTemplateSchema, insertAvailabilitySchema } from "@shared/schema";
import Stripe from "stripe";
import authRoutes from "./auth-routes";
import PDFDocument from "pdfkit";

const creditService = new CreditService(storage);

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null;

// Country dial codes mapping
const COUNTRY_DIAL_CODES: Record<string, string> = {
  "US": "+1", "CA": "+1", "GB": "+44", "AU": "+61", "NZ": "+64",
  "IE": "+353", "IN": "+91", "SG": "+65", "MX": "+52", "DE": "+49",
  "FR": "+33", "ES": "+34", "IT": "+39",
};

// Placeholder for calendar sync - currently uses .ics file downloads instead
async function syncJobToCalendars(userId: string, job: any): Promise<void> {
  // Calendar integration is done via downloadable .ics files
  // No automatic syncing needed
  return Promise.resolve();
}

// Helper function to construct E.164 phone number
function constructE164Phone(countryCode: string, phone: string): string {
  // Strip all non-digit characters first
  let cleaned = phone.replace(/\D/g, '');
  
  // If original started with +, handle optional trunk prefix in formats like "+44 (0)20..."
  if (phone.trim().startsWith('+')) {
    const result = '+' + cleaned;
    // For countries that don't use trunk 0 in international format, remove it if present
    // Patterns: +440... (UK), +610... (AU), +640... (NZ), etc.
    // Keep 0 for Italy (+390...)
    if (result.startsWith('+440') || result.startsWith('+610') || result.startsWith('+640') || 
        result.startsWith('+3530') || result.startsWith('+910') || result.startsWith('+650') || 
        result.startsWith('+520') || result.startsWith('+490') || result.startsWith('+330') || 
        result.startsWith('+340') || result.startsWith('+10')) {
      // Remove the trunk 0 after country code
      return result.replace(/^(\+\d{1,3})0/, '$1');
    }
    return result;
  }
  
  // Handle international access codes (check longest codes first)
  if (cleaned.startsWith('0011')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('011')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('001')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  
  // Check if number already starts with a country code (after stripping access codes)
  // Common country codes from our list: 1, 33, 34, 39, 44, 49, 52, 61, 64, 65, 91, 353
  const commonCodes = ['1', '33', '34', '39', '44', '49', '52', '61', '64', '65', '91', '353'];
  for (const code of commonCodes) {
    if (cleaned.startsWith(code)) {
      // Already has country code, but may have trunk prefix after it
      const result = '+' + cleaned;
      // Remove trunk 0 after country code (except Italy)
      if (result.startsWith('+440') || result.startsWith('+610') || result.startsWith('+640') || 
          result.startsWith('+3530') || result.startsWith('+910') || result.startsWith('+650') || 
          result.startsWith('+520') || result.startsWith('+490') || result.startsWith('+330') || 
          result.startsWith('+340') || result.startsWith('+10')) {
        return result.replace(/^(\+\d{1,3})0/, '$1');
      }
      return result;
    }
  }
  
  // No country code detected, so this is a national number
  // Remove leading trunk prefix (usually 0) for most countries except Italy
  if (cleaned.startsWith('0') && countryCode !== 'IT') {
    cleaned = cleaned.substring(1);
  }
  
  // Prepend the country dial code
  const dialCode = COUNTRY_DIAL_CODES[countryCode] || "+1";
  return dialCode + cleaned;
}

// Get the demo user ID (temporary until auth is implemented)
let MOCK_USER_ID: string | null = null;

async function getMockUserId(): Promise<string> {
  if (MOCK_USER_ID) return MOCK_USER_ID;
  const user = await storage.getUserByUsername("demo");
  if (!user) throw new Error("Demo user not found");
  MOCK_USER_ID = user.id;
  return MOCK_USER_ID;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files from attached_assets
  app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets')));
  
  // Auth routes
  app.use("/api/auth", authRoutes);
  
  // Middleware to check authentication
  const requireAuth = async (req: any, res: any, next: any) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    req.user = user;
    next();
  };
  
  // Middleware to check admin or owner role
  const requireTeamAdmin = async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (req.user.teamRole !== "admin" && req.user.teamRole !== "owner") {
      return res.status(403).json({ message: "Requires admin or owner role" });
    }
    next();
  };
  
  // Organization endpoints
  app.get("/api/organization", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(404).json({ message: "No organization found" });
      }
      const org = await storage.getOrganization(req.user.organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }
      res.json(org);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get("/api/organization/members", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(404).json({ message: "No organization found" });
      }
      const members = await storage.getUsersInOrganization(req.user.organizationId);
      // Don't return password hashes
      const safeMembers = members.map(({ password, ...user }) => user);
      res.json(safeMembers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/organization/invite", requireAuth, requireTeamAdmin, async (req: any, res) => {
    try {
      const { email, firstName, lastName, teamRole } = req.body;
      
      if (!email || !firstName || !lastName) {
        return res.status(400).json({ message: "Email, first name, and last name are required" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      // Generate a temporary password (in production, send via email)
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      // Generate username from email (first part before @)
      const username = email.split('@')[0];
      
      // Create user in the same organization
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
        stripeSubscriptionId: null,
      });
      
      // Don't return password hash
      const { password, ...safeUser } = newUser;
      const response = { 
        ...safeUser, 
        temporaryPassword: tempPassword
      };
      res.json(response);
    } catch (error: any) {
      console.error("Invite error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch("/api/organization/members/:userId/role", requireAuth, requireTeamAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { teamRole } = req.body;
      
      if (!["owner", "admin", "member"].includes(teamRole)) {
        return res.status(400).json({ message: "Invalid team role" });
      }
      
      // Get target user
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if target user is in the same organization
      if (targetUser.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Cannot modify users from other organizations" });
      }
      
      // Only owner can change other users to owner
      if (teamRole === "owner" && req.user.teamRole !== "owner") {
        return res.status(403).json({ message: "Only owners can assign owner role" });
      }
      
      const updatedUser = await storage.updateUserTeamRole(userId, teamRole);
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/organization/members/:userId", requireAuth, requireTeamAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { firstName, lastName, email } = req.body;
      
      // Get target user
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if target user is in the same organization
      if (targetUser.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Cannot modify users from other organizations" });
      }
      
      // Check if email is already taken by another user
      if (email && email !== targetUser.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }
      
      const updates: any = {};
      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (email) updates.email = email;
      
      const updatedUser = await storage.updateUser(userId, updates);
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.delete("/api/organization/members/:userId", requireAuth, requireTeamAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Get target user
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if target user is in the same organization
      if (targetUser.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Cannot remove users from other organizations" });
      }
      
      // Cannot remove yourself
      if (targetUser.id === req.user.id) {
        return res.status(400).json({ message: "Cannot remove yourself" });
      }
      
      // Cannot remove owner
      if (targetUser.teamRole === "owner") {
        return res.status(403).json({ message: "Cannot remove organization owner" });
      }
      
      // In a real app, we'd handle user deletion more carefully
      // For now, just update their organizationId to null
      await storage.updateUser(userId, { organizationId: null });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send password reminder to team member
  app.post("/api/organization/members/:userId/password-reminder", requireAuth, requireTeamAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Get target user
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if target user is in the same organization
      if (targetUser.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Cannot send password reminder to users from other organizations" });
      }
      
      // Cannot send reminder to yourself
      if (targetUser.id === req.user.id) {
        return res.status(400).json({ message: "Cannot send password reminder to yourself" });
      }
      
      // Generate a new temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      // Update the user's password
      await storage.updateUser(userId, { password: hashedPassword });
      
      // Return the temporary password so the admin can share it
      res.json({ 
        success: true, 
        tempPassword,
        username: targetUser.username || targetUser.email,
        message: `Temporary password generated for ${targetUser.username || targetUser.email}`
      });
    } catch (error: any) {
      console.error("Password reminder error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Team messaging endpoint
  app.post("/api/messages/team", requireAuth, async (req: any, res) => {
    try {
      const { recipientId, content } = req.body;
      
      if (!recipientId || !content) {
        return res.status(400).json({ message: "Recipient ID and content are required" });
      }
      
      // Get recipient user
      const recipient = await storage.getUser(recipientId);
      if (!recipient) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      
      // Check if recipient is in the same organization
      if (recipient.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Cannot message users from other organizations" });
      }
      
      // In a production app, this would send an email or in-app notification
      // For now, we'll just log it and return success
      console.log(`Message from ${req.user.username} to ${recipient.username}: ${content}`);
      console.log(`Recipient email: ${recipient.email}`);
      
      // TODO: In production, integrate with email service to send the message
      // await sendEmail({
      //   to: recipient.email,
      //   from: req.user.email,
      //   subject: `Message from ${req.user.username}`,
      //   body: content
      // });
      
      res.json({ 
        success: true,
        message: "Message sent successfully (logged to console in development mode)",
        recipient: {
          id: recipient.id,
          username: recipient.username,
          email: recipient.email,
        }
      });
    } catch (error: any) {
      console.error("Team messaging error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getJobs(await getMockUserId());
      const jobsWithAvailability = await Promise.all(
        jobs.map(async (job) => {
          const availability = await storage.getAvailability(job.id);
          return {
            ...job,
            availabilityCounts: {
              confirmed: availability.filter((a) => a.status === "confirmed").length,
              maybe: availability.filter((a) => a.status === "maybe").length,
              declined: availability.filter((a) => a.status === "declined").length,
              noReply: availability.filter((a) => a.status === "no_reply").length,
            },
          };
        })
      );
      res.json(jobsWithAvailability);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/jobs/:id/roster", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const availability = await storage.getAvailability(job.id);
      const availabilityWithContacts = await Promise.all(
        availability.map(async (avail) => {
          const contact = await storage.getContact(avail.contactId);
          return { ...avail, contact };
        })
      );

      res.json({ ...job, availability: availabilityWithContacts });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/jobs", async (req, res) => {
    try {
      const body = {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
      };
      const validated = insertJobSchema.parse(body);
      const job = await storage.createJob(await getMockUserId(), validated);

      await syncJobToCalendars(await getMockUserId(), job);

      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/jobs/:id", async (req, res) => {
    try {
      const body = {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
      };
      const validated = insertJobSchema.partial().parse(body);
      const job = await storage.updateJob(req.params.id, validated);

      await syncJobToCalendars(await getMockUserId(), job);

      const availability = await storage.getAvailability(job.id);
      const confirmedContacts = await Promise.all(
        availability
          .filter((a) => a.status === "confirmed")
          .map((a) => storage.getContact(a.contactId))
      );

      await sendRescheduleNotifications(await getMockUserId(), job, confirmedContacts.filter(Boolean) as any[]);

      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Verify the job belongs to the user
      if (job.userId !== await getMockUserId()) {
        return res.status(403).json({ message: "Not authorized to delete this job" });
      }

      await storage.deleteJob(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/contacts", async (req, res) => {
    try {
      const contacts = await storage.getContacts(await getMockUserId());
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/contacts/:id/current-job", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verify the contact belongs to the user
      const contact = await storage.getContact(id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      if (contact.userId !== await getMockUserId()) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const job = await storage.getCurrentJobForContact(id);
      if (!job) {
        return res.status(404).json({ message: "No current job found for this contact" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const validated = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(await getMockUserId(), validated);
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/contacts/upload-image", async (req, res) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { nanoid } = await import('nanoid');
      
      // Create attached_assets/profile_pictures directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'attached_assets', 'profile_pictures');
      await fs.mkdir(uploadsDir, { recursive: true });

      // Read the file from the request
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Parse multipart form data (simple implementation)
      const boundary = req.headers['content-type']?.split('boundary=')[1];
      if (!boundary) {
        return res.status(400).json({ message: 'Invalid content type' });
      }

      // Extract file data from multipart
      const parts = buffer.toString('binary').split(`--${boundary}`);
      let fileData: Buffer | null = null;
      let fileExt = 'jpg';

      for (const part of parts) {
        if (part.includes('Content-Type: image/')) {
          const contentType = part.match(/Content-Type: image\/(\w+)/)?.[1];
          if (contentType) fileExt = contentType;
          
          const dataStart = part.indexOf('\r\n\r\n') + 4;
          const dataEnd = part.lastIndexOf('\r\n');
          if (dataStart > 3 && dataEnd > dataStart) {
            const binaryData = part.substring(dataStart, dataEnd);
            fileData = Buffer.from(binaryData, 'binary');
            break;
          }
        }
      }

      if (!fileData) {
        return res.status(400).json({ message: 'No file data found' });
      }

      // Save file with unique name
      const fileName = `${nanoid()}.${fileExt}`;
      const filePath = path.join(uploadsDir, fileName);
      await fs.writeFile(filePath, fileData);

      // Return the URL path
      const url = `/attached_assets/profile_pictures/${fileName}`;
      res.json({ url });
    } catch (error: any) {
      console.error('Image upload error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.updateContact(req.params.id, req.body);
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      const userId = await getMockUserId();
      
      // Verify the contact belongs to the user
      const contact = await storage.getContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (contact.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this contact" });
      }
      
      await storage.deleteContact(req.params.id);
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/contacts/import", async (req, res) => {
    try {
      const userId = await getMockUserId();
      const { contacts: csvContacts } = req.body;
      
      if (!Array.isArray(csvContacts)) {
        return res.status(400).json({ message: "Invalid request: contacts must be an array" });
      }

      const results = {
        imported: 0,
        skipped: 0,
        errors: [] as string[],
      };

      // Fetch existing contacts once
      const existingContacts = await storage.getContacts(userId);
      const existingPhones = new Set(existingContacts.map(c => c.phone));

      for (let i = 0; i < csvContacts.length; i++) {
        const csvContact = csvContacts[i];
        const rowNum = i + 2; // +2 because row 1 is headers, array is 0-indexed

        try {
          // Validate required fields
          if (!csvContact.firstName || !csvContact.lastName || !csvContact.phone) {
            results.errors.push(`Row ${rowNum}: Missing required fields (firstName, lastName, or phone)`);
            results.skipped++;
            continue;
          }

          // Check for duplicate
          if (existingPhones.has(csvContact.phone)) {
            results.errors.push(`Row ${rowNum}: Phone ${csvContact.phone} already exists`);
            results.skipped++;
            continue;
          }

          // Validate with schema
          const validated = insertContactSchema.parse({
            firstName: csvContact.firstName,
            lastName: csvContact.lastName,
            phone: csvContact.phone,
            email: csvContact.email || null,
            notes: csvContact.notes || null,
          });

          // Create contact
          await storage.createContact(userId, validated);
          existingPhones.add(csvContact.phone); // Add to set to prevent duplicates within the import
          results.imported++;
        } catch (error: any) {
          results.errors.push(`Row ${rowNum}: ${error.message}`);
          results.skipped++;
        }
      }

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate or get roster token for a contact
  app.get("/api/contacts/:id/roster-token", async (req, res) => {
    try {
      const userId = await getMockUserId();
      const contact = await storage.getContact(req.params.id);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      // Verify contact belongs to user
      if (contact.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Generate token if doesn't exist
      if (!contact.rosterToken) {
        const token = nanoid(32);
        await storage.updateContact(req.params.id, { rosterToken: token });
        return res.json({ token });
      }
      
      res.json({ token: contact.rosterToken });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint to view roster by token - no auth required
  app.get("/api/roster/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Find contact by roster token
      const contact = await storage.getContactByRosterToken(token);
      
      if (!contact) {
        return res.status(404).json({ message: "Roster not found" });
      }
      
      // Get all jobs where this contact has availability (regardless of status)
      const availability = await storage.getAvailabilityByContact(contact.id);
      
      // Fetch job details for all jobs with availability
      const jobIds = availability.map(a => a.jobId);
      const jobs = [];
      
      for (const jobId of jobIds) {
        const job = await storage.getJob(jobId);
        if (job) {
          jobs.push(job);
        }
      }
      
      // Sort jobs by start time
      jobs.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      
      res.json({
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
        },
        jobs: jobs.map(job => ({
          id: job.id,
          name: job.name,
          location: job.location,
          startTime: job.startTime,
          endTime: job.endTime,
          notes: job.notes,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/resource-allocation", async (req, res) => {
    try {
      const userId = await getMockUserId();
      
      // Fetch all data needed for the report
      const contacts = await storage.getContacts(userId);
      const jobs = await storage.getJobs(userId);
      const allAvailability = await storage.getAllAvailability(userId);
      
      // Create a PDF document
      const doc = new PDFDocument({ margin: 50 });
      
      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="resource-allocation-report.pdf"');
      
      // Pipe the PDF to the response
      doc.pipe(res);
      
      // Add title
      doc.fontSize(20).font('Helvetica-Bold').text('Resource Allocation Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);
      
      // Group contacts by status
      const contactsOnJob = contacts.filter(c => c.status === 'on_job');
      const contactsAvailable = contacts.filter(c => c.status === 'free');
      const contactsOffShift = contacts.filter(c => c.status === 'off_shift');
      
      // Create a map of contact assignments
      const contactJobMap = new Map<string, any>();
      allAvailability.forEach(avail => {
        if (avail.status === 'confirmed') {
          const job = jobs.find(j => j.id === avail.jobId);
          if (job) {
            contactJobMap.set(avail.contactId, job);
          }
        }
      });
      
      // Section 1: Contacts on Jobs
      doc.fontSize(14).font('Helvetica-Bold').text('Contacts Assigned to Jobs', { underline: true });
      doc.moveDown();
      
      if (contactsOnJob.length === 0) {
        doc.fontSize(10).font('Helvetica-Oblique').text('No contacts currently assigned to jobs.');
        doc.moveDown();
      } else {
        // Group contacts by job
        const jobGroups = new Map<string, any[]>();
        contactsOnJob.forEach(contact => {
          const job = contactJobMap.get(contact.id);
          if (job) {
            if (!jobGroups.has(job.id)) {
              jobGroups.set(job.id, []);
            }
            jobGroups.get(job.id)!.push(contact);
          }
        });
        
        jobGroups.forEach((contactsList, jobId) => {
          const job = jobs.find(j => j.id === jobId);
          if (job) {
            doc.fontSize(12).font('Helvetica-Bold').text(`${job.name}`, { continued: false });
            doc.fontSize(10).font('Helvetica').text(`Location: ${job.location || 'N/A'}`);
            doc.text(`Start: ${new Date(job.startTime).toLocaleString()}`);
            doc.moveDown(0.5);
            
            contactsList.forEach((contact, index) => {
              doc.fontSize(10).font('Helvetica').text(
                `  ${index + 1}. ${contact.firstName} ${contact.lastName} - ${contact.phone}${contact.email ? ` (${contact.email})` : ''}`,
                { indent: 20 }
              );
            });
            doc.moveDown();
          }
        });
      }
      
      doc.moveDown();
      
      // Section 2: Available Contacts
      doc.fontSize(14).font('Helvetica-Bold').text('Available Contacts', { underline: true });
      doc.moveDown();
      
      if (contactsAvailable.length === 0) {
        doc.fontSize(10).font('Helvetica-Oblique').text('No contacts currently available.');
      } else {
        doc.fontSize(10).font('Helvetica').text(`Total Available: ${contactsAvailable.length}`);
        doc.moveDown(0.5);
        contactsAvailable.forEach((contact, index) => {
          doc.fontSize(10).font('Helvetica').text(
            `${index + 1}. ${contact.firstName} ${contact.lastName} - ${contact.phone}${contact.email ? ` (${contact.email})` : ''}`
          );
        });
      }
      
      doc.moveDown(2);
      
      // Section 3: Off Shift Contacts
      doc.fontSize(14).font('Helvetica-Bold').text('Off Shift Contacts', { underline: true });
      doc.moveDown();
      
      if (contactsOffShift.length === 0) {
        doc.fontSize(10).font('Helvetica-Oblique').text('No contacts currently off shift.');
      } else {
        doc.fontSize(10).font('Helvetica').text(`Total Off Shift: ${contactsOffShift.length}`);
        doc.moveDown(0.5);
        contactsOffShift.forEach((contact, index) => {
          doc.fontSize(10).font('Helvetica').text(
            `${index + 1}. ${contact.firstName} ${contact.lastName} - ${contact.phone}${contact.email ? ` (${contact.email})` : ''}`
          );
        });
      }
      
      // Add summary footer
      doc.moveDown(3);
      doc.fontSize(12).font('Helvetica-Bold').text('Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Total Contacts: ${contacts.length}`);
      doc.text(`On Job: ${contactsOnJob.length}`);
      doc.text(`Available: ${contactsAvailable.length}`);
      doc.text(`Off Shift: ${contactsOffShift.length}`);
      
      // Finalize the PDF
      doc.end();
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Download ICS calendar invite for a job
  app.get("/api/jobs/:id/calendar-invite", async (req, res) => {
    try {
      const { id } = req.params;
      const job = await storage.getJob(id);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Generate the ICS file content
      const icsContent = generateICS(job);
      
      // Create a safe filename from the job name
      const safeFilename = job.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const filename = `${safeFilename}-${new Date(job.startTime).toISOString().split('T')[0]}.ics`;
      
      // Set response headers for calendar file download
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Send the ICS content
      res.send(icsContent);
    } catch (error: any) {
      console.error('Error generating calendar invite:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getTemplates(await getMockUserId());
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/templates", async (req, res) => {
    try {
      const validated = insertTemplateSchema.parse(req.body);
      const template = await storage.createTemplate(await getMockUserId(), validated);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    try {
      await storage.deleteTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/send-message", async (req, res) => {
    try {
      const { jobId, templateId, contactIds } = req.body;
      const userId = await getMockUserId();

      // Check if user has enough credits
      const availableCredits = await creditService.getAvailableCredits(userId);
      if (availableCredits < contactIds.length) {
        return res.status(400).json({ 
          message: `Insufficient SMS credits. Available: ${availableCredits}, Required: ${contactIds.length}` 
        });
      }

      const job = await storage.getJob(jobId);
      const template = await storage.getTemplate(templateId);

      if (!job || !template) {
        return res.status(404).json({ message: "Job or template not found" });
      }

      const campaign = await storage.createCampaign(userId, {
        jobId,
        templateId,
      });

      let twilioClient: any = null;
      let fromNumber: string = "";
      
      try {
        twilioClient = await getTwilioClient();
        fromNumber = await getTwilioFromPhoneNumber();
      } catch (error) {
        console.log("Twilio not configured, messages will be logged only");
      }

      const sentMessages = [];

      for (const contactId of contactIds) {
        const contact = await storage.getContact(contactId);
        if (!contact || contact.isOptedOut) continue;

        let existing = await storage.getAvailabilityForContact(jobId, contactId);
        if (!existing) {
          existing = await storage.createAvailability({
            jobId,
            contactId,
            status: "no_reply",
            shiftPreference: null,
          });
        }

        let messageContent = renderTemplate(template.content, contact, job);
        
        // Append roster link if template has it enabled
        if (template.includeRosterLink) {
          // Generate or get roster token for this contact
          let rosterToken = contact.rosterToken;
          if (!rosterToken) {
            rosterToken = nanoid(32);
            await storage.updateContact(contactId, { rosterToken });
          }
          
          // Get the base URL from the request
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          const rosterUrl = `${baseUrl}/roster/${rosterToken}`;
          messageContent += `\n\nView your weekly roster: ${rosterUrl}`;
        }
        
        let message;

        if (twilioClient && fromNumber) {
          try {
            const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
            const twilioMessage = await twilioClient.messages.create({
              body: messageContent,
              from: fromNumber,
              to: e164Phone,
            });

            message = await storage.createMessage(userId, {
              contactId,
              jobId,
              campaignId: campaign.id,
              direction: "outbound",
              content: messageContent,
              status: "sent",
              twilioSid: twilioMessage.sid,
            });
          } catch (error) {
            message = await storage.createMessage(userId, {
              contactId,
              jobId,
              campaignId: campaign.id,
              direction: "outbound",
              content: messageContent,
              status: "failed",
              twilioSid: null,
            });
          }
        } else {
          console.log(`[DEV MODE] Would send SMS to ${contact.phone}: ${messageContent}`);
          message = await storage.createMessage(userId, {
            contactId,
            jobId,
            campaignId: campaign.id,
            direction: "outbound",
            content: messageContent,
            status: "sent",
            twilioSid: `dev-${Date.now()}`,
          });
        }

        sentMessages.push(message);
      }

      // Consume credits for all sent messages
      await creditService.consumeCredits(
        userId,
        sentMessages.length,
        `Campaign ${campaign.id} for job ${jobId}`,
        null
      );

      res.json({ success: true, campaign });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/messages/bulk-sms", async (req, res) => {
    try {
      const { contactIds, message } = req.body;
      const userId = await getMockUserId();

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: "Contact IDs required" });
      }

      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message content required" });
      }

      // Check if user has enough credits
      const availableCredits = await creditService.getAvailableCredits(userId);
      if (availableCredits < contactIds.length) {
        return res.status(400).json({ 
          message: `Insufficient SMS credits. Available: ${availableCredits}, Required: ${contactIds.length}` 
        });
      }

      let twilioClient: any = null;
      let fromNumber: string = "";
      
      try {
        twilioClient = await getTwilioClient();
        fromNumber = await getTwilioFromPhoneNumber();
      } catch (error) {
        console.log("Twilio not configured, messages will be logged only");
      }

      let sent = 0;
      let useTwilio = twilioClient && fromNumber;
      
      for (const contactId of contactIds) {
        const contact = await storage.getContact(contactId);
        if (!contact || contact.isOptedOut) continue;

        if (useTwilio) {
          try {
            const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
            const twilioMessage = await twilioClient.messages.create({
              body: message,
              from: fromNumber,
              to: e164Phone,
            });

            await storage.createMessage(userId, {
              contactId,
              jobId: null,
              campaignId: null,
              direction: "outbound",
              content: message,
              status: "sent",
              twilioSid: twilioMessage.sid,
            });
            sent++;
          } catch (error: any) {
            // If authentication fails, fall back to dev mode for remaining messages
            if (error.status === 401 || error.code === 20003) {
              console.log("Twilio authentication failed, switching to dev mode");
              useTwilio = false;
              // Process this contact in dev mode
              console.log(`[DEV MODE] Would send SMS to ${contact.phone}: ${message}`);
              await storage.createMessage(userId, {
                contactId,
                jobId: null,
                campaignId: null,
                direction: "outbound",
                content: message,
                status: "sent",
                twilioSid: `dev-${Date.now()}-${contactId}`,
              });
              sent++;
            } else {
              console.error(`Failed to send SMS to ${contact.phone}:`, error);
              await storage.createMessage(userId, {
                contactId,
                jobId: null,
                campaignId: null,
                direction: "outbound",
                content: message,
                status: "failed",
                twilioSid: null,
              });
            }
          }
        } else {
          console.log(`[DEV MODE] Would send SMS to ${contact.phone}: ${message}`);
          await storage.createMessage(userId, {
            contactId,
            jobId: null,
            campaignId: null,
            direction: "outbound",
            content: message,
            status: "sent",
            twilioSid: `dev-${Date.now()}-${contactId}`,
          });
          sent++;
        }
      }

      // Consume credits for all sent messages
      await creditService.consumeCredits(
        userId,
        sent,
        "Bulk SMS broadcast",
        null
      );

      res.json({ success: true, sent });
    } catch (error: any) {
      console.error("Bulk SMS error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Stripe webhook handler (requires raw body for signature verification)
  app.post("/api/stripe/webhook", 
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
        let event: Stripe.Event;

        try {
          event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
        } catch (err: any) {
          console.error("Webhook signature verification failed:", err.message);
          return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        console.log(`Received Stripe webhook: ${event.type}`);

        // Handle different event types
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.userId;

            if (!userId) {
              console.error("No userId in checkout session metadata");
              break;
            }

            // Check if this is a subscription or one-time purchase (bundle)
            if (session.mode === "subscription" && session.subscription) {
              // Handle subscription purchase
              const subscriptionId = session.subscription as string;
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              const planId = session.metadata?.planId;

              if (!planId) {
                console.error("No planId in session metadata");
                break;
              }

              // Get the plan details
              const plan = await storage.getSubscriptionPlan(planId);
              if (!plan) {
                console.error(`Plan ${planId} not found`);
                break;
              }

              // Get currency from session metadata (defaults to GBP)
              const currency = session.metadata?.currency || "GBP";

              // Update user's subscription
              const userSub = await storage.getSubscription(userId);
              if (userSub) {
                await storage.updateSubscription(userId, {
                  planId,
                  currency,
                  stripeSubscriptionId: subscriptionId,
                  status: subscription.status,
                  currentPeriodStart: new Date(subscription.current_period_start * 1000),
                  currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                });
              }

              // Grant credits for the subscription period
              const expiryDate = new Date(subscription.current_period_end * 1000);
              await creditService.grantCredits(
                userId,
                plan.monthlyCredits,
                `Subscription: ${plan.name}`,
                expiryDate
              );

              console.log(`Granted ${plan.monthlyCredits} credits to user ${userId} for subscription ${planId}`);
            } else if (session.mode === "payment" && session.payment_intent) {
              // Handle one-time bundle purchase
              const bundleId = session.metadata?.bundleId;

              if (!bundleId) {
                console.error("No bundleId in session metadata");
                break;
              }

              // Get the bundle details
              const bundle = await storage.getSmsBundle(bundleId);
              if (!bundle) {
                console.error(`Bundle ${bundleId} not found`);
                break;
              }

              // Grant credits (bundles don't expire)
              await creditService.grantCredits(
                userId,
                bundle.credits,
                `SMS Bundle: ${bundle.name}`,
                null
              );

              console.log(`Granted ${bundle.credits} credits to user ${userId} for bundle ${bundleId}`);
            }
            break;
          }

          case "invoice.payment_succeeded": {
            const invoice = event.data.object as Stripe.Invoice;
            const subscriptionId = invoice.subscription as string;

            if (!subscriptionId) {
              console.log("Invoice not for a subscription, skipping");
              break;
            }

            // Find the subscription
            const subscriptions = await storage.getAllSubscriptions?.() || [];
            const userSub = subscriptions.find(s => s.stripeSubscriptionId === subscriptionId);

            if (!userSub) {
              console.error(`Subscription ${subscriptionId} not found in database`);
              break;
            }

            // Get the subscription from Stripe
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            // Update subscription dates
            await storage.updateSubscription(userSub.userId, {
              status: subscription.status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            });

            // Grant credits for the new period (if not the first invoice)
            if (invoice.billing_reason === "subscription_cycle" && userSub.planId) {
              const plan = await storage.getSubscriptionPlan(userSub.planId);
              if (plan) {
                const expiryDate = new Date(subscription.current_period_end * 1000);
                await creditService.grantCredits(
                  userSub.userId,
                  plan.monthlyCredits,
                  `Subscription renewal: ${plan.name}`,
                  expiryDate
                );

                console.log(`Granted ${plan.monthlyCredits} credits to user ${userSub.userId} for renewal`);
              }
            }
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            const subscriptionId = subscription.id;

            // Find the subscription
            const subscriptions = await storage.getAllSubscriptions?.() || [];
            const userSub = subscriptions.find(s => s.stripeSubscriptionId === subscriptionId);

            if (userSub) {
              await storage.updateSubscription(userSub.userId, {
                status: "canceled",
              });
              console.log(`Subscription ${subscriptionId} cancelled for user ${userSub.userId}`);
            }
            break;
          }

          default:
            console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
      } catch (error: any) {
        console.error("Stripe webhook error:", error);
        res.status(500).json({ message: error.message });
      }
    }
  );

  app.post("/api/twilio/webhook", async (req, res) => {
    try {
      const { From, Body, MessageSid } = req.body;

      const contacts = await storage.getContacts(await getMockUserId());
      const contact = contacts.find((c) => c.phone === From);

      if (!contact) {
        return res.status(200).send("OK");
      }

      if (Body.toLowerCase().includes("stop") || Body.toLowerCase().includes("unsubscribe")) {
        await storage.updateContact(contact.id, { isOptedOut: true });
        return res.status(200).send("OK");
      }

      const messages = await storage.getMessages(contact.id);
      const recentMessages = messages.filter(
        (m) => m.direction === "outbound" && m.jobId
      ).slice(-5);

      const jobId = recentMessages.length > 0 ? recentMessages[recentMessages.length - 1].jobId : null;

      await storage.createMessage(await getMockUserId(), {
        contactId: contact.id,
        jobId: jobId,
        campaignId: null,
        direction: "inbound",
        content: Body,
        status: "received",
        twilioSid: MessageSid,
      });

      if (jobId) {
        const parsed = parseReply(Body);
        const availability = await storage.getAvailabilityForContact(jobId, contact.id);

        if (availability) {
          await storage.updateAvailability(availability.id, {
            status: parsed.status,
            shiftPreference: parsed.shiftPreference || availability.shiftPreference,
          });
        }
      }

      res.status(200).send("OK");
    } catch (error: any) {
      console.error("Twilio webhook error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all messages for current user with enriched contact/job data
  app.get("/api/messages/history", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const messages = await storage.getAllMessagesForUser(userId);
      
      // Enrich messages with contact and job information
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          const contact = await storage.getContact(msg.contactId);
          const job = msg.jobId ? await storage.getJob(msg.jobId) : null;
          
          return {
            ...msg,
            contactName: contact ? `${contact.firstName} ${contact.lastName}` : "Unknown",
            jobName: job?.name || null,
          };
        })
      );
      
      res.json(enrichedMessages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/messages/:contactId", async (req, res) => {
    try {
      const messages = await storage.getMessages(req.params.contactId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/availability", async (req, res) => {
    try {
      const validated = insertAvailabilitySchema.parse(req.body);
      const availability = await storage.createAvailability(validated);
      res.json(availability);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/availability/:id", async (req, res) => {
    try {
      const { status, shiftPreference } = req.body;
      const availability = await storage.updateAvailability(req.params.id, {
        status,
        shiftPreference,
      });
      res.json(availability);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/subscription", async (req, res) => {
    try {
      const subscription = await storage.getSubscription(await getMockUserId());
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      res.json(subscription);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Credit system routes
  app.get("/api/credits", async (req, res) => {
    try {
      const userId = await getMockUserId();
      const [available, breakdown] = await Promise.all([
        creditService.getAvailableCredits(userId),
        creditService.getCreditBreakdown(userId),
      ]);
      
      res.json({
        available,
        breakdown,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/subscription-plans", async (req, res) => {
    try {
      const plans = await storage.getSubscriptionPlans();
      res.json(plans.filter(p => p.isActive));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sms-bundles", async (req, res) => {
    try {
      const bundles = await storage.getSmsBundles();
      res.json(bundles.filter(b => b.isActive));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }

      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { planId, currency = "GBP" } = req.body;

      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }

      if (!["GBP", "USD", "EUR"].includes(currency)) {
        return res.status(400).json({ message: "Invalid currency" });
      }

      // Get the plan
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan || !plan.isActive) {
        return res.status(404).json({ message: "Plan not found" });
      }

      // Get the price for the selected currency
      let priceAmount: number;
      let stripeCurrency: string;
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

      // Get the user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id,
          },
        });
        customerId = customer.id;
        await storage.updateUser(userId, { stripeCustomerId: customerId });
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: stripeCurrency,
              product_data: {
                name: `${plan.name} Plan`,
                description: `${plan.monthlyCredits} messages per month`,
              },
              recurring: {
                interval: "month",
              },
              unit_amount: priceAmount, // Already in cents/pence from database
            },
            quantity: 1,
          },
        ],
        success_url: `${req.headers.origin}/billing?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/billing`,
        metadata: {
          userId,
          planId,
          currency,
        },
      });

      // Update user's currency preference
      await storage.updateUser(userId, { currency });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout session error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/credit-grants", async (req, res) => {
    try {
      const userId = await getMockUserId();
      const grants = await storage.getCreditGrants(userId);
      res.json(grants);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/credit-transactions", async (req, res) => {
    try {
      const userId = await getMockUserId();
      const transactions = await storage.getCreditTransactions(userId);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin middleware - checks if user is admin
  async function requireAdmin(req: any, res: any, next: any) {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      next();
    } catch (error: any) {
      console.error("Admin middleware error:", error);
      res.status(500).json({ message: "Authentication error" });
    }
  }

  // Admin routes
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      
      // Get subscription and credit info for each user
      const usersWithDetails = await Promise.all(
        allUsers.map(async (user) => {
          const [subscription, totalCredits, creditTransactions] = await Promise.all([
            storage.getSubscription(user.id),
            storage.getTotalCredits(user.id),
            storage.getCreditTransactions(user.id),
          ]);

          // Calculate SMS volume (total messages sent) from credit transactions
          const smsVolume = creditTransactions
            .filter(t => t.type === "debit" && t.messageId)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

          let planName = "Trial";
          let monthlyPayment = 0;
          if (subscription?.planId) {
            const plan = await storage.getSubscriptionPlan(subscription.planId);
            planName = plan?.name || "Unknown";
            
            // Get monthly payment based on subscription currency
            if (plan) {
              const currency = subscription.currency || user.currency || "GBP";
              if (currency === "GBP") {
                monthlyPayment = plan.priceGBP / 100; // Convert from pence to pounds
              } else if (currency === "USD") {
                monthlyPayment = plan.priceUSD / 100; // Convert from cents to dollars
              } else if (currency === "EUR") {
                monthlyPayment = plan.priceEUR / 100; // Convert from cents to euros
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
              monthlyPayment,
            },
          };
        })
      );

      res.json(usersWithDetails);
    } catch (error: any) {
      console.error("Admin users list error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users/:userId/subscription", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }

      // Verify plan exists
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      // Update user's subscription
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await storage.updateSubscription(userId, {
        planId,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });

      res.json({ success: true, message: `Subscription updated to ${plan.name}` });
    } catch (error: any) {
      console.error("Admin update subscription error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users/:userId/credits", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { amount, reason, expiresAt } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      // Grant credits
      const expiry = expiresAt ? new Date(expiresAt) : null;
      await creditService.grantCredits(
        userId,
        "subscription",  // sourceType - admin grants are like subscription grants
        amount,          // creditsGranted
        reason || "Admin grant",  // sourceRef
        expiry           // expiresAt
      );

      const totalCredits = await storage.getTotalCredits(userId);
      res.json({ 
        success: true, 
        message: `Granted ${amount} credits`,
        totalCredits,
      });
    } catch (error: any) {
      console.error("Admin grant credits error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users/:userId/reset-password", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user password
      await storage.updateUser(userId, { password: hashedPassword });

      res.json({ success: true, message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Admin reset password error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // User instance management routes
  app.post("/api/admin/users/:userId/disable", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await storage.disableUser(userId);

      res.json({ success: true, message: "User disabled successfully", user });
    } catch (error: any) {
      console.error("Admin disable user error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users/:userId/enable", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await storage.enableUser(userId);

      res.json({ success: true, message: "User enabled successfully", user });
    } catch (error: any) {
      console.error("Admin enable user error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin user management routes
  app.get("/api/admin/admin-users", requireAdmin, async (req, res) => {
    try {
      const adminUsers = await storage.getAllAdminUsers();
      
      // Don't return password hashes
      const safeAdminUsers = adminUsers.map(({ password, ...adminUser }) => adminUser);
      
      res.json(safeAdminUsers);
    } catch (error: any) {
      console.error("Get admin users error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/admin-users", requireAdmin, async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Check if admin user already exists
      const existingAdmin = await storage.getAdminUserByEmail(email);
      if (existingAdmin) {
        return res.status(400).json({ message: "Admin user with this email already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create admin user
      const adminUser = await storage.createAdminUser({
        name,
        email,
        password: hashedPassword,
      });

      // Don't return password hash
      const { password: _, ...safeAdminUser } = adminUser;

      res.json({ success: true, adminUser: safeAdminUser });
    } catch (error: any) {
      console.error("Create admin user error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/admin-users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      await storage.deleteAdminUser(id);

      res.json({ success: true, message: "Admin user deleted successfully" });
    } catch (error: any) {
      console.error("Delete admin user error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin pricing management routes
  app.get("/api/admin/subscription-plans", requireAdmin, async (req, res) => {
    try {
      const plans = await storage.getSubscriptionPlans();
      res.json(plans);
    } catch (error: any) {
      console.error("Admin get subscription plans error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/subscription-plans/:planId/pricing", requireAdmin, async (req, res) => {
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
        priceEUR,
      });

      res.json(updatedPlan);
    } catch (error: any) {
      console.error("Admin update plan pricing error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/sms-bundles", requireAdmin, async (req, res) => {
    try {
      const bundles = await storage.getSmsBundles();
      res.json(bundles);
    } catch (error: any) {
      console.error("Admin get SMS bundles error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/sms-bundles/:bundleId/pricing", requireAdmin, async (req, res) => {
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
        priceEUR,
      });

      res.json(updatedBundle);
    } catch (error: any) {
      console.error("Admin update bundle pricing error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

async function sendRescheduleNotifications(userId: string, job: any, contacts: any[]) {
  try {
    let twilioClient: any = null;
    let fromNumber: string = "";
    
    try {
      twilioClient = await getTwilioClient();
      fromNumber = await getTwilioFromPhoneNumber();
    } catch (error) {
      console.log("Twilio not configured, reschedule notifications will be logged only");
    }

    const message = `UPDATE: ${job.name} has been rescheduled. New time: ${new Date(job.startTime).toLocaleString()}. Location: ${job.location}. Reply Y to confirm or N to decline.`;

    let sent = 0;

    for (const contact of contacts) {
      if (contact.isOptedOut) continue;

      if (twilioClient && fromNumber) {
        try {
          const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
          const twilioMessage = await twilioClient.messages.create({
            body: message,
            from: fromNumber,
            to: e164Phone,
          });

          await storage.createMessage(userId, {
            contactId: contact.id,
            jobId: job.id,
            campaignId: null,
            direction: "outbound",
            content: message,
            status: "sent",
            twilioSid: twilioMessage.sid,
          });
          sent++;
        } catch (error) {
          console.error("Failed to send reschedule notification:", error);
        }
      } else {
        console.log(`[DEV MODE] Would send reschedule SMS to ${contact.phone}: ${message}`);
        await storage.createMessage(userId, {
          contactId: contact.id,
          jobId: job.id,
          campaignId: null,
          direction: "outbound",
          content: message,
          status: "sent",
          twilioSid: `dev-${Date.now()}`,
        });
        sent++;
      }
    }

    // Consume credits for sent notifications
    if (sent > 0) {
      await creditService.consumeCredits(
        userId,
        sent,
        `Reschedule notification for job ${job.id}`,
        null
      );
    }
  } catch (error) {
    console.error("Reschedule notification error:", error);
  }
}
