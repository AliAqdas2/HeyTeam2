import "dotenv/config";
import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import path from "path";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { storage } from "./storage";
import { CreditService } from "./lib/credit-service";
import { getTwilioClient, getTwilioFromPhoneNumber } from "./lib/twilio-client";
import { constructE164Phone, normalizePhoneNumber } from "./lib/phone-utils";
import { renderTemplate } from "./lib/template-renderer";
import { parseReply } from "./lib/reply-parser";
import { generateICS } from "./lib/ics-generator";
import mobileAuthRoutes from "./mobile-auth-routes";
import {
  insertJobSchema,
  insertJobSkillRequirementForJobSchema,
  insertContactSchema,
  insertTemplateSchema,
  insertAvailabilitySchema,
  insertFeedbackSchema,
  insertPlatformSettingsSchema,
  type Contact,
  type Job,
  type JobSkillRequirement,
  type InsertJobSkillRequirement,
  type Template,
  type Campaign,
  type AdminUser,
  type Subscription,
} from "@shared/schema";
import Stripe from "stripe";
import authRoutes from "./auth-routes";
import PDFDocument from "pdfkit";
import { sendTeamMessageNotification, sendTeamInvitationEmail, sendCancellationNotification, sendFeedbackNotificationEmail } from "./email";
import { sendPushNotificationsToContacts } from "./push-notifications";
import { format, addDays, addWeeks, addMonths, getDay, setDay, startOfDay, isAfter, isBefore } from "date-fns";
import { z } from "zod";

const creditService = new CreditService(storage);

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-09-30.clover" })
  : null;

const platformSettingsUpdateSchema = insertPlatformSettingsSchema.pick({
  feedbackEmail: true,
  supportEmail: true,
}).partial();

const MESSAGE_BATCH_SIZE = 5;
const MESSAGE_BATCH_DELAY_MS = 2 * 60 * 1000;
const DISTANCE_MATRIX_BATCH_SIZE = 25;
const DEFAULT_DISTANCE_THRESHOLD_METERS = 50_000;

type PrioritizedContact = {
  contact: Contact;
  priorityScore: number;
  meetsAllCriteria: boolean;
  distanceMeters: number;
};

function parseBlackoutRange(range: string): { start: Date; end: Date } | null {
  const [startStr, endStr] = range.split("-").map((value) => value.trim());
  if (!startStr || !endStr) {
    return null;
  }

  const parseDate = (input: string) => {
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

  // Extend end date to cover full day
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA <= endB && startB <= endA;
}

function locationMatches(contact: Contact, job: Job): boolean {
  if (!job.location) return true;
  const jobLocation = job.location.toLowerCase();
  const address = contact.address?.toLowerCase() ?? "";
  const tags = (contact.tags || []).map((tag) => tag.toLowerCase());
  return (
    address.includes(jobLocation) ||
    tags.some((tag) => jobLocation.includes(tag) || tag.includes(jobLocation))
  );
}

async function fetchDistancesFromGoogle(
  origin: string,
  destinations: { id: string; address: string }[],
  apiKey: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!destinations.length) {
    return result;
  }

  for (let i = 0; i < destinations.length; i += DISTANCE_MATRIX_BATCH_SIZE) {
    const chunk = destinations.slice(i, i + DISTANCE_MATRIX_BATCH_SIZE);
    const encodedDestinations = chunk.map((destination) => encodeURIComponent(destination.address)).join("|");
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}` +
      `&destinations=${encodedDestinations}&key=${apiKey}`;

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
      elements.forEach((element: any, index: number) => {
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

async function getContactDistanceMap(jobLocation: string | null | undefined, contacts: Contact[]): Promise<Map<string, number>> {
  if (!jobLocation || !jobLocation.trim()) {
    return new Map();
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_API_KEY not configured. Falling back to basic location matching.");
    return new Map();
  }

  const destinations = contacts
    .filter((contact) => contact.address && contact.address.trim())
    .map((contact) => ({
      id: contact.id,
      address: contact.address!.trim(),
    }));

  if (!destinations.length) {
    return new Map();
  }

  return fetchDistancesFromGoogle(jobLocation.trim(), destinations, apiKey);
}

type JobWithSkillRequirements = Job & {
  skillRequirements?: Array<{ skill: string | null | undefined }>;
};

function jobSkills(job: JobWithSkillRequirements): string[] {
  const requirementSkills = Array.isArray(job.skillRequirements)
    ? job.skillRequirements
        .map((requirement) =>
          typeof requirement?.skill === "string" ? requirement.skill.trim().toLowerCase() : null,
        )
        .filter((skill): skill is string => Boolean(skill))
    : [];

  if (requirementSkills.length) {
    // When structured skill requirements are provided, defer skill filtering to the allocation step
    // so each quota can be filled independently.
    return [];
  }

  if (!job.notes) return [];

  const skills: string[] = [];
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
        // Assume block ended when we hit a new sentence without bullet
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
    // Fallback: treat comma/newline separated tokens as skills if notes look like a list
    const fallback = job.notes
      .split(new RegExp("[,\\n]"))
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token && token.length <= 40);
    return Array.from(new Set(fallback));
  }

  return Array.from(new Set(skills));
}

function contactMatchesSkills(contact: Contact, requiredSkills: string[]): boolean {
  if (!requiredSkills.length) return true;
  const contactSkills = (contact.skills || []).map((skill) => skill.toLowerCase());
  if (!contactSkills.length) return false;
  return requiredSkills.every((required) => contactSkills.includes(required));
}

const skillRequirementInputSchema = z.object({
  skill: z
    .string({ required_error: "Skill is required" })
    .trim()
    .min(1, "Skill is required"),
  headcount: z
    .coerce
    .number({ invalid_type_error: "Headcount must be a number" })
    .int("Headcount must be a whole number")
    .min(1, "Headcount must be at least 1"),
  notes: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) {
        return null;
      }
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }),
});

function parseSkillRequirementsInput(input: unknown) {
  const arrayInput = Array.isArray(input) ? input : [];
  return z.array(skillRequirementInputSchema).parse(arrayInput);
}

type SkillQuota = {
  key: string;
  label: string;
  required: number;
  remaining: number;
};

function normalizeSkillKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function deriveSkillQuotas(skillRequirements: JobSkillRequirement[]): SkillQuota[] {
  const quotaMap = new Map<string, SkillQuota>();
  const orderedQuotas: SkillQuota[] = [];

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
      const quota: SkillQuota = {
        key,
        label: requirement.skill?.trim() || requirement.skill || key,
        required: headcount,
        remaining: headcount,
      };
      quotaMap.set(key, quota);
      orderedQuotas.push(quota);
    }
  }

  return orderedQuotas;
}

function orderContactsBySkillPriority(
  prioritized: PrioritizedContact[],
  skillRequirements: JobSkillRequirement[],
): PrioritizedContact[] {
  if (!skillRequirements.length || !prioritized.length) {
    return prioritized;
  }

  const orderedQuotas = deriveSkillQuotas(skillRequirements);
  if (!orderedQuotas.length) {
    return prioritized;
  }

  const selected: PrioritizedContact[] = [];
  const usedContactIds = new Set<string>();

  const getContactSkillKeys = (contact: Contact): string[] =>
    (contact.skills ?? [])
      .map((skill) => normalizeSkillKey(skill))
      .filter((skill): skill is string => Boolean(skill));

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

function isWithinBlackout(contact: Contact, job: Job): boolean {
  if (!contact.blackoutPeriods || contact.blackoutPeriods.length === 0) return false;
  const jobStart = new Date(job.startTime);
  const jobEnd = new Date(job.endTime);

  return contact.blackoutPeriods.some((period) => {
    const range = parseBlackoutRange(period);
    if (!range) return false;
    return rangesOverlap(jobStart, jobEnd, range.start, range.end);
  });
}

async function hasScheduleConflict(
  contactId: string,
  job: Job,
  organizationId: string,
  jobCache: Map<string, Job>
): Promise<boolean> {
  const jobStart = new Date(job.startTime);
  const jobEnd = new Date(job.endTime);
  const availabilities = await storage.getAvailabilityByContact(contactId, organizationId);

  for (const record of availabilities) {
    if (!record || record.status !== "confirmed") continue;
    if (record.jobId === job.id) continue;
    const cached = jobCache.get(record.jobId);
    let otherJob: Job | undefined = cached;
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

async function prioritizeContacts(
  contactIds: string[],
  job: Job,
  organizationId: string
): Promise<PrioritizedContact[]> {
  const contacts = await storage.getContacts(organizationId);
  const candidates = contacts.filter((contact) => contactIds.includes(contact.id) && !contact.isOptedOut);

  if (!candidates.length) {
    return [];
  }

  const requiredSkills = jobSkills(job);
  const jobCache = new Map<string, Job>();
  const distanceMap = await getContactDistanceMap(job.location, candidates);

  const prioritised: PrioritizedContact[] = [];

  for (const contact of candidates) {
    const distanceMeters = distanceMap.get(contact.id) ?? Number.POSITIVE_INFINITY;

    console.log(`[Prioritization] Contact ${contact.firstName} ${contact.lastName} distance: ${distanceMeters}`);
    const hasValidDistance = Number.isFinite(distanceMeters);
    const matchesLocation = hasValidDistance
      ? distanceMeters <= DEFAULT_DISTANCE_THRESHOLD_METERS
      : locationMatches(contact, job);

    const withinBlackout = isWithinBlackout(contact, job);
    const conflicts = await hasScheduleConflict(contact.id, job, organizationId, jobCache);
    const skillsMatch = contactMatchesSkills(contact, requiredSkills);

    const meetsAllCriteria = matchesLocation && !withinBlackout && !conflicts && skillsMatch;
    const priorityScore =
      (matchesLocation ? 3 : 0) +
      (!withinBlackout ? 2 : 0) +
      (!conflicts ? 2 : 0) +
      (skillsMatch ? 3 : 0);

    prioritised.push({
      contact,
      priorityScore,
      meetsAllCriteria,
      distanceMeters,
    });
  }

  const sortByScoreThenDistance = (a: PrioritizedContact, b: PrioritizedContact) => {
    if (a.priorityScore !== b.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return a.distanceMeters - b.distanceMeters;
  };

  const primary = prioritised
    .filter((entry) => entry.meetsAllCriteria)
    .sort(sortByScoreThenDistance);

  const secondary = prioritised
    .filter((entry) => !entry.meetsAllCriteria)
    .sort((a, b) => {
      const distanceComparison = a.distanceMeters - b.distanceMeters;
      if (distanceComparison !== 0) {
        return distanceComparison;
      }
      return b.priorityScore - a.priorityScore;
    });

  return [...primary, ...secondary];
}

async function getConfirmedCount(jobId: string, organizationId: string): Promise<number> {
  const confirmed = await storage.getConfirmedContactsForJob(jobId, organizationId);
  return confirmed.length;
}

async function sendBatchMessages(
  batchContacts: Contact[],
  options: {
    job: Job;
    template?: Template; // Now optional - can use customMessage instead
    customMessage?: string; // Direct message content
    campaign: Campaign;
    organizationId: string;
    userId: string;
    jobId: string;
    twilioClient: any;
    fromNumber: string;
    rosterBaseUrl: string;
    batchId?: string; // For logging
  }
): Promise<number> {
  const {
    job,
    template,
    customMessage,
    campaign,
    organizationId,
    userId,
    jobId,
    twilioClient,
    fromNumber,
    rosterBaseUrl,
    batchId,
  } = options;

  let sentCount = 0;
  let batchPosition = 0;

  console.log(
    `[Messaging] Sending batch ${batchId || 'unknown'} for job ${job.id} (${job.name}) — contacts ${batchContacts
      .map((contact) => contact.id)
      .join(", ")} — using ${customMessage ? 'custom message' : `template: ${template?.name}`}`
  );

  for (const contact of batchContacts) {
    batchPosition++;
    const processingStartTime = Date.now();
    
    if (contact.isOptedOut) {
      console.log(`[Messaging] Skipping opted-out contact ${contact.id}`);
      continue;
    }

    // Only create/update availability records for job invitations (template-based only)
    // Check if template name indicates it's a job invitation
    const isJobInvitation = template?.name && 
      (template.name.toLowerCase().includes("invitation") || 
       template.name.toLowerCase().includes("job invitation") ||
       template.name.toLowerCase() === "job invitation");

    if (isJobInvitation) {
      const availabilityRecord = await storage.getAvailabilityForContact(jobId, contact.id, organizationId);
      if (!availabilityRecord) {
        await storage.createAvailability(organizationId, {
          jobId,
          contactId: contact.id,
          status: "no_reply",
          shiftPreference: null,
        });
      } else {
        await storage.updateAvailability(availabilityRecord.id, {
          status: "no_reply",
        });
      }
    }

    // Determine message content: custom message or template
    let messageContent: string;
    if (customMessage) {
      // Use custom message directly (can still apply basic substitutions)
      messageContent = customMessage
        .replace(/{{firstName}}/g, contact.firstName)
        .replace(/{{lastName}}/g, contact.lastName)
        .replace(/{{jobName}}/g, job.name)
        .replace(/{{jobLocation}}/g, job.location)
        .replace(/{{jobDate}}/g, format(new Date(job.startTime), "MMM d, yyyy"))
        .replace(/{{jobTime}}/g, format(new Date(job.startTime), "h:mm a"));
    } else if (template) {
      messageContent = renderTemplate(template.content, contact, job);
      
      if (template.includeRosterLink) {
        let rosterToken = contact.rosterToken;
        if (!rosterToken) {
          rosterToken = nanoid(32);
          await storage.updateContact(contact.id, { rosterToken });
        }

        const normalizedBase = rosterBaseUrl.replace(/\/$/, "");
        const rosterUrl = `${normalizedBase}/schedule/${rosterToken}`;
        messageContent += `\n\nView your weekly schedule: ${rosterUrl}`;
      }
    } else {
      console.error(`[Messaging] No template or custom message provided for contact ${contact.id}`);
      continue;
    }

    let status = "sent";
    let twilioSid: string | null = null;
    let errorMessage: string | null = null;
    const sentAt = new Date();

    // Log sms_attempted event
    await storage.createMessageLog({
      organizationId,
      jobId,
      campaignId: campaign.id,
      contactId: contact.id,
      eventType: "sms_attempted",
      channel: contact.hasLogin ? "portal" : "sms",
      status: "pending",
      batchId,
      batchPosition,
      scheduledAt: new Date(),
      metadata: JSON.stringify({ 
        phone: contact.phone, 
        hasLogin: contact.hasLogin,
        messageType: customMessage ? 'custom' : 'template',
        templateName: template?.name,
      }),
    });

    // If contact has login enabled, skip Twilio SMS and just create message in DB for portal
    if (contact.hasLogin) {
      console.log(
        `[Messaging] Contact ${contact.id} (${contact.firstName} ${contact.lastName}) has login enabled - creating message in portal only (no SMS)`
      );
      twilioSid = null; // No Twilio message sent
      status = "sent"; // Mark as sent since it's available in portal
    } else if (twilioClient && fromNumber) {
      try {
        const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
        const twilioMessage = await twilioClient.messages.create({
          body: messageContent,
          from: fromNumber,
          to: e164Phone,
        });
        twilioSid = twilioMessage.sid;
      } catch (error: any) {
        status = "failed";
        errorMessage = error?.message || "Twilio send failed";
      }
    } else {
      console.log(`[DEV MODE] Would send SMS to ${contact.phone}: ${messageContent}`);
      twilioSid = `dev-${Date.now()}`;
    }

    const processingTimeMs = Date.now() - processingStartTime;

    const message = await storage.createMessage(organizationId, userId, {
      contactId: contact.id,
      jobId,
      campaignId: campaign.id,
      direction: "outbound",
      content: messageContent,
      status,
      twilioSid,
    });

    // Log SMS or portal message events with enhanced details
    if (status === "sent") {
      // Only count and consume credits for contacts without login (actual SMS sent)
      if (!contact.hasLogin) {
        sentCount += 1;
        // Log sms_sent event with enhanced fields
        await storage.createMessageLog({
          organizationId,
          jobId,
          campaignId: campaign.id,
          contactId: contact.id,
          eventType: "sms_sent",
          channel: "sms",
          status: "success",
          messageId: message.id,
          twilioSid,
          batchId,
          batchPosition,
          sentAt,
          costCredits: 1,
          processingTimeMs,
          metadata: JSON.stringify({ 
            phone: contact.phone, 
            countryCode: contact.countryCode,
            messageType: customMessage ? 'custom' : 'template',
            templateName: template?.name,
          }),
        });
      } else {
        // Log portal message event
        await storage.createMessageLog({
          organizationId,
          jobId,
          campaignId: campaign.id,
          contactId: contact.id,
          eventType: "portal_message_created",
          channel: "portal",
          status: "success",
          messageId: message.id,
          batchId,
          batchPosition,
          sentAt,
          costCredits: 0,
          processingTimeMs,
          metadata: JSON.stringify({ 
            hasLogin: true,
            messageType: customMessage ? 'custom' : 'template',
            templateName: template?.name,
          }),
        });
      }

      // Mark invitation as invited in pool (only for job invitations)
      if (isJobInvitation) {
        await storage.markInvitationAsInvited(jobId, contact.id);
      }
      console.log(
        `[Messaging] Message ${contact.hasLogin ? 'created in portal' : 'sent'} to contact ${contact.id} (${contact.firstName} ${contact.lastName}) — campaign ${campaign.id} — batch ${batchId || 'n/a'} pos ${batchPosition} — ${processingTimeMs}ms`
      );
    } else {
      // Log sms_failed event with enhanced details
      await storage.createMessageLog({
        organizationId,
        jobId,
        campaignId: campaign.id,
        contactId: contact.id,
        eventType: "sms_failed",
        channel: "sms",
        status: "failed",
        messageId: message.id,
        errorMessage,
        batchId,
        batchPosition,
        failedAt: new Date(),
        processingTimeMs,
        metadata: JSON.stringify({ 
          phone: contact.phone, 
          countryCode: contact.countryCode,
          messageType: customMessage ? 'custom' : 'template',
          templateName: template?.name,
        }),
      });
      console.warn(
        `[Messaging] Failed to send message to contact ${contact.id} (${contact.firstName} ${contact.lastName}) — ${errorMessage}`
      );
    }
  }

  if (sentCount > 0) {
    await creditService.consumeCreditsForOrganization(
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

async function scheduleBatchedMessages(
  contacts: Contact[],
  options: {
    job: Job;
    template?: Template;
    customMessage?: string;
    campaign: Campaign;
    organizationId: string;
    userId: string;
    availableCredits: number;
    twilioClient: any;
    fromNumber: string;
    rosterBaseUrl: string;
  }
): Promise<void> {
  if (!contacts.length) {
    return;
  }

  let index = 0;
  let batchNumber = 0;
  let remainingCredits = options.availableCredits;
  const jobId = options.job.id;
  const requiredHeadcount = options.job.requiredHeadcount ?? null;

  const dispatchBatch = async (): Promise<void> => {
    if (remainingCredits <= 0) {
      return;
    }

    if (requiredHeadcount) {
      const confirmed = await getConfirmedCount(jobId, options.organizationId);
      if (confirmed >= requiredHeadcount) {
        return;
      }
    }

    batchNumber++;
    const batchId = `${options.campaign.id}-batch-${batchNumber}`;
    const allowedBatchSize = Math.min(MESSAGE_BATCH_SIZE, remainingCredits);
    const batch = contacts.slice(index, index + allowedBatchSize);
    if (!batch.length) {
      return;
    }

    // Log batch_created event
    console.log(`[Messaging] Creating batch ${batchId} with ${batch.length} contacts`);
    await storage.createMessageLog({
      organizationId: options.organizationId,
      jobId,
      campaignId: options.campaign.id,
      contactId: batch[0].id, // Use first contact as reference
      eventType: "batch_created",
      channel: "sms",
      status: "pending",
      batchId,
      scheduledAt: new Date(),
      metadata: JSON.stringify({
        batchNumber,
        batchSize: batch.length,
        totalContacts: contacts.length,
        remainingCredits,
        messageType: options.customMessage ? 'custom' : 'template',
      }),
    });

    const sent = await sendBatchMessages(batch, {
      job: options.job,
      template: options.template,
      customMessage: options.customMessage,
      campaign: options.campaign,
      organizationId: options.organizationId,
      userId: options.userId,
      jobId,
      twilioClient: options.twilioClient,
      fromNumber: options.fromNumber,
      rosterBaseUrl: options.rosterBaseUrl,
      batchId,
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

    if (index >= contacts.length) {
      return;
    }

    setTimeout(() => {
      dispatchBatch().catch((error) => console.error("Failed to send message batch", error));
    }, MESSAGE_BATCH_DELAY_MS);
  };

  await dispatchBatch();
}

async function sendRescheduleNotifications(
  organizationId: string,
  userId: string,
  job: Job,
  contacts: Contact[]
): Promise<number> {
  let deliveredCount = 0;
  try {
    if (!contacts.length) {
      return 0;
    }

    // Get Job Update template
    const templates = await storage.getTemplates(organizationId);
    const updateTemplate = templates.find(
      (t) => t.name.toLowerCase().trim() === "job update"
    );

    if (!updateTemplate) {
      console.error("[Reschedule] Job Update template not found");
      return 0;
    }

    // Get device tokens for contacts
    const contactIds = contacts.map(c => c.id);
    const deviceTokens = await storage.getDeviceTokensForContacts(contactIds);
    const contactsWithTokens = deviceTokens.map(dt => ({
      contactId: dt.contactId,
      token: dt.token,
      platform: dt.platform as "ios" | "android",
    }));

    // Send push notifications to contacts with device tokens
    let pushSuccessCount = 0;
    let pushFailedCount = 0;
    const contactsToSms = [...contacts];

    if (contactsWithTokens.length > 0) {
      const formattedDate = format(new Date(job.startTime), "MMM d, yyyy");
      const formattedTime = format(new Date(job.startTime), "h:mm a");
      const notificationTitle = "Job Updated";
      const notificationBody = `${job.name} has been updated. New time: ${formattedDate} at ${formattedTime}.`;

      const pushResult = await sendPushNotificationsToContacts(
        contactsWithTokens,
        {
          title: notificationTitle,
          body: notificationBody,
          data: {
            type: "job_update",
            jobId: job.id,
            action: "view_messages",
          },
        }
      );

      pushSuccessCount = pushResult.success.length;
      pushFailedCount = pushResult.failed.length;

      // Create delivery records and messages for successful push notifications
      const fallbackDueAt = new Date(Date.now() + 30000); // 30 seconds from now
      
      for (const { contactId, notificationId, token } of pushResult.notificationIds) {
        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
          const delivery = await storage.createPushNotificationDelivery({
            contactId,
            jobId: job.id,
            campaignId: null,
            organizationId,
            templateId: updateTemplate.id,
            customMessage: null,
            deviceToken: token,
            notificationId,
            status: "sent",
            fallbackDueAt,
            fallbackProcessed: false,
          });

          // Create message record
          const messageContent = renderTemplate(updateTemplate.content, contact, job);
          await storage.createMessage(organizationId, userId, {
            contactId,
            jobId: job.id,
            campaignId: null,
            direction: "outbound",
            content: messageContent,
            status: "sent",
            twilioSid: null,
          });

          // Log push_sent event
          await storage.createMessageLog({
            organizationId,
            jobId: job.id,
            campaignId: null,
            contactId,
            eventType: "push_sent",
            channel: "push",
            status: "success",
            notificationId,
            pushDeliveryId: delivery.id,
            scheduledAt: new Date(),
            sentAt: new Date(),
            metadata: JSON.stringify({ 
              platform: deviceTokens.find(dt => dt.contactId === contactId && dt.token === token)?.platform,
              deviceToken: token,
              fallbackDueAt: fallbackDueAt.toISOString(),
            }),
          });

          // Log sms_fallback_scheduled event
          await storage.createMessageLog({
            organizationId,
            jobId: job.id,
            campaignId: null,
            contactId,
            eventType: "sms_fallback_scheduled",
            channel: "sms",
            status: "pending",
            pushDeliveryId: delivery.id,
            scheduledAt: fallbackDueAt,
            metadata: JSON.stringify({ 
              fallbackDueAt: fallbackDueAt.toISOString(),
              reason: "Push notification sent, SMS fallback scheduled if not delivered",
            }),
          });
        }
      }

      // Remove contacts that successfully received push notifications from SMS list
      const pushSuccessSet = new Set(pushResult.success);
      contactsToSms.splice(0, contactsToSms.length, ...contacts.filter(contact => !pushSuccessSet.has(contact.id)));
    }

    // Send SMS to contacts without tokens or where push failed
    let twilioClient: any = null;
    let fromNumber = "";

    try {
      twilioClient = await getTwilioClient();
      fromNumber = await getTwilioFromPhoneNumber();
    } catch (error) {
      console.log("Twilio not configured, reschedule notifications will be logged only");
    }

    for (const contact of contactsToSms) {
      if (!contact || contact.isOptedOut) {
        continue;
      }

      const messageContent = renderTemplate(updateTemplate.content, contact, job);
      let status: string = "sent";
      let twilioSid: string | null = null;

      if (twilioClient && fromNumber) {
        try {
          const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
          const twilioMessage = await twilioClient.messages.create({
            body: messageContent,
            from: fromNumber,
            to: e164Phone,
          });
          twilioSid = twilioMessage.sid;
        } catch (error) {
          status = "failed";
          console.error("Failed to send reschedule notification:", error);
        }
      } else {
        twilioSid = `dev-${Date.now()}`;
        console.log(`[DEV MODE] Would send reschedule SMS to ${contact.phone}: ${messageContent}`);
      }

      await storage.createMessage(organizationId, userId, {
        contactId: contact.id,
        jobId: job.id,
        campaignId: null,
        direction: "outbound",
        content: messageContent,
        status,
        twilioSid,
      });

      if (status === "sent") {
        deliveredCount += 1;
      }
    }

    // Total delivered includes both push and SMS
    const totalDelivered = pushSuccessCount + deliveredCount;

    if (totalDelivered > 0) {
      // Only consume credits for SMS (push notifications don't consume credits)
      if (deliveredCount > 0) {
        await creditService.consumeCreditsForOrganization(
          organizationId,
          deliveredCount,
          `Reschedule notification for job ${job.id}`,
          null
        );
      }
    }

    console.log(`[Reschedule] Push notifications: ${pushSuccessCount} sent, ${pushFailedCount} failed. SMS: ${deliveredCount} sent.`);
  } catch (error) {
    console.error("Reschedule notification error:", error);
  }
  return deliveredCount;
}

async function getContactScheduleConflicts(
  job: Job,
  contacts: Contact[],
  organizationId: string
): Promise<
  Array<{
    contact: Contact;
    conflicts: Job[];
  }>
> {
  const jobStart = new Date(job.startTime);
  const jobEnd = new Date(job.endTime);
  const jobCache = new Map<string, Job>();
  const impacted: Array<{ contact: Contact; conflicts: Job[] }> = [];

  for (const contact of contacts) {
    const availabilities = await storage.getAvailabilityByContact(contact.id, organizationId);
    const conflictingJobs: Job[] = [];

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
        conflicts: conflictingJobs,
      });
    }
  }

  return impacted;
}

async function notifyJobCancellation(
  job: Job,
  organizationId: string,
  userId: string,
  contacts: Contact[]
): Promise<number> {
  let deliveredCount = 0;
  try {
    if (!contacts.length) {
      return 0;
    }

    // Get Job Cancellation template
    const templates = await storage.getTemplates(organizationId);
    const cancellationTemplate = templates.find(
      (t) => t.name.toLowerCase().trim() === "job cancellation"
    );

    if (!cancellationTemplate) {
      console.error("[Cancellation] Job Cancellation template not found");
      return 0;
    }

    // Get device tokens for contacts
    const contactIds = contacts.map(c => c.id);
    const deviceTokens = await storage.getDeviceTokensForContacts(contactIds);
    const contactsWithTokens = deviceTokens.map(dt => ({
      contactId: dt.contactId,
      token: dt.token,
      platform: dt.platform as "ios" | "android",
    }));

    // Send push notifications to contacts with device tokens
    let pushSuccessCount = 0;
    let pushFailedCount = 0;
    const contactsToSms = [...contacts];

    if (contactsWithTokens.length > 0) {
      const formattedDate = format(new Date(job.startTime), "MMM d, yyyy");
      const formattedTime = format(new Date(job.startTime), "h:mm a");
      const notificationTitle = "Job Cancelled";
      const notificationBody = `${job.name} scheduled for ${formattedDate} at ${formattedTime} has been cancelled.`;

      const pushResult = await sendPushNotificationsToContacts(
        contactsWithTokens,
        {
          title: notificationTitle,
          body: notificationBody,
          data: {
            type: "job_cancellation",
            jobId: job.id,
            action: "view_messages",
          },
        }
      );

      pushSuccessCount = pushResult.success.length;
      pushFailedCount = pushResult.failed.length;

      // Create delivery records and messages for successful push notifications
      const fallbackDueAt = new Date(Date.now() + 30000); // 30 seconds from now
      
      for (const { contactId, notificationId, token } of pushResult.notificationIds) {
        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
          const delivery = await storage.createPushNotificationDelivery({
            contactId,
            jobId: job.id,
            campaignId: null,
            organizationId,
            templateId: cancellationTemplate.id,
            customMessage: null,
            deviceToken: token,
            notificationId,
            status: "sent",
            fallbackDueAt,
            fallbackProcessed: false,
          });

          // Create message record
          const messageContent = renderTemplate(cancellationTemplate.content, contact, job);
          await storage.createMessage(organizationId, userId, {
            contactId,
            jobId: job.id,
            campaignId: null,
            direction: "outbound",
            content: messageContent,
            status: "sent",
            twilioSid: null,
          });

          // Log push_sent event
          await storage.createMessageLog({
            organizationId,
            jobId: job.id,
            campaignId: null,
            contactId,
            eventType: "push_sent",
            channel: "push",
            status: "success",
            notificationId,
            pushDeliveryId: delivery.id,
            scheduledAt: new Date(),
            sentAt: new Date(),
            metadata: JSON.stringify({ 
              platform: deviceTokens.find(dt => dt.contactId === contactId && dt.token === token)?.platform,
              deviceToken: token,
              fallbackDueAt: fallbackDueAt.toISOString(),
            }),
          });

          // Log sms_fallback_scheduled event
          await storage.createMessageLog({
            organizationId,
            jobId: job.id,
            campaignId: null,
            contactId,
            eventType: "sms_fallback_scheduled",
            channel: "sms",
            status: "pending",
            pushDeliveryId: delivery.id,
            scheduledAt: fallbackDueAt,
            metadata: JSON.stringify({ 
              fallbackDueAt: fallbackDueAt.toISOString(),
              reason: "Push notification sent, SMS fallback scheduled if not delivered",
            }),
          });
        }
      }

      // Remove contacts that successfully received push notifications from SMS list
      const pushSuccessSet = new Set(pushResult.success);
      contactsToSms.splice(0, contactsToSms.length, ...contacts.filter(contact => !pushSuccessSet.has(contact.id)));
    }

    // Send SMS to contacts without tokens or where push failed
    let twilioClient: any = null;
    let fromNumber = "";

    try {
      twilioClient = await getTwilioClient();
      fromNumber = await getTwilioFromPhoneNumber();
    } catch (error) {
      console.log("Twilio not configured, cancellation notifications will be logged only");
    }

    for (const contact of contactsToSms) {
      if (!contact || contact.isOptedOut) {
        continue;
      }

      const messageContent = renderTemplate(cancellationTemplate.content, contact, job);
      let status: string = "sent";
      let twilioSid: string | null = null;

      if (twilioClient && fromNumber) {
        try {
          const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
          const twilioMessage = await twilioClient.messages.create({
            body: messageContent,
            from: fromNumber,
            to: e164Phone,
          });
          twilioSid = twilioMessage.sid;
        } catch (error) {
          status = "failed";
          console.error("Failed to send cancellation notification:", error);
        }
      } else {
        twilioSid = `dev-${Date.now()}`;
        console.log(`[DEV MODE] Would send cancellation SMS to ${contact.phone}: ${messageContent}`);
      }

      await storage.createMessage(organizationId, userId, {
        contactId: contact.id,
        jobId: job.id,
        campaignId: null,
        direction: "outbound",
        content: messageContent,
        status,
        twilioSid,
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

    // Total delivered includes both push and SMS
    const totalDelivered = pushSuccessCount + deliveredCount;

    if (totalDelivered > 0) {
      // Only consume credits for SMS (push notifications don't consume credits)
      if (deliveredCount > 0) {
        await creditService.consumeCreditsForOrganization(
          organizationId,
          deliveredCount,
          `Cancellation notification for job ${job.id}`,
          null
        );
      }
    }

    console.log(`[Cancellation] Push notifications: ${pushSuccessCount} sent, ${pushFailedCount} failed. SMS: ${deliveredCount} sent.`);
  } catch (error) {
    console.error("Cancellation notification error:", error);
  }
  return deliveredCount;
}

/**
 * Generate recurring job instances based on recurrence pattern
 * Pattern format: {type: "daily"|"weekly"|"monthly", interval: number, daysOfWeek?: number[], endDate?: string}
 */
async function generateRecurringJobs(
  parentJob: Job,
  pattern: any,
  organizationId: string,
  userId: string,
  skillRequirements: InsertJobSkillRequirement[]
): Promise<Job[]> {
  const generatedJobs: Job[] = [];
  
  if (!pattern || !pattern.type) {
    return generatedJobs;
  }

  const startDate = new Date(parentJob.startTime);
  const endDate = pattern.endDate ? new Date(pattern.endDate) : null;
  const interval = pattern.interval || 1;
  const duration = parentJob.endTime.getTime() - parentJob.startTime.getTime();
  
  let currentDate = new Date(startDate);
  let sequence = 1;
  
  // Maximum 1000 instances to prevent runaway generation
  const maxInstances = 1000;
  
  while (generatedJobs.length < maxInstances) {
    // Check if we've passed the end date
    if (endDate && isAfter(currentDate, endDate)) {
      break;
    }
    
    // Skip the parent job (first instance)
    if (currentDate.getTime() === startDate.getTime()) {
      currentDate = getNextOccurrence(currentDate, pattern, interval);
      continue;
    }
    
    const newStartTime = new Date(currentDate);
    const newEndTime = new Date(newStartTime.getTime() + duration);
    
    // Create child job
    const childJobData: any = {
      name: parentJob.name,
      location: parentJob.location,
      startTime: newStartTime,
      endTime: newEndTime,
      requiredHeadcount: parentJob.requiredHeadcount,
      notes: parentJob.notes,
    };
    if (parentJob.departmentId) {
      childJobData.departmentId = parentJob.departmentId;
    }
    if (parentJob.id) {
      childJobData.parentJobId = parentJob.id;
    }
    if (sequence) {
      childJobData.recurrenceSequence = sequence;
    }
    const childJob = await storage.createJob(organizationId, userId, childJobData);
    
    // Copy skill requirements
    if (skillRequirements.length > 0) {
      await storage.replaceJobSkillRequirements(
        childJob.id,
        skillRequirements.map((req) => ({
          ...req,
          jobId: childJob.id,
        })),
      );
    }
    
    generatedJobs.push(childJob);
    sequence++;
    
    // Calculate next occurrence
    currentDate = getNextOccurrence(currentDate, pattern, interval);
    
    // Safety check: if next occurrence is same or earlier, break to prevent infinite loop
    if (currentDate.getTime() <= newStartTime.getTime()) {
      break;
    }
  }
  
  return generatedJobs;
}

/**
 * Get the next occurrence date based on recurrence pattern
 */
function getNextOccurrence(currentDate: Date, pattern: any, interval: number): Date {
  switch (pattern.type) {
    case "daily":
      return addDays(currentDate, interval);
    
    case "weekly":
      if (pattern.daysOfWeek && Array.isArray(pattern.daysOfWeek) && pattern.daysOfWeek.length > 0) {
        // For weekly with specific days, find next matching day
        const currentDay = getDay(currentDate); // 0 = Sunday, 1 = Monday, etc.
        const sortedDays = [...pattern.daysOfWeek].sort((a, b) => a - b);
        
        // Find next day in this week
        const nextDayThisWeek = sortedDays.find((day) => day > currentDay);
        if (nextDayThisWeek !== undefined) {
          const daysToAdd = nextDayThisWeek - currentDay;
          return addDays(currentDate, daysToAdd);
        }
        
        // If no day found this week, go to first day of next week cycle
        const firstDayNextWeek = sortedDays[0];
        const daysToFirstDay = 7 - currentDay + firstDayNextWeek + (interval - 1) * 7;
        return addDays(currentDate, daysToFirstDay);
      } else {
        // No specific days, just add weeks
        return addWeeks(currentDate, interval);
      }
    
    case "monthly":
      return addMonths(currentDate, interval);
    
    default:
      // Default to daily if unknown type
      return addDays(currentDate, interval);
  }
}

async function checkAndNotifyJobFulfillment(job: Job, organizationId: string): Promise<void> {
  if (!job.requiredHeadcount || job.requiredHeadcount <= 0) {
    return;
  }

  const confirmed = await storage.getConfirmedContactsForJob(job.id, organizationId);
  if (confirmed.length < job.requiredHeadcount) {
    return;
  }

  const availabilityRecords = await storage.getAvailability(job.id, organizationId);
  const pending = availabilityRecords.filter((record) =>
    record.status === "no_reply" || record.status === "maybe" || record.status === "pending"
  );

  if (!pending.length) {
    return;
  }

  const pendingContacts: Contact[] = [];
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
    pending.map((record) =>
      storage.updateAvailability(record.id, {
        status: "declined",
      })
    )
  );
}

async function sendJobFulfilledNotifications(job: Job, contacts: Contact[], organizationId: string): Promise<void> {
  try {
    if (!contacts.length) {
      return;
    }

    let twilioClient: any = null;
    let fromNumber = "";

    try {
      twilioClient = await getTwilioClient();
      fromNumber = await getTwilioFromPhoneNumber();
    } catch (error) {
      console.log("Twilio not configured, fulfillment notifications will be logged only");
    }

    const jobDate = new Date(job.startTime).toLocaleString();

    let deliveredCount = 0;

    for (const contact of contacts) {
      if (!contact || contact.isOptedOut) {
        continue;
      }

      const message = `Thanks for your response, ${contact.firstName}. The positions for ${job.name} on ${jobDate} have now been filled. We'll contact you about future opportunities.`;

      let status: string = "sent";
      let twilioSid: string | null = null;

      if (twilioClient && fromNumber) {
        try {
          const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
          const twilioMessage = await twilioClient.messages.create({
            body: message,
            from: fromNumber,
            to: e164Phone,
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
        twilioSid,
      });

      if (status === "sent") {
        deliveredCount += 1;
      }
    }

    if (deliveredCount > 0) {
      await creditService.consumeCreditsForOrganization(
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

// Placeholder for calendar sync - currently uses .ics file downloads instead
async function syncJobToCalendars(userId: string, job: any): Promise<void> {
  // Calendar integration is done via downloadable .ics files
  // No automatic syncing needed
  return Promise.resolve();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve Apple App Site Association file for Universal Links
  // Must be before other routes to ensure proper routing
  app.get('/.well-known/apple-app-site-association', (req, res, next) => {
    const aasaPath = path.join(process.cwd(), 'server', 'public', '.well-known', 'apple-app-site-association');
    
    // Set Content-Type header explicitly
    res.setHeader('Content-Type', 'application/json');
    
    // Send file and ensure response ends
    res.sendFile(aasaPath, (err) => {
      if (err) {
        console.error('Error serving AASA file:', err);
        res.status(404).json({ error: 'AASA file not found' });
      }
      // Response is automatically ended by sendFile, so don't call next()
    });
  });

  // Public log endpoint for client-side error logging
  app.post('/log', express.json(), async (req, res) => {
    try {
      const { message, level = 'error', metadata = {} } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      const fs = await import('fs/promises');
      const logsDir = path.join(process.cwd(), 'logs');
      const logFileName = `app-errors-${new Date().toISOString().split('T')[0]}.log`;
      const logFilePath = path.join(logsDir, logFileName);

      // Create logs directory if it doesn't exist
      try {
        await fs.mkdir(logsDir, { recursive: true });
      } catch (err: any) {
        if (err.code !== 'EEXIST') {
          console.error('Failed to create logs directory:', err);
        }
      }

      // Format log entry
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        message,
        metadata: {
          ...metadata,
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        },
      };

      // Append to log file
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(logFilePath, logLine, 'utf8');

      // Also log to console for immediate visibility
      console.log(`[Client ${level.toUpperCase()}]`, message, metadata);
      
      res.json({ success: true, logged: true });
    } catch (error: any) {
      console.error('Error writing to log file:', error);
      res.status(500).json({ error: 'Failed to log message' });
      }
  });
  
  // Serve static files from attached_assets
  app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets')));
  
  // Auth routes
  app.use("/api/auth", authRoutes);

    // Mobile auth routes (mobile apps - uses userId header)
  app.use("/api/mobile/auth", mobileAuthRoutes);
  
  async function ensureDefaultPlatformAdmin(): Promise<void> {
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

      const hashedPassword = await bcrypt.hash("Nadeem123#!", 10);
      await storage.createAdminUser({
        name: "Nadeem Mohammed",
        email: defaultEmail,
        password: hashedPassword,
      });
    } catch (error) {
      console.error("Failed to ensure default platform admin", error);
    }
  }

  const sanitizeAdmin = (admin: AdminUser) => {
    const { password, ...safeAdmin } = admin;
    return safeAdmin;
  };

  await ensureDefaultPlatformAdmin();
  
  const JWT_SECRET = process.env.MOBILE_JWT_SECRET || process.env.SESSION_SECRET || "dev-mobile-jwt";
  const getAuthToken = (req: any): string | null => {
    const auth = req.headers?.authorization;
    if (auth && typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7);
    const headerToken = req.headers?.["x-access-token"];
    if (headerToken && typeof headerToken === "string") return headerToken;
    return null;
  };
  
  // Middleware to check authentication
  const requireAuth = async (req:any, res:any, next:any) => {
    try {
      // 1. Normal session check (browser)
      if (req.session?.userId) {
        const user = await storage.getUser(req.session.userId);
        if (!user) return res.status(401).json({ message: "User not found" });
        req.user = user;
        return next();
      }
      // 2. JWT (mobile apps)
      const bearer = getAuthToken(req);
      if (bearer) {
        try {
          const decoded = jwt.verify(bearer, JWT_SECRET) as any;
          if (decoded?.type === "user" && decoded?.id) {
            const user = await storage.getUser(decoded.id);
            if (!user) return res.status(401).json({ message: "User not found" });
            req.user = user;
            req.userId = decoded.id;
            return next();
          }
        } catch {
          // fall through
        }
      }
      // 3. Check for X-User-ID header (legacy mobile)
      const userId = req.headers['x-user-id'] as string;
      if (userId) {
        const user = await storage.getUser(userId);
        if (!user) return res.status(401).json({ message: "User not found" });
        req.user = user;
        req.userId = userId; // Set for consistency
        return next();
      }
      // 4. Fallback for native apps (Capacitor manually sends cookie)
      const rawCookie = req.headers.cookie;
      if (rawCookie) {
        const match = rawCookie.match(/connect\.sid=([^;]+)/);
        if (match) {
          const sid = match[1];
  
          // Try restoring session
          req.sessionID = sid;
          req.sessionStore.get(sid, async (err:any, session:any) => {
            if (!session || !session.userId) {
              return res.status(401).json({ message: "Not authenticated" });
            }
  
            const user = await storage.getUser(session.userId);
            if (!user) return res.status(401).json({ message: "User not found" });
  
            req.session = session;
            req.user = user;
  
            return next();
          });
  
          return; // Important
        }
      }
  
      // 5. If no session at all
      return res.status(401).json({ message: "Not authenticated" });
  
    } catch (err) {
      console.error("Auth middleware error:", err);
      return res.status(500).json({ message: "Internal error" });
    }
  };

  // Middleware to check contact authentication
  const requireContactAuth = async (req: any, res: any, next: any) => {
    try {
      // Debug logging to inspect incoming auth headers (tokens truncated)
      const authHeader = typeof req.headers?.authorization === "string" ? req.headers.authorization.slice(0, 24) + "..." : undefined;
      const xAccessToken = typeof req.headers?.["x-access-token"] === "string" ? (req.headers["x-access-token"] as string).slice(0, 24) + "..." : undefined;
      const xContactId = req.headers?.["x-contact-id"];
      const hasCookie = Boolean(req.headers?.cookie);
      console.log("[ContactAuth] incoming headers", { authHeader, xAccessToken, xContactId, hasCookie });

      // 1. JWT (mobile apps)
      const bearer = getAuthToken(req);
      if (bearer) {
        try {
          const decoded = jwt.verify(bearer, JWT_SECRET) as any;
          if (decoded?.type === "contact" && decoded?.id) {
            const contact = await storage.getContactById(decoded.id);
            if (!contact) return res.status(401).json({ message: "Contact not found" });
            if (!contact.hasLogin) return res.status(401).json({ message: "Contact login not enabled" });
            req.contact = contact;
            req.contactId = decoded.id;
            return next();
          }
          if (decoded?.type === "user" && decoded?.id) {
            const user = await storage.getUser(decoded.id);
            if (user) {
              req.user = user;
              req.userId = decoded.id;
            }
          }
        } catch {
          // fall through
        }
      }

      // 2. Check for X-Contact-ID header (legacy mobile)
      const contactId = req.headers['x-contact-id'] as string;
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

      // 3. Normal session check (browser)
      if (req.session?.contactId) {
        const contact = await storage.getContactById(req.session.contactId);
        if (!contact) return res.status(401).json({ message: "Contact not found" });
        req.contact = contact;
        return next();
      }

      // 4. Fallback for native apps (Capacitor manually sends cookie)
      const rawCookie = req.headers.cookie;
      if (rawCookie) {
        const match = rawCookie.match(/connect\.sid=([^;]+)/);
        if (match) {
          const sid = match[1];
          req.sessionID = sid;
          req.sessionStore.get(sid, async (err: any, session: any) => {
            if (!session || !session.contactId) {
              return res.status(401).json({ message: "Not authenticated" });
            }

            const contact = await storage.getContactById(session.contactId);
            if (!contact) return res.status(401).json({ message: "Contact not found" });

            req.session = session;
            req.contact = contact;
            return next();
          });
          return;
        }
      }

      // 5. If no authentication method found
      return res.status(401).json({ message: "Not authenticated" });

    } catch (err) {
      console.error("Contact auth middleware error:", err);
      return res.status(500).json({ message: "Internal error" });
    }
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
      if (error instanceof z.ZodError) {
        const message = error.errors?.map((issue) => issue.message).join(", ") || "Invalid job data";
        return res.status(400).json({ message });
      }
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
      if (error instanceof z.ZodError) {
        const message = error.errors?.map((issue) => issue.message).join(", ") || "Invalid job data";
        return res.status(400).json({ message });
      }
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
      
      // Get organization details
      const organization = await storage.getOrganization(req.user.organizationId);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }
      
      // Generate a temporary password
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
      } as any);
      
      // Get inviting user's name
      const invitedByName = req.user.firstName && req.user.lastName 
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.username || req.user.email;
      
      // Send invitation email
      const loginUrl = `${req.protocol}://${req.get('host')}/auth`;
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
        console.error('Failed to send team invitation email:', emailError);
        // Continue even if email fails, but log the error
      }
      
      // Don't return password hash or temporary password
      const { password, ...safeUser } = newUser;
      res.json(safeUser);
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
      await storage.updateUser(userId, { organizationId: null } as any);
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Department endpoints
  app.get("/api/departments", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const departments = await storage.getDepartmentsByOrganization(req.user.organizationId);
      res.json(departments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/departments", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const { name, description, address } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Department name is required" });
      }
      const department = await storage.createDepartment(req.user.organizationId, { name, description: description || null, address: address || null });
      res.json(department);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/departments/:id", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const department = await storage.getDepartmentById(req.params.id, req.user.organizationId);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      res.json(department);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/departments/:id", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const { name, description, address } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (address !== undefined) updates.address = address;
      const department = await storage.updateDepartment(req.params.id, req.user.organizationId, updates);
      res.json(department);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/departments/:id", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      await storage.deleteDepartment(req.params.id, req.user.organizationId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/departments/:id/contacts/:contactId", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const { id: departmentId, contactId } = req.params;
      const assignment = await storage.assignContactToDepartment(contactId, departmentId, req.user.organizationId);
      res.json(assignment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/departments/:id/contacts/:contactId", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const { id: departmentId, contactId } = req.params;
      await storage.removeContactFromDepartment(contactId, departmentId, req.user.organizationId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/departments/:id/contacts", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const contacts = await storage.getContactsByDepartment(req.params.id, req.user.organizationId);
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/departments/:id/jobs", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const jobs = await storage.getJobsByDepartment(req.params.id, req.user.organizationId);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Recent cancellations for dashboard
  app.get("/api/cancellations/recent", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const cancellations = await storage.getRecentCancellations(req.user.organizationId, 5);
      res.json(cancellations);
    } catch (error: any) {
      console.error("Get cancellations error:", error);
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
      
      // Send email notification to recipient
      const loginUrl = `${req.protocol}://${req.get('host')}/auth`;
      const senderName = req.user.firstName && req.user.lastName 
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.username;
      
      try {
        await sendTeamMessageNotification(
          recipient.email,
          senderName,
          content,
          loginUrl
        );
        console.log(`Team message notification email sent to ${recipient.email}`);
      } catch (emailError) {
        console.error('Failed to send team message notification email:', emailError);
        // Continue anyway - the message intent has been conveyed
      }
      
      res.json({ 
        success: true,
        message: "Message sent successfully",
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
  
  app.get("/api/jobs", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      
      // Support departmentId filter
      const departmentId = req.query.departmentId as string | undefined;
      let jobs: Job[];
      if (departmentId) {
        jobs = await storage.getJobsByDepartment(departmentId, req.user.organizationId);
      } else {
        jobs = await storage.getJobs(req.user.organizationId);
      }
      const jobsWithAvailability = await Promise.all(
        jobs.map(async (job) => {
          const [availability, skillRequirements] = await Promise.all([
            storage.getAvailability(job.id, req.user.organizationId),
            storage.getJobSkillRequirements(job.id),
          ]);

          return {
            ...job,
            skillRequirements,
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

  app.get("/api/skills/availability", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }

      const contacts = await storage.getContacts(req.user.organizationId);

      const normalizedContacts = contacts.map((contact) => {
        const uniqueSkills = Array.from(
          new Set((contact.skills || []).map((skill) => skill.trim()).filter(Boolean)),
        );
        const available = contact.status === "free" && !contact.isOptedOut;

        return {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          status: contact.status,
          available,
          isOptedOut: contact.isOptedOut,
          skills: uniqueSkills,
        };
      });

      const skillsMap = new Map<
        string,
        { skill: string; totalCount: number; availableCount: number }
      >();

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
              availableCount: contact.available ? 1 : 0,
            });
          }
        }
      }

      const skillSummary = Array.from(skillsMap.values()).sort((a, b) =>
        a.skill.localeCompare(b.skill),
      );

      res.json({
        contacts: normalizedContacts,
        skills: skillSummary,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/jobs/:id", requireAuth, async (req: any, res) => {
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/jobs/:id/roster", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }

      const organizationId = req.user.organizationId; 
      const job = await storage.getJob(req.params.id);

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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/jobs/:id/message-logs", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }

      const jobId = req.params.id;
      const organizationId = req.user.organizationId;

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Get all message logs for this job
      const logs = await storage.getMessageLogsForJob(jobId, organizationId);

      // Get all unique contacts from logs
      const contactIds = [...new Set(logs.map(log => log.contactId))];
      const contacts = await Promise.all(
        contactIds.map(id => storage.getContact(id, organizationId))
      );
      const contactMap = new Map(contacts.filter(c => c).map(c => [c!.id, c!]));

      // Aggregate logs by contact to create simplified view
      const contactSummaries = contactIds.map(contactId => {
        const contact = contactMap.get(contactId);
        if (!contact) return null;

        const contactLogs = logs.filter(log => log.contactId === contactId);
        
        // Determine channel (push, sms, or portal)
        const pushLogs = contactLogs.filter(log => log.channel === "push");
        const smsLogs = contactLogs.filter(log => log.channel === "sms");
        const portalLogs = contactLogs.filter(log => log.channel === "portal");
        
        let channel: "push" | "sms" | "portal" = "sms";
        if (pushLogs.length > 0) {
          channel = "push";
        } else if (portalLogs.length > 0) {
          channel = "portal";
        }

        // Check notification status
        const pushSent = pushLogs.some(log => log.eventType === "push_sent");
        const pushDelivered = pushLogs.some(log => log.eventType === "push_delivered");
        const smsSent = smsLogs.some(log => log.eventType === "sms_sent");
        const smsFallback = smsLogs.some(log => log.eventType === "sms_fallback");
        
        const notificationSent = pushSent || smsSent || portalLogs.some(log => log.eventType === "sms_sent");
        const notificationDelivered = pushDelivered || smsSent || smsFallback || portalLogs.some(log => log.eventType === "sms_sent");

        // Get response status
        const responseLog = contactLogs.find(log => log.eventType === "response_received");
        let responseStatus: "accepted" | "declined" | "no_response" | null = null;
        if (responseLog) {
          responseStatus = responseLog.responseStatus === "accepted" ? "accepted" : 
                          responseLog.responseStatus === "declined" ? "declined" : null;
        } else {
          // Check availability status to determine if no response
          const hasNoResponseLog = contactLogs.some(log => log.eventType === "no_response");
          if (hasNoResponseLog || (!responseLog && notificationSent)) {
            responseStatus = "no_response";
          }
        }

        // Get last event timestamp
        const lastEvent = contactLogs.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        return {
          contactId: contact.id,
          contactName: `${contact.firstName} ${contact.lastName}`,
          channel,
          notificationSent,
          notificationDelivered,
          responseStatus,
          lastEventAt: lastEvent?.createdAt || null,
          events: contactLogs,
        };
      }).filter((summary): summary is NonNullable<typeof summary> => summary !== null);

      // Sort by last event time (most recent first)
      contactSummaries.sort((a, b) => {
        if (!a.lastEventAt && !b.lastEventAt) return 0;
        if (!a.lastEventAt) return 1;
        if (!b.lastEventAt) return -1;
        return new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime();
      });

      res.json({
        jobId,
        contacts: contactSummaries,
        summary: {
          total: contactSummaries.length,
          contacted: contactSummaries.filter(c => c.notificationSent).length,
          delivered: contactSummaries.filter(c => c.notificationDelivered).length,
          responded: contactSummaries.filter(c => c.responseStatus && c.responseStatus !== "no_response").length,
          accepted: contactSummaries.filter(c => c.responseStatus === "accepted").length,
          declined: contactSummaries.filter(c => c.responseStatus === "declined").length,
          noResponse: contactSummaries.filter(c => c.responseStatus === "no_response").length,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/jobs", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const bodyWithDates = {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
      };
      const { skillRequirements: skillRequirementsInput, recurrencePattern, ...jobPayload } = bodyWithDates;
      const parsedSkillRequirements = parseSkillRequirementsInput(skillRequirementsInput);
      
      // Parse recurrence pattern if provided
      let parsedRecurrencePattern: any = null;
      if (recurrencePattern) {
        if (typeof recurrencePattern === "string") {
          parsedRecurrencePattern = JSON.parse(recurrencePattern);
        } else {
          parsedRecurrencePattern = recurrencePattern;
        }
      }
      
      // Set isRecurring flag if pattern is provided
      const jobData = {
        ...jobPayload,
        isRecurring: !!parsedRecurrencePattern,
        recurrencePattern: parsedRecurrencePattern ? JSON.stringify(parsedRecurrencePattern) : null,
      };
      
      const validated = insertJobSchema.parse(jobData);
      const parentJob = await storage.createJob(req.user.organizationId, req.user.id, validated);

      const skillRequirements = await storage.replaceJobSkillRequirements(
        parentJob.id,
        parsedSkillRequirements.map((requirement) => ({
          ...requirement,
          jobId: parentJob.id,
        })),
      );

      await syncJobToCalendars(req.user.id, parentJob);

      // Generate recurring jobs if pattern provided
      let generatedJobs: Job[] = [];
      if (parsedRecurrencePattern) {
        generatedJobs = await generateRecurringJobs(
          parentJob,
          parsedRecurrencePattern,
          req.user.organizationId,
          req.user.id,
          parsedSkillRequirements
        );
      }

      res.json({ ...parentJob, skillRequirements, generatedJobsCount: generatedJobs.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/jobs/:id", requireAuth, async (req: any, res) => {
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
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
      };
      const { skillRequirements: skillRequirementsInput, ...jobPayload } = bodyWithDates;
      const validated = insertJobSchema.partial().parse(jobPayload);
      const job = await storage.updateJob(req.params.id, validated);

      await syncJobToCalendars(req.user.id, job);

      let skillRequirements;
      if (skillRequirementsInput !== undefined) {
        const parsedSkillRequirements = parseSkillRequirementsInput(skillRequirementsInput);
        skillRequirements = await storage.replaceJobSkillRequirements(
          job.id,
          parsedSkillRequirements.map((requirement) => ({
            ...requirement,
            jobId: job.id,
          })),
        );
      } else {
        skillRequirements = await storage.getJobSkillRequirements(job.id);
      }

      const availabilityRecords = await storage.getAvailability(job.id, req.user.organizationId);
      const confirmedContacts = (
        await Promise.all(
          availabilityRecords
            .filter((record) => record.status === "confirmed")
            .map((record) => storage.getContact(record.contactId, req.user.organizationId))
        )
      ).filter((contact): contact is Contact => Boolean(contact));

      const timeChanged =
        existingJob.startTime.getTime() !== job.startTime.getTime() ||
        existingJob.endTime.getTime() !== job.endTime.getTime();
      const locationChanged = existingJob.location !== job.location;

      let rescheduleNotified = 0;
      let conflictReport: Array<{ contact: Contact; conflicts: Job[] }> = [];
      let removedContactsCount = 0;
      let replacementInvitesSent = 0;

      if (confirmedContacts.length && (timeChanged || locationChanged)) {
        // Check for conflicts with the new schedule
        conflictReport = await getContactScheduleConflicts(
          job,
          confirmedContacts,
          req.user.organizationId
        );

        const conflictedContactIds = new Set(conflictReport.map((entry) => entry.contact.id));
        const availableContacts = confirmedContacts.filter(
          (contact) => !conflictedContactIds.has(contact.id)
        );

        // Remove conflicted contacts from the job
        for (const entry of conflictReport) {
          const availabilityRecord = availabilityRecords.find(
            (record) => record.contactId === entry.contact.id
          );
          if (availabilityRecord) {
            await storage.updateAvailability(availabilityRecord.id, {
              status: "declined",
            });
            await storage.updateContact(entry.contact.id, { status: "free" });
            removedContactsCount += 1;
          }
        }

        // Send reschedule notifications to available contacts
        if (availableContacts.length > 0) {
          rescheduleNotified = await sendRescheduleNotifications(
            req.user.organizationId,
            req.user.id,
            job,
            availableContacts
          );
        }

        // If contacts were removed and job has required headcount, send replacement invites
        if (removedContactsCount > 0 && job.requiredHeadcount) {
          const remainingConfirmed = await storage.getConfirmedContactsForJob(
            job.id,
            req.user.organizationId
          );
          const needed = job.requiredHeadcount - remainingConfirmed.length;

          if (needed > 0) {
            // Find available contacts who haven't been confirmed yet
            // Only exclude contacts with status "confirmed" - others (declined, maybe, no_reply) can be invited again
            const allContacts = await storage.getContacts(req.user.organizationId);
            const confirmedContactIds = new Set(
              availabilityRecords
                .filter((record) => record.status === "confirmed")
                .map((record) => record.contactId)
            );

            
            const uninvitedContacts = allContacts.filter(
              (contact) => !confirmedContactIds.has(contact.id) && !contact.isOptedOut
            );

            if (uninvitedContacts.length > 0) {
              // Get default template or first available template
              const templates = await storage.getTemplates(req.user.organizationId);
              const defaultTemplate = templates.find((t) => t.content.includes("{{jobName}}"));

              if (defaultTemplate) {
                const skillRequirements = await storage.getJobSkillRequirements(job.id);
                const jobWithSkills: JobWithSkillRequirements = {
                  ...job,
                  skillRequirements,
                };

                const campaign = await storage.createCampaign(
                  req.user.organizationId,
                  req.user.id,
                  {
                    jobId: job.id,
                    templateId: defaultTemplate.id,
                  }
                );

                let twilioClient: any = null;
                let fromNumber: string = "";

                try {
                  twilioClient = await getTwilioClient();
                  fromNumber = await getTwilioFromPhoneNumber();
                } catch (error) {
                  console.log("Twilio not configured, messages will be logged only");
                }

                const availableCredits = await creditService.getAvailableCreditsForOrganization(
                  req.user.organizationId
                );

                const contactIds = uninvitedContacts.map((c) => c.id);
                const prioritized = await prioritizeContacts(
                  contactIds,
                  jobWithSkills,
                  req.user.organizationId
                );

                if (prioritized.length > 0) {
                  const skillAwarePrioritized = orderContactsBySkillPriority(
                    prioritized,
                    skillRequirements
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
                    const rosterBaseUrl = (
                      process.env.PUBLIC_BASE_URL || baseUrlFromRequest
                    ).replace(/\/$/, "");

                    await scheduleBatchedMessages(trimmedContacts, {
                      job: jobWithSkills,
                      template: defaultTemplate,
                      campaign,
                      organizationId: req.user.organizationId,
                      userId: req.user.id,
                      availableCredits: maxToInvite,
                      twilioClient,
                      fromNumber,
                      rosterBaseUrl,
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
        skillRequirements,
      };

      res.json({
        job: jobWithSkills,
        reschedule: {
          triggered: timeChanged || locationChanged,
          notifiedCount: rescheduleNotified,
          impactedContactIds: confirmedContacts.map((contact) => contact.id),
          removedContactsCount,
          replacementInvitesSent,
        },
        conflicts: conflictReport.map((entry) => ({
          contact: {
            id: entry.contact.id,
            firstName: entry.contact.firstName,
            lastName: entry.contact.lastName,
          },
          jobs: entry.conflicts.map((conflictJob) => ({
            id: conflictJob.id,
            name: conflictJob.name,
            startTime: conflictJob.startTime,
            endTime: conflictJob.endTime,
          })),
        })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/jobs/:id/reschedule", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      const { startTime, endTime } = req.body;
      if (!startTime || !endTime) {
        return res.status(400).json({ message: "startTime and endTime are required" });
      }
      
      const updatedJob = await storage.updateJob(req.params.id, {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
      });
      
      await syncJobToCalendars(req.user.id, updatedJob);
      
      res.json(updatedJob);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/jobs/:id", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const availabilityRecords = await storage.getAvailability(job.id, req.user.organizationId);
      const confirmedContacts = (
        await Promise.all(
          availabilityRecords
            .filter((record) => record.status === "confirmed")
            .map((record) => storage.getContact(record.contactId, req.user.organizationId))
        )
      ).filter((contact): contact is Contact => Boolean(contact));

      const notifiedCount = await notifyJobCancellation(
        job,
        req.user.organizationId,
        req.user.id,
        confirmedContacts
      );

      // Job belongs to organization, so any user in the organization can delete it
      // But we could add role-based permissions here if needed
      await storage.deleteJob(req.params.id);
      res.json({
        success: true,
        notifiedCount,
        notifiedContactIds: confirmedContacts.map((contact) => contact.id),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update availability status for a job (admin endpoint)
  app.patch("/api/jobs/:jobId/availability/:availabilityId", requireAuth, async (req: any, res) => {
    try {
      const organizationId = req.user.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }

      const { jobId, availabilityId } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ["confirmed", "declined", "maybe", "no_reply", "free"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ 
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` 
        });
      }

      // Verify the job exists and belongs to the organization
      const job = await storage.getJob(jobId);
      if (!job || job.organizationId !== organizationId) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Get the availability record
      const availabilityRecords = await storage.getAvailability(jobId, organizationId);
      const availability = availabilityRecords.find(a => a.id === availabilityId);

      if (!availability) {
        return res.status(404).json({ message: "Availability record not found" });
      }

      // Update the availability status
      const updated = await storage.updateAvailability(availabilityId, { status });

      // Update contact status based on the new availability status
      const contact = await storage.getContact(availability.contactId, organizationId);
      if (contact) {
        if (status === "confirmed") {
          await storage.updateContact(contact.id, { status: "on_job" });
        } else if (status === "declined" || status === "free") {
          await storage.updateContact(contact.id, { status: "free" });
        }
        // "maybe" and "no_reply" don't change contact status
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/contacts", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const departmentId = req.query.departmentId as string | undefined;
      
      let contacts;
      if (departmentId) {
        // Filter contacts by department
        contacts = await storage.getContactsByDepartment(departmentId, req.user.organizationId);
      } else {
        contacts = await storage.getContacts(req.user.organizationId);
      }
      const allAvailability = await storage.getAllAvailability(req.user.organizationId);
      const jobs = await storage.getJobs(req.user.organizationId);
      
      // Get today's date range (start and end of day)
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      
      // Precompute job map for performance
      const jobMap = new Map(jobs.map(job => [job.id, job]));
      
      // Calculate dynamic status for each contact based on TODAY's jobs
      const contactsWithStatus = contacts.map(contact => {
        // Find if contact has confirmed availability for any job TODAY
        const hasJobToday = allAvailability.some(avail => {
          if (avail.contactId !== contact.id || avail.status !== 'confirmed') {
            return false;
          }
          
          const job = jobMap.get(avail.jobId);
          if (!job) {
            return false;
          }
          
          const jobStart = new Date(job.startTime);
          const jobEnd = new Date(job.endTime);
          
          // Check if job overlaps with today
          return (jobStart <= todayEnd && jobEnd >= todayStart);
        });
        
        // Override status to "on_job" only if they have a job TODAY
        // Otherwise use their stored status (free or off_shift)
        return {
          ...contact,
          status: hasJobToday ? 'on_job' : (contact.status === 'on_job' ? 'free' : contact.status)
        };
      });
      
      res.json(contactsWithStatus);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/contacts/:id/departments", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      
      // Verify the contact belongs to the organization
      const contact = await storage.getContact(id, req.user.organizationId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const departments = await storage.getDepartmentsByContact(id, req.user.organizationId);
      res.json(departments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/contacts/:id/current-job", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      
      // Verify the contact belongs to the organization
      const contact = await storage.getContact(id, req.user.organizationId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const job = await storage.getCurrentJobForContact(id, req.user.organizationId);
      if (!job) {
        return res.status(404).json({ message: "No current job found for this contact" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/contacts", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const validated = insertContactSchema.parse(req.body);
      
      // Hash password if provided and hasLogin is enabled
      const contactData = { ...validated };
      if (contactData.hasLogin && contactData.password) {
        contactData.password = await bcrypt.hash(contactData.password, 10);
      } else if (!contactData.hasLogin) {
        // Remove password if login is not enabled
        delete contactData.password;
      }
      
      // Email is required if login is enabled
      if (contactData.hasLogin && !contactData.email) {
        return res.status(400).json({ message: "Email is required when login is enabled" });
      }
      
      const contact = await storage.createContact(req.user.organizationId, req.user.id, contactData);
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/contacts/upload-image", requireAuth, async (req: any, res) => {
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

  app.post("/api/contacts/bulk", requireAuth, async (req: any, res) => {
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
        errors: [] as string[],
      };

      // Fetch existing contacts once
      const existingContacts = await storage.getContacts(organizationId);
      const existingPhones = new Set(existingContacts.map(c => c.phone));

      for (let i = 0; i < phoneContacts.length; i++) {
        const phoneContact = phoneContacts[i];

        try {
          // Validate contact data using Zod schema
          const contactData = insertContactSchema.parse({
            userId,
            firstName: phoneContact.firstName,
            lastName: phoneContact.lastName,
            phone: phoneContact.phone,
            email: phoneContact.email || undefined,
            status: 'free',
            countryCode: phoneContact.countryCode || 'GB',
          });

          // Skip duplicates
          if (existingPhones.has(contactData.phone)) {
            results.errors.push(`Contact ${i + 1}: Phone ${contactData.phone} already exists`);
            results.skipped++;
            continue;
          }

          await storage.createContact(organizationId, userId, contactData);
          results.imported++;
          existingPhones.add(contactData.phone);
        } catch (error: any) {
          results.errors.push(`Contact ${i + 1}: ${error.message}`);
          results.skipped++;
        }
      }

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/contacts/:id", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }

      // Verify the contact belongs to the user
      const contact = await storage.getContact(req.params.id, req.user.organizationId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (contact.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this contact" });
      }
      
      const updateData = { ...req.body };
      
      // Hash password if provided and hasLogin is enabled (or being enabled)
      if (updateData.hasLogin && updateData.password) {
        // Only hash if password is provided and it's not already hashed (check length)
        // bcrypt hashes are always 60 characters
        if (updateData.password.length !== 60) {
          updateData.password = await bcrypt.hash(updateData.password, 10);
        }
      } else if (updateData.hasLogin === false) {
        // Remove password if login is being disabled
        updateData.password = null;
      } else if (!updateData.hasLogin && contact.hasLogin && !updateData.password) {
        // If hasLogin is not being changed but password is being updated
        // Keep existing behavior - don't change password
      }
      
      // Email is required if login is being enabled
      if (updateData.hasLogin && !updateData.email && !contact.email) {
        return res.status(400).json({ message: "Email is required when login is enabled" });
      }
      
      const updatedContact = await storage.updateContact(req.params.id, updateData);
      res.json(updatedContact);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/contacts/:id", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }

      // Verify the contact belongs to the user
      const contact = await storage.getContact(req.params.id, req.user.organizationId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (contact.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to delete this contact" });
      }
      
      await storage.deleteContact(req.params.id);
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/contacts/import", requireAuth, async (req: any, res) => {
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
        errors: [] as string[],
      };

      // Fetch existing contacts once
      const existingContacts = await storage.getContacts(organizationId);
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
          await storage.createContact(organizationId, userId, validated);
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
  app.get("/api/contacts/:id/roster-token", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }

      const contact = await storage.getContact(req.params.id, req.user.organizationId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      // Verify contact belongs to user
      if (contact.userId !== req.user.id) {
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

  // Public endpoint to view schedule by token - no auth required
  app.get("/api/roster/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Find contact by roster token
      const contact = await storage.getContactByRosterToken(token);
      
      if (!contact) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      const organizationId = contact.organizationId;
      
      // Get all jobs where this contact has availability (regardless of status)
      const availabilityRecords = await storage.getAvailabilityByContact(contact.id, organizationId);
      
      // Fetch job details for all jobs with availability
      const jobIds = availabilityRecords.map(a => a.jobId);
      const jobs = [];
      
      // Get all departments for this organization to include names
      const allDepartments = await storage.getDepartmentsByOrganization(organizationId);
      const departmentMap = new Map(allDepartments.map(d => [d.id, d]));
      
      for (const jobId of jobIds) {
        const job = await storage.getJob(jobId);
        if (job) {
          jobs.push(job);
        }
      }
      
      // Sort jobs by start time
      jobs.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      
      // Get unique departments from jobs
      const jobDepartments = Array.from(new Set(jobs.map(j => j.departmentId).filter(Boolean)))
        .map(id => departmentMap.get(id))
        .filter(Boolean) as any[];
      
      res.json({
        departments: jobDepartments,
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
          departmentId: job.departmentId,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== CONTACT PORTAL ROUTES =====
  // Get contact's jobs with availability status
  app.get("/api/contact/jobs", requireContactAuth, async (req: any, res) => {
    try {
      const contact = req.contact;
      const organizationId = contact.organizationId;

      // Get all availability records for this contact
      const availabilityRecords = await storage.getAvailabilityByContact(contact.id, organizationId);

      // Get all jobs for this contact
      const jobIds = availabilityRecords.map(a => a.jobId);
      const jobsWithAvailability = [];

      for (const availability of availabilityRecords) {
        const job = await storage.getJob(availability.jobId);
        if (job) {
          jobsWithAvailability.push({
            id: job.id,
            name: job.name,
            location: job.location,
            startTime: job.startTime,
            endTime: job.endTime,
            notes: job.notes,
            availabilityStatus: availability.status, // "no_reply", "confirmed", "declined", "maybe"
            shiftPreference: availability.shiftPreference,
            updatedAt: availability.updatedAt,
          });
        }
      }

      // Sort by start time
      jobsWithAvailability.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      res.json({ jobs: jobsWithAvailability });
    } catch (error: any) {
      console.error("Get contact jobs error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get contact's schedule (upcoming and past jobs)
  // Get departments for contact (to display department names)
  app.get("/api/contact/departments", requireContactAuth, async (req: any, res) => {
    try {
      const contact = req.contact;
      const departments = await storage.getDepartmentsByOrganization(contact.organizationId);
      res.json(departments);
    } catch (error: any) {
      console.error("Get contact departments error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/contact/schedule", requireContactAuth, async (req: any, res) => {
    try {
      const contact = req.contact;
      const organizationId = contact.organizationId;

      // Get all availability records for this contact
      const availabilityRecords = await storage.getAvailabilityByContact(contact.id, organizationId);

      const now = new Date();
      const upcoming: any[] = [];
      const past: any[] = [];

      for (const availability of availabilityRecords) {
        const job = await storage.getJob(availability.jobId);
        if (!job) continue;

        const jobData = {
          id: job.id,
          name: job.name,
          location: job.location,
          startTime: job.startTime,
          endTime: job.endTime,
          notes: job.notes,
          departmentId: job.departmentId,
          availabilityStatus: availability.status,
          shiftPreference: availability.shiftPreference,
          availabilityId: availability.id, // Include availability ID for updating
        };

        if (new Date(job.startTime) >= now) {
          upcoming.push(jobData);
        } else {
          past.push(jobData);
        }
      }

      // Sort by start time
      upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      past.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

      res.json({ upcoming, past });
    } catch (error: any) {
      console.error("Get contact schedule error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Cancel a contact's assignment for a job (manager initiated)
  app.post("/api/jobs/:jobId/cancel-contact", requireAuth, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const { contactId, reason } = req.body;

      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      if (!contactId) {
        return res.status(400).json({ message: "contactId is required" });
      }

      const job = await storage.getJob(jobId, req.user.organizationId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const contact = await storage.getContact(contactId, req.user.organizationId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Update availability to cancelled
      const availabilityRecord = await storage.getAvailabilityForContact(jobId, contactId, req.user.organizationId);
      if (!availabilityRecord) {
        await storage.createAvailability(req.user.organizationId, {
          jobId,
          contactId,
          status: "cancelled",
          shiftPreference: null,
        });
      } else {
        await storage.updateAvailability(availabilityRecord.id, {
          status: "cancelled",
        });
      }

      // Log cancellation
      await storage.createCancellationLog({
        jobId,
        contactId,
        cancelledBy: req.user.id,
        reason: reason || null,
      });

      // Find replacements from invitation pool (uninvited only)
      const uninvitedPool = await storage.getUninvitedPool(jobId);
      const candidates = uninvitedPool.filter((entry) => entry.contactId !== contactId).slice(0, 3);

      let replacementsInvited = 0;

      for (const candidate of candidates) {
        const replacementContact = await storage.getContact(candidate.contactId, req.user.organizationId);
        if (!replacementContact || replacementContact.isOptedOut) continue;

        const existingAvailability = await storage.getAvailabilityForContact(jobId, candidate.contactId, req.user.organizationId);
        if (!existingAvailability) {
          await storage.createAvailability(req.user.organizationId, {
            jobId,
            contactId: candidate.contactId,
            status: "no_reply",
            shiftPreference: null,
          });
        }

        // Mark invited in pool
        await storage.markInvitationAsInvited(jobId, candidate.contactId);

        // Create vacancy message (DB record)
        const vacancyMessage = `Vacancy: ${job.name} at ${job.location}. Reply Y to confirm or N to decline.`;
        await storage.createMessage(req.user.organizationId, req.user.id, {
          contactId: candidate.contactId,
          jobId,
          campaignId: null,
          direction: "outbound",
          content: vacancyMessage,
          status: "sent",
          twilioSid: null,
        });

        replacementsInvited += 1;
      }

      res.json({ success: true, replacementsInvited });
    } catch (error: any) {
      console.error("Cancel contact assignment error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get contact's pending invitations (jobs with no_reply or maybe status)
  app.get("/api/contact/invitations", requireContactAuth, async (req: any, res) => {
    try {
      const contact = req.contact;
      const organizationId = contact.organizationId;

      // Get availability records with pending status
      const allAvailability = await storage.getAvailabilityByContact(contact.id, organizationId);
      const pendingAvailability = allAvailability.filter(
        a => a.status === "no_reply" || a.status === "maybe"
      );

      const invitations = [];

      for (const availability of pendingAvailability) {
        const job = await storage.getJob(availability.jobId);
        if (job) {
          invitations.push({
            id: job.id,
            name: job.name,
            location: job.location,
            startTime: job.startTime,
            endTime: job.endTime,
            notes: job.notes,
            departmentId: job.departmentId,
            availabilityStatus: availability.status,
            shiftPreference: availability.shiftPreference,
            availabilityId: availability.id, // Include availability ID for updating
            createdAt: availability.updatedAt, // When the invitation was sent/updated
          });
        }
      }

      // Sort by start time (earliest first)
      invitations.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      res.json({ invitations });
    } catch (error: any) {
      console.error("Get contact invitations error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update contact's availability status (for accepting/declining invitations)
  app.patch("/api/contact/availability/:availabilityId", requireContactAuth, async (req: any, res) => {
    try {
      const contact = req.contact;
      const { availabilityId } = req.params;
      const { status } = req.body;

      if (!status || !["confirmed", "declined", "maybe"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'confirmed', 'declined', or 'maybe'" });
      }

      // Verify that this availability record belongs to the contact
      const organizationId = contact.organizationId;
      const allAvailability = await storage.getAvailabilityByContact(contact.id, organizationId);
      const availability = allAvailability.find(a => a.id === availabilityId);

      if (!availability) {
        return res.status(404).json({ message: "Availability record not found" });
      }

      // Update the availability status
      await storage.updateAvailability(availabilityId, {
        status,
      });

      // Update contact status based on their reply (same logic as SMS webhook)
      if (status === "confirmed") {
        await storage.updateContact(contact.id, { status: "on_job" });
      } else if (status === "declined") {
        await storage.updateContact(contact.id, { status: "free" });
      }
      // "maybe" doesn't change contact status

      // Find push notification delivery for this contact and job to get campaign details
      // This helps link the response to the original notification
      const pushDeliveries = await storage.getPushNotificationDeliveriesByContactAndJob(contact.id, availability.jobId);
      const latestDelivery = pushDeliveries.length > 0 ? pushDeliveries[0] : null;

      // Log response_received event (similar to push notification action endpoint)
      await storage.createMessageLog({
        organizationId,
        jobId: availability.jobId,
        campaignId: latestDelivery?.campaignId || null,
        contactId: contact.id,
        eventType: "response_received",
        channel: latestDelivery ? "push" : "portal", // Use "portal" if no push delivery found (user accepted via web/mobile app directly)
        status: "success",
        notificationId: latestDelivery?.notificationId || null,
        pushDeliveryId: latestDelivery?.id || null,
        responseStatus: status === "confirmed" ? "accepted" : status === "declined" ? "declined" : "maybe",
      });

      res.json({ success: true, status });
    } catch (error: any) {
      console.error("Update contact availability error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get contact's messages
  app.get("/api/contact/messages", requireContactAuth, async (req: any, res) => {
    try {
      const contact = req.contact;
      const organizationId = contact.organizationId;

      // Get all messages sent to this contact
      const messages = await storage.getMessages(contact.id, organizationId);

      // Fetch job names for messages with jobId
      const messagesWithJobNames = await Promise.all(
        messages.map(async (message) => {
          let jobName = undefined;
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
            jobName,
          };
        })
      );

      // Sort by most recent first
      messagesWithJobNames.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      res.json(messagesWithJobNames);
    } catch (error: any) {
      console.error("Get contact messages error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Register device token for push notifications
  app.post("/api/contact/device-token", requireContactAuth, async (req: any, res) => {
    try {
      const contact = req.contact;
      const { token, platform } = req.body;

      if (!token || !platform) {
        return res.status(400).json({ message: "Token and platform are required" });
      }

      if (!["ios", "android"].includes(platform)) {
        return res.status(400).json({ message: "Platform must be 'ios' or 'android'" });
      }

      await storage.saveDeviceToken(contact.id, token, platform);
      console.log(`[DeviceToken] Registered ${platform} token for contact ${contact.id}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Register device token error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Remove device token (on logout)
  app.delete("/api/contact/device-token", requireContactAuth, async (req: any, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      await storage.removeDeviceToken(token);
      console.log(`[DeviceToken] Removed token for contact`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Remove device token error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Report push notification delivery
  app.post("/api/contact/push-notification/delivered", requireContactAuth, async (req: any, res) => {
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

      // Verify this delivery belongs to the contact
      if (delivery.contactId !== contact.id) {
        return res.status(403).json({ message: "This notification does not belong to you" });
      }

      // Update delivery status to "delivered"
      await storage.updatePushNotificationDelivery(delivery.id, {
        status: "delivered",
        deliveredAt: new Date(),
      });

      // Log push_delivered event
      await storage.createMessageLog({
        organizationId: contact.organizationId,
        jobId: delivery.jobId,
        campaignId: delivery.campaignId || null,
        contactId: contact.id,
        eventType: "push_delivered",
        channel: "push",
        status: "delivered",
        notificationId: delivery.notificationId,
        pushDeliveryId: delivery.id,
      });

      console.log(`[PushNotification] Delivery confirmed for notification ${notificationId} (contact ${contact.id})`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Push notification delivery receipt error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Handle push notification action (Accept/Decline)
  app.post("/api/contact/push-notification/action", requireContactAuth, async (req: any, res) => {
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

      // Verify this delivery belongs to the contact
      if (delivery.contactId !== contact.id) {
        return res.status(403).json({ message: "This notification does not belong to you" });
      }

      // Verify jobId matches
      if (delivery.jobId !== jobId) {
        return res.status(400).json({ message: "jobId does not match notification" });
      }

      const organizationId = contact.organizationId;
      const job = await storage.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Get or create availability record
      let availability = await storage.getAvailabilityForContact(jobId, contact.id, organizationId);
      
      if (!availability) {
        // Create new availability record
        availability = await storage.createAvailability(organizationId, {
          contactId: contact.id,
          jobId: jobId,
          status: action === "accept" ? "confirmed" : "declined",
        });
      } else {
        // Update existing availability record
        await storage.updateAvailability(availability.id, {
          status: action === "accept" ? "confirmed" : "declined",
        });
      }

      // Update contact status based on action
      if (action === "accept") {
        await storage.updateContact(contact.id, { status: "on_job" });
      } else if (action === "decline") {
        await storage.updateContact(contact.id, { status: "free" });
      }

      // Send acknowledgement SMS
      const parsed = { status: action === "accept" ? "confirmed" : "declined" };
      await sendAcknowledgementSMS(organizationId, contact, job, parsed, contact.userId);

      // Update delivery record to mark as delivered (if not already)
      if (delivery.status === "sent") {
        await storage.updatePushNotificationDelivery(delivery.id, {
          status: "delivered",
          deliveredAt: new Date(),
        });
      }

      // Log response_received event
      await storage.createMessageLog({
        organizationId,
        jobId: jobId,
        campaignId: delivery.campaignId,
        contactId: contact.id,
        eventType: "response_received",
        channel: "push",
        status: "success",
        notificationId: notificationId,
        pushDeliveryId: delivery.id,
        responseStatus: action === "accept" ? "accepted" : "declined",
      });

      console.log(`[PushNotification] Action ${action} processed for notification ${notificationId} (contact ${contact.id}, job ${jobId})`);

      res.json({ 
        success: true, 
        status: action === "accept" ? "confirmed" : "declined" 
      });
    } catch (error: any) {
      console.error("Push notification action error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update contact's own profile
  app.patch("/api/contact/profile", requireContactAuth, async (req: any, res) => {
    try {
      const contact = req.contact;
      const { firstName, lastName, email, phone, countryCode } = req.body;

      const updateData: any = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (countryCode !== undefined) updateData.countryCode = countryCode;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const updatedContact = await storage.updateContact(contact.id, updateData);
      
      res.json({
        id: updatedContact.id,
        firstName: updatedContact.firstName,
        lastName: updatedContact.lastName,
        email: updatedContact.email,
        phone: updatedContact.phone,
        countryCode: updatedContact.countryCode,
      });
    } catch (error: any) {
      console.error("Update contact profile error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Change contact's password
  app.post("/api/contact/change-password", requireContactAuth, async (req: any, res) => {
    try {
      const contact = req.contact;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }

      // Verify current password
      if (!contact.password) {
        return res.status(400).json({ message: "No password set for this account" });
      }

      const bcrypt = await import("bcrypt");
      const isPasswordValid = await bcrypt.compare(currentPassword, contact.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash and update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateContact(contact.id, { password: hashedPassword });

      res.json({ success: true, message: "Password updated successfully" });
    } catch (error: any) {
      console.error("Change contact password error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/resource-allocation", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const organizationId = req.user.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      
      // Fetch all data needed for the report
      const contacts = await storage.getContacts(organizationId);
      const jobs = await storage.getJobs(organizationId);
      const allAvailability = await storage.getAllAvailability(organizationId);
      const user = await storage.getUser(userId);
      
      // Get today's date range (start and end of day)
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      
      // Precompute job map for performance
      const jobMap = new Map(jobs.map(job => [job.id, job]));
      
      // Calculate dynamic status for each contact based on TODAY's jobs
      const contactsWithStatus = contacts.map(contact => {
        const hasJobToday = allAvailability.some(avail => {
          if (avail.contactId !== contact.id || avail.status !== 'confirmed') {
            return false;
          }
          
          const job = jobMap.get(avail.jobId);
          if (!job) {
            return false;
          }
          
          const jobStart = new Date(job.startTime);
          const jobEnd = new Date(job.endTime);
          
          return (jobStart <= todayEnd && jobEnd >= todayStart);
        });
        
        return {
          ...contact,
          status: hasJobToday ? 'on_job' : (contact.status === 'on_job' ? 'free' : contact.status)
        };
      });
      
      // Create a PDF document
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      
      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="resource-allocation-report.pdf"');
      
      // Pipe the PDF to the response
      doc.pipe(res);
      
      // Define colors
      const primaryColor = '#0EA5E9'; // Sky blue
      const successColor = '#10B981'; // Green
      const warningColor = '#F59E0B'; // Amber
      const dangerColor = '#EF4444'; // Red
      const grayColor = '#6B7280'; // Gray
      const lightGray = '#F3F4F6';
      
      // Helper function to draw a colored box
      const drawBox = (y: number, height: number, color: string) => {
        doc.rect(50, y, doc.page.width - 100, height)
           .fill(color);
      };
      
      // Header with colored background
      drawBox(30, 80, primaryColor);
      doc.fillColor('white')
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('RESOURCE ALLOCATION REPORT', 50, 50, { align: 'center' });
      doc.fontSize(11)
         .font('Helvetica')
         .text(`Generated: ${new Date().toLocaleDateString('en-GB', { 
           weekday: 'long', 
           year: 'numeric', 
           month: 'long', 
           day: 'numeric',
           hour: '2-digit',
           minute: '2-digit'
         })}`, 50, 80, { align: 'center' });
      
      doc.moveDown(4);
      
      // Group contacts by status (using calculated status)
      const contactsOnJob = contactsWithStatus.filter(c => c.status === 'on_job');
      const contactsAvailable = contactsWithStatus.filter(c => c.status === 'free');
      const contactsOffShift = contactsWithStatus.filter(c => c.status === 'off_shift');
      
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
      
      // Summary Cards at the top
      const summaryY = doc.y;
      const cardWidth = 120;
      const cardHeight = 60;
      const spacing = 20;
      
      // Card 1: Total Contacts
      doc.roundedRect(50, summaryY, cardWidth, cardHeight, 5).fillAndStroke(lightGray, grayColor);
      doc.fillColor(grayColor).fontSize(10).font('Helvetica').text('Total Contacts', 60, summaryY + 15);
      doc.fillColor('black').fontSize(24).font('Helvetica-Bold').text(contactsWithStatus.length.toString(), 60, summaryY + 30);
      
      // Card 2: On Job
      doc.roundedRect(50 + cardWidth + spacing, summaryY, cardWidth, cardHeight, 5).fillAndStroke('#DCFCE7', successColor);
      doc.fillColor(successColor).fontSize(10).font('Helvetica').text('On Job', 60 + cardWidth + spacing, summaryY + 15);
      doc.fillColor('black').fontSize(24).font('Helvetica-Bold').text(contactsOnJob.length.toString(), 60 + cardWidth + spacing, summaryY + 30);
      
      // Card 3: Available
      doc.roundedRect(50 + (cardWidth + spacing) * 2, summaryY, cardWidth, cardHeight, 5).fillAndStroke('#DBEAFE', primaryColor);
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica').text('Available', 60 + (cardWidth + spacing) * 2, summaryY + 15);
      doc.fillColor('black').fontSize(24).font('Helvetica-Bold').text(contactsAvailable.length.toString(), 60 + (cardWidth + spacing) * 2, summaryY + 30);
      
      // Card 4: Off Shift
      doc.roundedRect(50 + (cardWidth + spacing) * 3, summaryY, cardWidth, cardHeight, 5).fillAndStroke('#FEF3C7', warningColor);
      doc.fillColor(warningColor).fontSize(10).font('Helvetica').text('Off Shift', 60 + (cardWidth + spacing) * 3, summaryY + 15);
      doc.fillColor('black').fontSize(24).font('Helvetica-Bold').text(contactsOffShift.length.toString(), 60 + (cardWidth + spacing) * 3, summaryY + 30);
      
      doc.moveDown(5);
      
      // Section 1: Contacts on Jobs
      doc.fillColor(successColor)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('● Contacts Assigned to Jobs', { continued: false });
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(successColor).stroke();
      doc.moveDown();
      
      if (contactsOnJob.length === 0) {
        doc.fillColor(grayColor).fontSize(10).font('Helvetica-Oblique').text('No contacts currently assigned to jobs.');
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
            const boxY = doc.y;
            doc.roundedRect(50, boxY, doc.page.width - 100, 10 + (contactsList.length * 15) + 50, 5)
               .fillAndStroke('#F0FDF4', '#86EFAC');
            
            doc.fillColor('black').fontSize(13).font('Helvetica-Bold').text(`📋 ${job.name}`, 60, boxY + 10);
            doc.fillColor(grayColor).fontSize(9).font('Helvetica');
            doc.text(`📍 ${job.location || 'N/A'}`, 60, doc.y + 5);
            doc.text(`📅 ${new Date(job.startTime).toLocaleDateString('en-GB', { 
              weekday: 'short', 
              day: '2-digit', 
              month: 'short', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })} - ${new Date(job.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 60, doc.y + 3);
            
            if (job.notes) {
              doc.fillColor(grayColor).fontSize(8).font('Helvetica-Oblique').text(`Note: ${job.notes}`, 60, doc.y + 3, { width: doc.page.width - 120 });
            }
            
            doc.moveDown(0.5);
            doc.fillColor('black').fontSize(10).font('Helvetica-Bold').text('Team Members:', 60, doc.y + 5);
            
            contactsList.forEach((contact, index) => {
              doc.fillColor('black').fontSize(9).font('Helvetica').text(
                `  ${index + 1}. ${contact.firstName} ${contact.lastName}`,
                70,
                doc.y + 3
              );
              doc.fillColor(grayColor).fontSize(8).text(
                `     📞 ${contact.phone}${contact.email ? ` • 📧 ${contact.email}` : ''}`,
                70,
                doc.y + 2
              );
            });
            doc.moveDown(1.5);
          }
        });
      }
      
      doc.moveDown();
      
      // Section 2: Available Contacts
      doc.fillColor(primaryColor)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('● Available Contacts', { continued: false });
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(primaryColor).stroke();
      doc.moveDown();
      
      if (contactsAvailable.length === 0) {
        doc.fillColor(grayColor).fontSize(10).font('Helvetica-Oblique').text('No contacts currently available.');
      } else {
        contactsAvailable.forEach((contact, index) => {
          if (index % 2 === 0) {
            doc.roundedRect(50, doc.y - 2, doc.page.width - 100, 15, 3).fill('#EFF6FF');
          }
          doc.fillColor('black').fontSize(10).font('Helvetica').text(
            `${index + 1}. ${contact.firstName} ${contact.lastName}`,
            60,
            doc.y + 2,
            { continued: true, width: 200 }
          );
          doc.fillColor(grayColor).fontSize(9).text(
            ` • ${contact.phone}${contact.email ? ` • ${contact.email}` : ''}`,
            { continued: false }
          );
        });
      }
      
      doc.moveDown(2);
      
      // Section 3: Off Shift Contacts
      doc.fillColor(warningColor)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('● Off Shift Contacts', { continued: false });
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(warningColor).stroke();
      doc.moveDown();
      
      if (contactsOffShift.length === 0) {
        doc.fillColor(grayColor).fontSize(10).font('Helvetica-Oblique').text('No contacts currently off shift.');
      } else {
        contactsOffShift.forEach((contact, index) => {
          if (index % 2 === 0) {
            doc.roundedRect(50, doc.y - 2, doc.page.width - 100, 15, 3).fill('#FFFBEB');
          }
          doc.fillColor('black').fontSize(10).font('Helvetica').text(
            `${index + 1}. ${contact.firstName} ${contact.lastName}`,
            60,
            doc.y + 2,
            { continued: true, width: 200 }
          );
          doc.fillColor(grayColor).fontSize(9).text(
            ` • ${contact.phone}${contact.email ? ` • ${contact.email}` : ''}`,
            { continued: false }
          );
        });
      }
      
      // Footer
      doc.moveDown(3);
      const footerY = doc.page.height - 80;
      doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).strokeColor(grayColor).stroke();
      doc.fillColor(grayColor).fontSize(8).font('Helvetica')
         .text(`HeyTeam Resource Allocation Report`, 50, footerY + 10, { align: 'center' });
      doc.text(`© ${new Date().getFullYear()} HeyTeam. All rights reserved.`, { align: 'center' });
      
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
      const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : null;
      if (!organizationId) {
        return res.status(400).json({ message: "organizationId query parameter is required" });
      }
      
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

  app.get("/api/templates", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const templates = await storage.getTemplates(req.user.organizationId);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/templates", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const validated = insertTemplateSchema.parse(req.body);
      const template = await storage.createTemplate(req.user.organizationId, req.user.id, validated);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/templates/:id", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      // Verify the template belongs to the user
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      if (template.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this template" });
      }

      // Check if this is a protected template (Job Invitation, Job Cancellation, Job Update)
      const isProtectedTemplate = (name: string): boolean => {
        const normalized = name.toLowerCase().trim();
        return normalized === "job invitation" || 
               normalized === "job cancellation" || 
               normalized === "job update";
      };

      const isProtected = isProtectedTemplate(template.name);

      // Prevent name changes for protected templates
      if (isProtected && req.body.name && req.body.name.trim().toLowerCase() !== template.name.toLowerCase()) {
        return res.status(400).json({ message: `Cannot change the name of the ${template.name} template` });
      }

      const validated = insertTemplateSchema.parse(req.body);
      // Ensure name is not changed for protected templates
      if (isProtected) {
        validated.name = template.name;
      }
      const updated = await storage.updateTemplate(req.params.id, validated);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/templates/:id", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      // Verify the template belongs to the user
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      if (template.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to delete this template" });
      }

      // Check if this is a protected template (Job Invitation, Job Cancellation, Job Update)
      const isProtectedTemplate = (name: string): boolean => {
        const normalized = name.toLowerCase().trim();
        return normalized === "job invitation" || 
               normalized === "job cancellation" || 
               normalized === "job update";
      };
      
      // Prevent deletion of protected templates
      if (isProtectedTemplate(template.name)) {
        return res.status(400).json({ message: `Cannot delete the ${template.name} template` });
      }
      
      await storage.deleteTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/send-message", requireAuth, async (req: any, res) => {
    try {
      const { jobId, templateId, contactIds, customMessage } = req.body;
      const userId = req.user.id;
      const organizationId = req.user.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }

      // Validate: either templateId OR customMessage required
      if (!templateId && !customMessage) {
        return res.status(400).json({ message: "Template ID or custom message required" });
      }

      if (customMessage && typeof customMessage !== 'string') {
        return res.status(400).json({ message: "Custom message must be a string" });
      }

      if (customMessage && customMessage.trim().length === 0) {
        return res.status(400).json({ message: "Custom message cannot be empty" });
      }

      // Check if user has enough credits
      const availableCredits = await creditService.getAvailableCreditsForOrganization(organizationId);
      if (availableCredits <= 0) {
        return res.status(400).json({ message: "Insufficient SMS credits" });
      }

      const jobRecord = await storage.getJob(jobId);
      
      // Template is optional now (can use customMessage instead)
      let template: Template | undefined = undefined;
      if (templateId) {
        template = await storage.getTemplate(templateId);
        if (!template) {
          return res.status(404).json({ message: "Template not found" });
        }
      }

      if (!jobRecord) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Check if this is a job invitation template (only applies when using template)
      const isJobInvitation = template?.name && 
        (template.name.toLowerCase().includes("invitation") || 
         template.name.toLowerCase().includes("job invitation") ||
         template.name.toLowerCase() === "job invitation");

      // Filter by department if job has a department
      let filteredContactIds: string[] = contactIds;
      if (jobRecord.departmentId) {
        const deptContacts = await storage.getContactsByDepartment(jobRecord.departmentId, organizationId);
        const deptSet = new Set(deptContacts.map((c) => c.id));
        filteredContactIds = contactIds.filter((id: string) => deptSet.has(id));
        if (!filteredContactIds.length) {
          return res.status(400).json({ message: "No contacts in this department to message" });
        }
      }

      const skillRequirements = await storage.getJobSkillRequirements(jobId);
      const job: JobWithSkillRequirements = {
        ...jobRecord,
        skillRequirements,
      };

      const campaign = await storage.createCampaign(organizationId, userId, {
        jobId,
        templateId: templateId ?? null, // Use nullish coalescing to allow null for custom messages
      });

      // Track invitation pool for replacements

      let twilioClient: any = null;
      let fromNumber: string = "";
      
      try {
        twilioClient = await getTwilioClient();
        fromNumber = await getTwilioFromPhoneNumber();
      } catch (error) {
        console.log("Twilio not configured, messages will be logged only");
      }

      const prioritizedRaw = await prioritizeContacts(filteredContactIds, job, organizationId);
      // Exclude contacts in blackout periods entirely
      const prioritized = prioritizedRaw.filter((entry) => !isWithinBlackout(entry.contact, job));
      if (!prioritized.length) {
        return res.status(400).json({ message: "No eligible contacts to message" });
      }

      const skillAwarePrioritized = orderContactsBySkillPriority(prioritized, skillRequirements);
      const prioritizedContacts = skillAwarePrioritized.map((entry) => entry.contact);
      const maxDeliverable = Math.min(prioritizedContacts.length, availableCredits);
      const trimmedContacts = prioritizedContacts.slice(0, maxDeliverable);

      // Track invitation pool for replacements
      await storage.upsertInvitationPool(job.id, campaign.id, trimmedContacts.map((c) => ({ contactId: c.id })));

      if (!trimmedContacts.length) {
        return res.status(400).json({ message: "Insufficient SMS credits to send messages" });
      }

      // Get device tokens for all contacts
      const trimmedContactIds = trimmedContacts.map(c => c.id);
      const deviceTokens = await storage.getDeviceTokensForContacts(trimmedContactIds);

      // Prepare push notifications
      const contactsWithTokens = deviceTokens.map(dt => ({
        contactId: dt.contactId,
        token: dt.token,
        platform: dt.platform as "ios" | "android",
      }));

      // Get availability IDs for notification data
      const availabilityMap = new Map<string, string>();
      for (const contact of trimmedContacts) {
        const availability = await storage.getAvailabilityForContact(jobId, contact.id, organizationId);
        if (availability) {
          availabilityMap.set(contact.id, availability.id);
        }
      }

      // Send push notifications for ALL messages (not just job invitations)
      let contactsToSms = [...trimmedContacts];
      let pushSuccessCount = 0;
      let pushFailedCount = 0;

      if (contactsWithTokens.length > 0) {
        // Determine notification title and body based on message type
        let notificationTitle: string;
        let notificationBody: string;
        let notificationType: string;
        let notificationAction: string;

        if (isJobInvitation) {
          // Job invitation format
          const formattedDate = format(new Date(job.startTime), "MMM d, yyyy 'at' h:mm a");
          notificationTitle = "New Job Invitation";
          notificationBody = `${job.name} - ${formattedDate}`;
          notificationType = "job_invitation";
          notificationAction = "view_invitations";
        } else {
          // Regular message format
          // Use template name or "New Message" as title
          notificationTitle = template?.name || "New Message";
          
          // For body, use template/custom message content (truncated if too long)
          if (customMessage) {
            notificationBody = customMessage.length > 100 
              ? customMessage.substring(0, 97) + "..." 
              : customMessage;
          } else if (template) {
            // For template, use a preview (first contact as example for preview)
            const previewContact = trimmedContacts[0];
            const previewContent = renderTemplate(template.content, previewContact, job);
            notificationBody = previewContent.length > 100 
              ? previewContent.substring(0, 97) + "..." 
              : previewContent;
          } else {
            notificationBody = "You have a new message";
          }
          
          notificationType = "message";
          notificationAction = "view_messages";
        }

        const pushResult = await sendPushNotificationsToContacts(
          contactsWithTokens,
          {
            title: notificationTitle,
            body: notificationBody,
            data: {
              type: notificationType,
              jobId: job.id,
              action: notificationAction,
            },
          }
        );

        pushSuccessCount = pushResult.success.length;
        pushFailedCount = pushResult.failed.length;

        // Create delivery records for successful push notifications and log events
        // Set fallbackDueAt to 30 seconds from now for cron job to pick up
        const fallbackDueAt = new Date(Date.now() + 30000); // 30 seconds from now
        
        for (const { contactId, notificationId, token } of pushResult.notificationIds) {
          const contact = trimmedContacts.find(c => c.id === contactId);
          if (contact) {
            // Create or update availability record for job invitation
            // This ensures the invitation appears in the invitations list
            if (isJobInvitation) {
              const availabilityRecord = await storage.getAvailabilityForContact(job.id, contactId, organizationId);
              if (!availabilityRecord) {
                await storage.createAvailability(organizationId, {
                  jobId: job.id,
                  contactId: contact.id,
                  status: "no_reply",
                  shiftPreference: null,
                });
              } else {
                await storage.updateAvailability(availabilityRecord.id, {
                  status: "no_reply",
                });
              }
            }

            const delivery = await storage.createPushNotificationDelivery({
              contactId,
              jobId: job.id,
              campaignId: campaign.id,
              organizationId,
              templateId: templateId || null,
              customMessage: customMessage || null,
              deviceToken: token,
              notificationId,
              status: "sent",
              fallbackDueAt,
              fallbackProcessed: false,
            });

            // Create message record so it appears in the messages list
            // For job invitations, use the formatted notification body
            // For regular messages, use the actual message content
            let messageContentForRecord: string;
            if (isJobInvitation) {
              messageContentForRecord = notificationBody; // "Job Name - Date"
            } else {
              // Use the actual message content (template or custom)
              if (customMessage) {
                messageContentForRecord = customMessage;
              } else if (template) {
                messageContentForRecord = renderTemplate(template.content, contact, job);
              } else {
                messageContentForRecord = notificationBody;
              }
            }

            await storage.createMessage(organizationId, userId, {
              contactId,
              jobId: job.id,
              campaignId: campaign.id,
              direction: "outbound",
              content: messageContentForRecord,
              status: "sent",
              twilioSid: null, // No Twilio SID for push notifications
            });

            // Mark contact as invited in pool (only for job invitations)
            if (isJobInvitation) {
              await storage.markInvitationAsInvited(job.id, contactId);
            }

            // Log push_sent event with enhanced details
            const deviceTokenRecord = deviceTokens.find(dt => dt.contactId === contactId && dt.token === token);
            await storage.createMessageLog({
              organizationId,
              jobId: job.id,
              campaignId: campaign.id,
              contactId,
              eventType: "push_sent",
              channel: "push",
              status: "success",
              notificationId,
              pushDeliveryId: delivery.id,
              scheduledAt: new Date(),
              sentAt: new Date(),
              metadata: JSON.stringify({ 
                platform: deviceTokenRecord?.platform, 
                deviceToken: token,
                fallbackDueAt: fallbackDueAt.toISOString(),
              }),
            });

            // Log sms_fallback_scheduled event
            await storage.createMessageLog({
              organizationId,
              jobId: job.id,
              campaignId: campaign.id,
              contactId,
              eventType: "sms_fallback_scheduled",
              channel: "sms",
              status: "pending",
              pushDeliveryId: delivery.id,
              scheduledAt: fallbackDueAt,
              metadata: JSON.stringify({ 
                fallbackDueAt: fallbackDueAt.toISOString(),
                reason: "Push notification sent, SMS fallback scheduled if not delivered",
              }),
            });
          }
        }

        // Log push_failed events
        for (const failedContactId of pushResult.failed) {
          const contact = trimmedContacts.find(c => c.id === failedContactId);
          if (contact) {
            const deviceToken = deviceTokens.find(dt => dt.contactId === failedContactId);
            await storage.createMessageLog({
              organizationId,
              jobId: job.id,
              campaignId: campaign.id,
              contactId: failedContactId,
              eventType: "push_failed",
              channel: "push",
              status: "failed",
              metadata: deviceToken ? JSON.stringify({ platform: deviceToken.platform }) : null,
            });
          }
        }

        // SMS fallback is now handled by cron job (processPendingSmsFallbacks)
        // The cron job checks fallbackDueAt in push_notification_deliveries table
        // and sends SMS to contacts whose push notifications weren't delivered
        
        // Remove contacts that successfully received push notifications from immediate SMS list
        // (They'll get SMS via cron job if delivery receipt doesn't come within 30 seconds)
        const pushSuccessSet = new Set(pushResult.success);
        contactsToSms = trimmedContacts.filter(contact => !pushSuccessSet.has(contact.id));

        console.log(`[SendMessage] Push notifications: ${pushSuccessCount} sent, ${pushFailedCount} failed. SMS will be sent to ${contactsToSms.length} contacts immediately. Push recipients will get SMS fallback via cron job if not delivered within 30 seconds.`);
      }

      const baseUrlFromRequest = `${req.protocol}://${req.get("host")}`;
      const rosterBaseUrl = (process.env.PUBLIC_BASE_URL || baseUrlFromRequest).replace(/\/$/, "");

      // Only send SMS to contacts without tokens or where push failed
      if (contactsToSms.length > 0) {
        await scheduleBatchedMessages(contactsToSms, {
          job,
          template,
          customMessage,
          campaign,
          organizationId,
          userId,
          availableCredits: contactsToSms.length,
          twilioClient,
          fromNumber,
          rosterBaseUrl,
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
        batchDelayMinutes: MESSAGE_BATCH_DELAY_MS / 60000,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/messages/bulk-sms", requireAuth, async (req: any, res) => {
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

      // Check if user has enough credits
      const availableCredits = await creditService.getAvailableCreditsForOrganization(organizationId);
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
        const contact = await storage.getContact(contactId, organizationId);
        if (!contact || contact.isOptedOut) continue;

        if (useTwilio) {
          try {
            const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
            const twilioMessage = await twilioClient.messages.create({
              body: message,
              from: fromNumber,
              to: e164Phone,
            });

            await storage.createMessage(organizationId, userId, {
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
              await storage.createMessage(organizationId, userId, {
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
              await storage.createMessage(organizationId, userId, {
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
          await storage.createMessage(organizationId, userId, {
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
      await creditService.consumeCreditsForOrganization(
        organizationId,
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

              const subscribingUser = await storage.getUser(userId);
              if (!subscribingUser?.organizationId) {
                console.error(`User ${userId} missing organization; cannot grant subscription credits`);
                break;
              }

              // Get currency from session metadata (defaults to GBP)
              const currency = session.metadata?.currency || "GBP";

              const subData = subscription as any;
              const subscriptionData: any = {
                planId,
                currency,
                stripeSubscriptionId: subscriptionId,
                status: subscription.status,
              };

              // Safely convert Stripe timestamps to Date objects
              if (subData.current_period_start && typeof subData.current_period_start === 'number') {
                subscriptionData.currentPeriodStart = new Date(subData.current_period_start * 1000);
              }
              if (subData.current_period_end && typeof subData.current_period_end === 'number') {
                subscriptionData.currentPeriodEnd = new Date(subData.current_period_end * 1000);
              }

              let userSub =
                (await storage.getSubscription(subscribingUser.organizationId)) ||
                (await storage.getSubscription(userId));

              if (userSub) {
                await storage.updateSubscription(userSub.userId ?? userId, subscriptionData);
              } else {
                await storage.createSubscription(userId, subscriptionData);
                userSub =
                  (await storage.getSubscription(subscribingUser.organizationId)) ||
                  (await storage.getSubscription(userId));
              }

              let expiryDate: Date;
              if (subData.current_period_end && typeof subData.current_period_end === 'number') {
                expiryDate = new Date(subData.current_period_end * 1000);
              } else {
                // Fallback: set expiry to 1 month from now if period_end is missing
                expiryDate = new Date();
                expiryDate.setMonth(expiryDate.getMonth() + 1);
              }
              
              await creditService.grantCredits(
                userId,
                "subscription",
                plan.monthlyCredits,
                planId,
                expiryDate
              );

              console.log(`Granted ${plan.monthlyCredits} credits to user ${userId} for subscription ${planId}`);

              // Record reseller transaction if user was referred
              const user = subscribingUser as any;
              if (user?.resellerId) {
                const reseller = await storage.getReseller(user.resellerId);
                if (reseller && reseller.status === "active") {
                  // Check if event already processed (idempotency)
                  const existing = await storage.getResellerTransactionByStripeEventId(event.id);
                  if (existing) {
                    console.log(`Event ${event.id} already processed, skipping reseller transaction`);
                  } else {
                    // Calculate revenue based on currency
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
                      occurredAt: new Date(),
                      stripeEventId: event.id,
                      stripeCheckoutId: session.id,
                    });

                    console.log(`Recorded reseller transaction for ${reseller.name}: ${revenueAmount} ${currency}, commission: ${commissionAmount}`);
                  }
                }
              }
            } else if (session.mode === "payment") {
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

              // Grant credits for the bundle purchase
              // Bundle credits don't expire (or have a very long expiry)
              const expiryDate = new Date();
              expiryDate.setFullYear(expiryDate.getFullYear() + 10); // 10 years from now

              const bundlePurchasingUser = await storage.getUser(userId);
              if (!bundlePurchasingUser?.organizationId) {
                console.error(`User ${userId} missing organization; cannot grant bundle credits`);
                break;
              }

              await creditService.grantCredits(
                userId,
                "bundle",
                bundle.credits,
                bundleId,
                expiryDate
              );

              console.log(`Granted ${bundle.credits} credits to user ${userId} for bundle ${bundleId}`);

              // Record reseller transaction if user was referred
              const user = bundlePurchasingUser as any;
              if (user?.resellerId) {
                const reseller = await storage.getReseller(user.resellerId);
                if (reseller && reseller.status === "active") {
                  // Check if event already processed (idempotency)
                  const existing = await storage.getResellerTransactionByStripeEventId(event.id);
                  if (existing) {
                    console.log(`Event ${event.id} already processed, skipping reseller transaction`);
                  } else {
                    // Get currency from session
                    const currency = session.metadata?.currency || user.currency || "GBP";
                    
                    // Calculate revenue based on currency
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
                      occurredAt: new Date(),
                      stripeEventId: event.id,
                      stripeCheckoutId: session.id,
                    });

                    console.log(`Recorded reseller transaction for ${reseller.name}: ${revenueAmount} ${currency}, commission: ${commissionAmount}`);
                  }
                }
              }
            }
            break;
          }

          case "invoice.payment_succeeded": {
            const invoice = event.data.object as any;
            const subscriptionId = typeof invoice.subscription === 'string' 
              ? invoice.subscription 
              : invoice.subscription?.id;

            if (!subscriptionId) {
              console.log("Invoice not for a subscription, skipping");
              break;
            }

            // Find the subscription
            const subscriptions = await storage.getAllSubscriptions() || [];
            const userSub = subscriptions.find(s => s.stripeSubscriptionId === subscriptionId);

            if (!userSub) {
              console.error(`Subscription ${subscriptionId} not found in database`);
              break;
            }

            // Get the subscription from Stripe
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            // Update subscription dates
            const subData = subscription as any;
            const updateData: any = {
              status: subscription.status,
            };

            // Safely convert Stripe timestamps to Date objects
            if (subData.current_period_start && typeof subData.current_period_start === 'number') {
              updateData.currentPeriodStart = new Date(subData.current_period_start * 1000);
            }
            if (subData.current_period_end && typeof subData.current_period_end === 'number') {
              updateData.currentPeriodEnd = new Date(subData.current_period_end * 1000);
            }

            await storage.updateSubscription(userSub.userId, updateData);

            // Grant credits for the new period (if not the first invoice)
            if (invoice.billing_reason === "subscription_cycle" && userSub.planId) {
              const plan = await storage.getSubscriptionPlan(userSub.planId);
              if (plan) {
                let expiryDate: Date;
                if (subData.current_period_end && typeof subData.current_period_end === 'number') {
                  expiryDate = new Date(subData.current_period_end * 1000);
                } else {
                  // Fallback: set expiry to 1 month from now if period_end is missing
                  expiryDate = new Date();
                  expiryDate.setMonth(expiryDate.getMonth() + 1);
                }
                
                await creditService.grantCredits(
                  userSub.userId,
                  "subscription",
                  plan.monthlyCredits,
                  userSub.planId,
                  expiryDate
                );

                console.log(`Granted ${plan.monthlyCredits} credits to user ${userSub.userId} for renewal`);

                // Record reseller transaction for recurring subscription
                const user = await storage.getUser(userSub.userId) as any;
                if (user?.resellerId) {
                  const reseller = await storage.getReseller(user.resellerId);
                  if (reseller && reseller.status === "active") {
                    // Check if event already processed (idempotency)
                    const existing = await storage.getResellerTransactionByStripeEventId(event.id);
                    if (existing) {
                      console.log(`Event ${event.id} already processed, skipping reseller transaction`);
                    } else {
                      const currency = userSub.currency || user.currency || "GBP";
                      
                      // Calculate revenue based on currency
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
                        occurredAt: new Date(),
                        stripeEventId: event.id,
                      });

                      console.log(`Recorded reseller renewal transaction for ${reseller.name}: ${revenueAmount} ${currency}, commission: ${commissionAmount}`);
                    }
                  }
                }
              }
            }
            break;
          }

          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            const subscriptionId = subscription.id;

            // Find the subscription in our database
            const allSubscriptions = await storage.getAllSubscriptions?.() || [];
            const userSubToUpdate = allSubscriptions.find(s => s.stripeSubscriptionId === subscriptionId);

            if (userSubToUpdate) {
              const subData = subscription as any;
              const updateData: any = {
                status: subscription.status,
              };

              // Handle cancellation at period end
              if (subscription.cancel_at_period_end) {
                updateData.cancelAtPeriodEnd = true;
                if (subData.cancel_at && typeof subData.cancel_at === 'number') {
                  updateData.cancelAt = new Date(subData.cancel_at * 1000);
                }
                console.log(`Subscription ${subscriptionId} set to cancel at period end for user ${userSubToUpdate.userId}`);
              } else {
                updateData.cancelAtPeriodEnd = false;
                updateData.cancelAt = null;
              }

              // Update period dates if available
              if (subData.current_period_start && typeof subData.current_period_start === 'number') {
                updateData.currentPeriodStart = new Date(subData.current_period_start * 1000);
              }
              if (subData.current_period_end && typeof subData.current_period_end === 'number') {
                updateData.currentPeriodEnd = new Date(subData.current_period_end * 1000);
              }

              await storage.updateSubscription(userSubToUpdate.userId, updateData);
              console.log(`Subscription ${subscriptionId} updated for user ${userSubToUpdate.userId}, status: ${subscription.status}, cancelAtPeriodEnd: ${subscription.cancel_at_period_end}`);
            } else {
              console.error(`Subscription ${subscriptionId} not found in database for update`);
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
                cancelAtPeriodEnd: false,
                cancelAt: null,
              });
              console.log(`Subscription ${subscriptionId} deleted/cancelled for user ${userSub.userId}`);
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

  app.post("/webhook/twilio/sms", async (req, res) => {
    try {
      const { From, Body, MessageSid } = req.body;

      // From is in E.164 format (e.g., +447123456789)
      // Need to strip country code to match stored phone numbers
      let phoneWithoutCountry = normalizePhoneNumber(From);
      
      // Try to match by removing common country codes
      // Common codes: +1 (US/CA), +44 (GB), +61 (AU), +64 (NZ), +353 (IE), +91 (IN), etc.
      const countryCodesToTry = ['1', '44', '61', '64', '353', '91', '65', '52', '49', '33', '34', '39'];
      
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
      
      // If still not found, try the full normalized number
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

      const messages = await storage.getMessages(contact.id, contact.organizationId);
      const recentMessages = messages.filter(
        (m) => m.direction === "outbound" && m.jobId
      ).slice(-5);

      const jobId = recentMessages.length > 0 ? recentMessages[recentMessages.length - 1].jobId : null;

      const inboundMessage = await storage.createMessage(contact.organizationId, contact.userId, {
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
        const availability = await storage.getAvailabilityForContact(jobId, contact.id, contact.organizationId);
        console.log("Parsed reply:", parsed);
        if (availability) {
          await storage.updateAvailability(availability.id, {
            status: parsed.status,
            shiftPreference: parsed.shiftPreference || availability.shiftPreference,
          });

          // Update contact status based on their reply
          if (parsed.status === "confirmed") {
            // Contact accepted the job - mark them as "on_job"
            await storage.updateContact(contact.id, { status: "on_job" });
            console.log("on job");
          } else if (parsed.status === "declined") {
            // Contact declined - mark them as "free" (available for other jobs)
            await storage.updateContact(contact.id, { status: "free" });
          }
          // "maybe" and "no_reply" don't change contact status

          // Log response_received event for SMS responses
          if (parsed.status === "confirmed" || parsed.status === "declined") {
            // Get campaignId from recent outbound messages
            const relatedMessage = recentMessages.find(m => m.jobId === jobId);
            const campaignId = relatedMessage?.campaignId || null;

            await storage.createMessageLog({
              organizationId: contact.organizationId,
              jobId: jobId,
              campaignId: campaignId,
              contactId: contact.id,
              eventType: "response_received",
              channel: "sms",
              status: "success",
              messageId: inboundMessage.id,
              responseStatus: parsed.status === "confirmed" ? "accepted" : "declined",
              metadata: JSON.stringify({ twilioSid: MessageSid, replyText: Body }),
            });
          }
        }

        // Send automatic acknowledgement SMS
        const job = await storage.getJob(jobId);
        if (job && parsed.status !== "no_reply") {
          await sendAcknowledgementSMS(contact.organizationId, contact, job, parsed, contact.userId);
          
          // Check if job is now fulfilled after this confirmation
          if (parsed.status === "confirmed") {
            await checkAndNotifyJobFulfillment(job, contact.organizationId);
          }
        }
      }

      res.status(200).send("OK");
    } catch (error: any) {
      console.error("Twilio webhook error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all messages for current user with enriched contact/job data
  app.get("/api/messages/history", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const organizationId = req.user.organizationId;
      const messages = await storage.getAllMessagesForUser(organizationId);
      
      // Enrich messages with contact and job information
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          const contact = await storage.getContact(msg.contactId, organizationId);
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

  app.get("/api/messages/:contactId", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      
      // Verify the contact belongs to the organization
      const contact = await storage.getContact(req.params.contactId, req.user.organizationId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const messages = await storage.getMessages(req.params.contactId, req.user.organizationId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/availability", requireAuth, async (req: any, res) => {
    try {
      const validated = insertAvailabilitySchema.parse(req.body);
      
      // Verify the contact belongs to the user
      const contact = await storage.getContactById(validated.contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (contact.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to create availability for this contact" });
      }
      
      const availability = await storage.createAvailability(req.user.organizationId, validated);
      res.json(availability);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/availability/:id", requireAuth, async (req: any, res) => {
    try {
      const { status, shiftPreference } = req.body;
      const organizationId = req.user.organizationId;
      
      if (!organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      
      // Get all availability records for the organization and find the specific one
      const allAvailability = await storage.getAllAvailability(organizationId);
      const availabilityRecord = allAvailability.find(a => a.id === req.params.id);
      
      if (!availabilityRecord) {
        return res.status(404).json({ message: "Availability record not found or not authorized" });
      }
      
      const updated = await storage.updateAvailability(req.params.id, {
        status,
        shiftPreference,
      });

      // Update contact status when availability changes (roster board drag-and-drop)
      if (status) {
        const contact = await storage.getContact(availabilityRecord.contactId, req.user.organizationId);
        if (contact) {
          if (status === "confirmed") {
            // Contact confirmed for job - mark them as "on_job"
            await storage.updateContact(contact.id, { status: "on_job" });
          } else if (status === "declined") {
            // Contact declined - mark them as "free" (available for other jobs)
            await storage.updateContact(contact.id, { status: "free" });
          }
          // "maybe" and "no_reply" don't change contact status
        }
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/subscription", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const subscription = await storage.getSubscription(req.user.organizationId);
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      res.json(subscription);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Credit system routes
  app.get("/api/credits", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const organizationId = req.user.organizationId;
      const [available, breakdown] = await Promise.all([
        creditService.getAvailableCredits(req.user.id),
        creditService.getCreditBreakdown(req.user.id),
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

  app.post("/api/create-bundle-checkout-session", requireAuth, async (req: any, res) => {
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

      // Map currency to Stripe format
      const stripeCurrency = currency.toLowerCase();
      
      // Get price based on currency
      let priceAmount = bundle.priceGBP;
      if (currency === "USD") {
        priceAmount = bundle.priceUSD;
      } else if (currency === "EUR") {
        priceAmount = bundle.priceEUR;
      }

      // Get or create Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id,
          },
        });
        customerId = customer.id;
        await storage.updateUser(userId, { stripeCustomerId: customerId } as any);
      }

      // Create one-time payment checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: stripeCurrency,
              product_data: {
                name: bundle.name,
                description: `${bundle.credits.toLocaleString()} SMS credits`,
              },
              unit_amount: priceAmount,
            },
            quantity: 1,
          },
        ],
        success_url: `${req.headers.origin}/billing?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/billing`,
        metadata: {
          userId,
          bundleId,
          credits: bundle.credits.toString(),
          type: "bundle_purchase",
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Bundle checkout session error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/create-checkout-session",requireAuth, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }

      // Get userId from req.user (set by requireAuth middleware) or fallback to session/header
      let userId = req.user?.id || req.userId || req.session?.userId || req.headers['x-user-id'] as string | undefined;

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
        await storage.updateUser(userId, { stripeCustomerId: customerId } as any);
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
      await storage.updateUser(userId, { currency } as any);

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout session error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/stripe/process-session", requireAuth, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }

      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.status !== "complete") {
        return res.status(400).json({ message: "Checkout session is not complete" });
      }

      const userId = session.metadata?.userId;
      if (!userId || userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const organizationId = req.user.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }

      let creditsGranted = 0;
      let purchaseType = "";

      if (session.mode === "subscription" && session.subscription) {
        purchaseType = "subscription";
        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const planId = session.metadata?.planId;

        if (!planId) {
          return res.status(400).json({ message: "No planId in session metadata" });
        }

        const plan = await storage.getSubscriptionPlan(planId);
        if (!plan) {
          return res.status(404).json({ message: `Plan ${planId} not found` });
        }

        const currency = session.metadata?.currency || "GBP";
        const subData = subscription as any;
        const subscriptionData: any = {
          planId,
          currency,
          stripeSubscriptionId: subscriptionId,
          status: subscription.status,
        };

        if (subData.current_period_start && typeof subData.current_period_start === "number") {
          subscriptionData.currentPeriodStart = new Date(subData.current_period_start * 1000);
        }
        if (subData.current_period_end && typeof subData.current_period_end === "number") {
          subscriptionData.currentPeriodEnd = new Date(subData.current_period_end * 1000);
        }

        let existingSubscription =
          (organizationId && (await storage.getSubscription(organizationId))) ||
          (await storage.getSubscription(userId));

        if (existingSubscription) {
          await storage.updateSubscription(existingSubscription.userId ?? userId, subscriptionData);
        } else {
          await storage.createSubscription(userId, subscriptionData);
          existingSubscription =
            (organizationId && (await storage.getSubscription(organizationId))) ||
            (await storage.getSubscription(userId));
        }

        // Also update user's subscriptionId field
        await storage.updateUser(userId, { subscriptionId } as any);

        let expiryDate: Date;
        if (subData.current_period_end && typeof subData.current_period_end === 'number') {
          expiryDate = new Date(subData.current_period_end * 1000);
        } else {
          expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        }

        await creditService.grantCredits(
          userId,
          "subscription",
          plan.monthlyCredits,
          planId,
          expiryDate
        );

        creditsGranted = plan.monthlyCredits;
        console.log(`Granted ${creditsGranted} credits to user ${userId} for subscription ${planId}`);

        // Manually record reseller transaction for subscription purchases
        const user = await storage.getUser(userId) as any;
        if (user?.resellerId) {
          const reseller = await storage.getReseller(user.resellerId);
          if (reseller && reseller.status === "active") {
            // Avoid double-counting if webhook already created a transaction for this checkout
            const existingTransactions = await storage.getResellerTransactions(reseller.id);
            const alreadyRecorded = existingTransactions.some(
              (t) => t.stripeCheckoutId === session.id,
            );
            if (!alreadyRecorded) {
              const resellerCurrency = session.metadata?.currency || user.currency || "GBP";
              let revenueAmount = 0;
              if (resellerCurrency === "GBP") {
                revenueAmount = plan.priceGBP;
              } else if (resellerCurrency === "USD") {
                revenueAmount = plan.priceUSD;
              } else if (resellerCurrency === "EUR") {
                revenueAmount = plan.priceEUR;
              }
              const commissionAmount = Math.round(
                revenueAmount * (reseller.commissionRate / 100),
              );

              await storage.createResellerTransaction({
                resellerId: reseller.id,
                userId,
                type: "subscription_purchase",
                amount: revenueAmount,
                currency: resellerCurrency,
                commissionAmount,
                occurredAt: new Date(),
                stripeCheckoutId: session.id,
              });
            }
          }
        }
      } else if (session.mode === "payment") {
        purchaseType = "bundle";
        const bundleId = session.metadata?.bundleId;

        console.log("Processing bundle purchase:", { bundleId, metadata: session.metadata });

        if (!bundleId) {
          console.error("No bundleId in session metadata:", session.metadata);
          return res.status(400).json({ message: "No bundleId in session metadata" });
        }

        const bundle = await storage.getSmsBundle(bundleId);
        if (!bundle) {
          console.error(`Bundle ${bundleId} not found in database`);
          return res.status(404).json({ message: `Bundle ${bundleId} not found` });
        }

        console.log(`Found bundle: ${bundle.name}, credits: ${bundle.credits}`);

        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 10);

        await creditService.grantCredits(
          userId,
          "bundle",
          bundle.credits,
          bundleId,
          expiryDate
        );

        creditsGranted = bundle.credits;
        console.log(`Granted ${creditsGranted} credits to user ${userId} for bundle ${bundleId}`);

        // Manually record reseller transaction for bundle purchases so earnings
        // show up even when webhooks are not configured locally.
        const user = await storage.getUser(userId) as any;
        if (user?.resellerId) {
          const reseller = await storage.getReseller(user.resellerId);
          if (reseller && reseller.status === "active") {
            // Avoid double-counting if webhook already created a transaction for this checkout
            const existingTransactions = await storage.getResellerTransactions(reseller.id);
            const alreadyRecorded = existingTransactions.some(
              (t) => t.stripeCheckoutId === session.id,
            );

            if (!alreadyRecorded) {
              const currency = session.metadata?.currency || user.currency || "GBP";

              let revenueAmount = 0;
              if (currency === "GBP") {
                revenueAmount = bundle.priceGBP;
              } else if (currency === "USD") {
                revenueAmount = bundle.priceUSD;
              } else if (currency === "EUR") {
                revenueAmount = bundle.priceEUR;
              }

              const commissionAmount = Math.round(
                revenueAmount * (reseller.commissionRate / 100),
              );

              await storage.createResellerTransaction({
                resellerId: reseller.id,
                userId,
                type: "bundle_purchase",
                amount: revenueAmount,
                currency,
                commissionAmount,
                occurredAt: new Date(),
                stripeCheckoutId: session.id,
              });
            }
          }
        }
      } else {
        console.error("Unknown session mode:", session.mode, "Session:", JSON.stringify(session, null, 2));
        return res.status(400).json({ 
          message: `Unsupported checkout session mode: ${session.mode}. Expected 'subscription' or 'payment'.` 
        });
      }

      const successMessage = purchaseType === "bundle" 
        ? "SMS bundle purchased successfully" 
        : "Subscription activated successfully";

      res.json({ 
        success: true, 
        creditsGranted,
        purchaseType,
        message: successMessage
      });
    } catch (error: any) {
      console.error("Process session error:", error);
      res.status(500).json({ message: error.message || "Failed to process session" });
    }
  });

  app.post("/api/stripe/create-portal-session", requireAuth, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }

      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || !user.stripeCustomerId) {
        return res.status(404).json({ message: "No Stripe customer found. Please subscribe to a plan first." });
      }

      const subscription =
        req.user.organizationId
          ? await storage.getSubscription(req.user.organizationId)
          : await storage.getSubscription(userId);
      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(404).json({ message: "No active subscription found." });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${req.headers.origin}/billing`,
      });

      res.json({ url: portalSession.url });
    } catch (error: any) {
      console.error("Create portal session error:", error);
      res.status(500).json({ message: error.message || "Failed to create portal session" });
    }
  });


  app.post("/api/subscription/cancel", requireAuth, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }

      const userId = req.user.id;
      const subscription =
        req.user.organizationId
          ? await storage.getSubscription(req.user.organizationId)
          : await storage.getSubscription(userId);
      
      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      // Cancel the subscription at period end
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update subscription status in database
      await storage.updateSubscription(userId, {
        status: "canceled",
      });

      res.json({ 
        success: true, 
        message: "Subscription will be canceled at the end of the current billing period",
        cancelAtPeriodEnd: true
      });
    } catch (error: any) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({ message: error.message || "Failed to cancel subscription" });
    }
  });

  // Cancel subscription with reason endpoint
  app.post("/api/subscription/cancel-with-reason", requireAuth, async (req: any, res) => {
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

      // Cancel the subscription at period end in Stripe
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update subscription status in database
      await storage.updateSubscription(userId, {
        status: "canceled",
      });

      // Log the cancellation reason as feedback
      const feedbackMessage = `Subscription Cancellation - Reason: ${reason}`;
      const fullFeedbackMessage = comments
        ? `${feedbackMessage}\nAdditional Comments: ${comments}`
        : feedbackMessage;
      await storage.createFeedback(organizationId, userId, {
        message: fullFeedbackMessage,
        userId: userId,
      } as any);

      try {
        const settings = await storage.getPlatformSettings();
        if (user) {
          await sendFeedbackNotificationEmail(settings.feedbackEmail, {
            message: fullFeedbackMessage,
            user: {
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              username: user.username,
            },
            organizationName: organization?.name ?? null,
          });
        }
      } catch (notifyError) {
        console.error("Cancellation feedback notification error:", notifyError);
      }

      // Send email notification to Nadeem
      try {
        if (user) {
          await sendCancellationNotification(user, reason);
        }
      } catch (emailError) {
        console.error("Failed to send cancellation notification email:", emailError);
        // Don't fail the cancellation if email fails
      }

      res.json({ 
        success: true,
        message: "Subscription will be canceled at the end of the current billing period. Thank you for your feedback.",
        cancelAtPeriodEnd: true
      });
    } catch (error: any) {
      console.error("Cancel subscription with reason error:", error);
      res.status(500).json({ message: error.message || "Failed to cancel subscription" });
    }
  });

  app.get("/api/credit-grants", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const grants = await storage.getCreditGrants(userId);
      res.json(grants);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/credit-transactions", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const transactions = await storage.getCreditTransactions(userId);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin middleware - checks if user is admin
  async function requireAdmin(req: any, res: any, next: any) {
    try {
      const adminId = req.session?.adminId;
      if (!adminId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const admin = await storage.getAdminUser(adminId);
      if (!admin) {
        delete req.session.adminId;
        return res.status(401).json({ message: "Not authenticated" });
      }

      req.admin = admin;
      next();
    } catch (error: any) {
      console.error("Admin middleware error:", error);
      res.status(500).json({ message: "Authentication error" });
    }
  }

  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getPlatformSettings();
      res.json(settings);
    } catch (error: any) {
      console.error("Get platform settings error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/settings", requireAdmin, async (req, res) => {
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
    } catch (error: any) {
      console.error("Update platform settings error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.issues.map((issue) => issue.message).join(", ") });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Feedback routes
  app.post("/api/feedback", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.organizationId) {
        return res.status(400).json({ message: "User not associated with an organization" });
      }
      const parsed = insertFeedbackSchema.parse(req.body);
      const feedback = await storage.createFeedback(
        req.user.organizationId,
        req.user.id,
        {
        ...parsed,
        userId: req.user.id,
        } as any
      );
      try {
        const [settings, organization] = await Promise.all([
          storage.getPlatformSettings(),
          req.user.organizationId ? storage.getOrganization(req.user.organizationId) : Promise.resolve(undefined),
        ]);

        await sendFeedbackNotificationEmail(settings.feedbackEmail, {
          message: parsed.message,
          user: {
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            username: req.user.username,
          },
          organizationName: organization?.name ?? null,
        });
      } catch (notifyError) {
        console.error("Feedback notification error:", notifyError);
      }

      res.json(feedback);
    } catch (error: any) {
      console.error("Create feedback error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/feedback", requireAdmin, async (req, res) => {
    try {
      const allFeedback = await storage.getAllFeedback();
      
      // Join with user information
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
              lastName: user.lastName,
            } : null,
          };
        })
      );
      
      res.json(feedbackWithUsers);
    } catch (error: any) {
      console.error("Get all feedback error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/feedback/:id/status", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !["new", "reviewed", "implemented"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'new', 'reviewed', or 'implemented'" });
      }
      
      const updatedFeedback = await storage.updateFeedbackStatus(id, status);
      res.json(updatedFeedback);
    } catch (error: any) {
      console.error("Update feedback status error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin routes
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allSubscriptions = await storage.getAllSubscriptions();
      const subscriptionByOrg = new Map<string, Subscription>();
      for (const subscription of allSubscriptions) {
        if (subscription.organizationId && !subscriptionByOrg.has(subscription.organizationId)) {
          subscriptionByOrg.set(subscription.organizationId, subscription);
        }
      }
      
      // Get subscription and credit info for each user
      const usersWithDetails = await Promise.all(
        allUsers.map(async (user) => {
          const [totalCredits, creditTransactions] = await Promise.all([
            storage.getTotalCredits(user.id),
            storage.getCreditTransactions(user.id),
          ]);

          const subscription = user.organizationId ? subscriptionByOrg.get(user.organizationId) : undefined;

          // Calculate SMS volume (total messages sent) from credit transactions
          const smsVolume = creditTransactions
            .filter(t => t.delta < 0 && t.messageId) // Negative delta means debit
            .reduce((sum, t) => sum + Math.abs(t.delta), 0);

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
      const targetUser = await storage.getUser(userId);
      if (!targetUser?.organizationId) {
        return res.status(400).json({ message: "Target user not associated with an organization" });
      }
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

  // Reseller Admin Routes
  app.get("/api/admin/resellers", requireAdmin, async (req, res) => {
    try {
      const resellers = await storage.getAllResellers();
      
      // Get transaction counts and revenue for each reseller
      const resellersWithStats = await Promise.all(
        resellers.map(async (reseller) => {
          const transactions = await storage.getResellerTransactions(reseller.id);
          const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
          const totalCommission = transactions.reduce((sum, t) => sum + t.commissionAmount, 0);
          
          // Count users referred by this reseller
          const allUsers = await storage.getAllUsers() as any[];
          const referredUsers = allUsers.filter((u: any) => u.resellerId === reseller.id);
          
          return {
            ...reseller,
            referredUsersCount: referredUsers.length,
            totalRevenue,
            totalCommission,
            transactionCount: transactions.length,
          };
        })
      );
      
      res.json(resellersWithStats);
    } catch (error: any) {
      console.error("Admin get resellers error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/resellers", requireAdmin, async (req, res) => {
    try {
      const { name, email, commissionRate } = req.body;

      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }

      if (commissionRate !== undefined && (commissionRate < 0 || commissionRate > 100)) {
        return res.status(400).json({ message: "Commission rate must be between 0 and 100" });
      }

      // Generate unique referral code
      const referralCode = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Math.random().toString(36).substring(2, 8)}`;

      const reseller = await storage.createReseller({
        name,
        email,
        commissionRate: commissionRate || 20,
        referralCode,
        status: "active",
      });

      res.json(reseller);
    } catch (error: any) {
      console.error("Admin create reseller error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/resellers/:resellerId", requireAdmin, async (req, res) => {
    try {
      const { resellerId } = req.params;
      const { name, email, commissionRate, status } = req.body;

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (status !== undefined) updates.status = status;
      if (commissionRate !== undefined) {
        if (commissionRate < 0 || commissionRate > 100) {
          return res.status(400).json({ message: "Commission rate must be between 0 and 100" });
        }
        updates.commissionRate = commissionRate;
      }

      const updatedReseller = await storage.updateReseller(resellerId, updates);
      res.json(updatedReseller);
    } catch (error: any) {
      console.error("Admin update reseller error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/resellers/:resellerId", requireAdmin, async (req, res) => {
    try {
      const { resellerId } = req.params;
      
      // Check if reseller has any transactions
      const transactions = await storage.getResellerTransactions(resellerId);
      if (transactions.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete reseller with existing transactions. Please disable the reseller instead." 
        });
      }
      
      // Check if reseller has any payouts
      const payouts = await storage.getResellerPayouts(resellerId);
      if (payouts.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete reseller with payout history. Please disable the reseller instead." 
        });
      }
      
      // Check if reseller has any referred users
      const allUsers = await storage.getAllUsers() as any[];
      const referredUsers = allUsers.filter((u: any) => u.resellerId === resellerId);
      if (referredUsers.length > 0) {
        return res.status(400).json({ 
          message: `Cannot delete reseller with ${referredUsers.length} referred users. Please disable the reseller instead.` 
        });
      }
      
      await storage.deleteReseller(resellerId);
      res.json({ success: true, message: "Reseller deleted" });
    } catch (error: any) {
      console.error("Admin delete reseller error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get reseller revenue report for a specific month
  app.get("/api/admin/resellers/:resellerId/report", requireAdmin, async (req, res) => {
    try {
      const { resellerId } = req.params;
      const { month, year } = req.query;

      if (!month || !year) {
        return res.status(400).json({ message: "Month and year are required" });
      }

      const monthNum = parseInt(month as string);
      const yearNum = parseInt(year as string);

      if (monthNum < 1 || monthNum > 12 || yearNum < 2000 || yearNum > 2100) {
        return res.status(400).json({ message: "Invalid month or year" });
      }

      // Get reseller details
      const reseller = await storage.getReseller(resellerId);
      if (!reseller) {
        return res.status(404).json({ message: "Reseller not found" });
      }

      // Get transactions for the month
      const transactions = await storage.getResellerTransactionsByMonth(resellerId, monthNum, yearNum);

      // Calculate revenue breakdown
      const newRevenue = transactions
        .filter(t => t.type === "subscription_start")
        .reduce((sum, t) => sum + t.amount, 0);

      const recurringRevenue = transactions
        .filter(t => t.type === "subscription_renewal")
        .reduce((sum, t) => sum + t.amount, 0);

      const bundleRevenue = transactions
        .filter(t => t.type === "bundle_purchase")
        .reduce((sum, t) => sum + t.amount, 0);

      const totalRevenue = newRevenue + recurringRevenue + bundleRevenue;
      const totalCommission = transactions.reduce((sum, t) => sum + t.commissionAmount, 0);

      // Get or create payout record
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
          currency: "GBP", // Default currency
          transactionCount: transactions.length,
          status: "pending",
          lastCalculatedAt: new Date(),
        });
      } else {
        // Update payout with latest calculations
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
          lastCalculatedAt: new Date(),
        });
      }

      res.json({
        reseller: {
          id: reseller.id,
          name: reseller.name,
          email: reseller.email,
          commissionRate: reseller.commissionRate,
        },
        period: {
          month: monthNum,
          year: yearNum,
        },
        revenue: {
          new: newRevenue,
          recurring: recurringRevenue,
          bundles: bundleRevenue,
          total: totalRevenue,
        },
        commission: {
          amount: totalCommission,
          rate: reseller.commissionRate,
        },
        transactions: transactions.map(t => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          currency: t.currency,
          commissionAmount: t.commissionAmount,
          occurredAt: t.occurredAt,
        })),
        payout,
      });
    } catch (error: any) {
      console.error("Admin get reseller report error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const admin = await storage.getAdminUserByEmail(email);
      if (!admin) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, admin.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.adminId = admin.id;
      res.json({ success: true, admin: sanitizeAdmin(admin) });
    } catch (error: any) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: error.message || "Failed to login" });
    }
  });

  app.post("/api/admin/auth/logout", async (req, res) => {
    delete req.session.adminId;
    res.json({ success: true });
  });

  app.get("/api/admin/auth/me", async (req, res) => {
    try {
      const adminId = req.session.adminId;
      if (!adminId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const admin = await storage.getAdminUser(adminId);
      if (!admin) {
        delete req.session.adminId;
        return res.status(401).json({ message: "Not authenticated" });
      }

      res.json({ admin: sanitizeAdmin(admin) });
    } catch (error: any) {
      console.error("Admin auth me error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/auth/change-password", requireAdmin, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }

      const admin = req.admin as AdminUser;
      const valid = await bcrypt.compare(currentPassword, admin.password);
      if (!valid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const updatedAdmin = await storage.updateAdminUser(admin.id, { password: hashedPassword });

      res.json({ success: true, admin: sanitizeAdmin(updatedAdmin) });
    } catch (error: any) {
      console.error("Admin change password error:", error);
      res.status(500).json({ message: error.message || "Failed to change password" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

async function sendAcknowledgementSMS(
  organizationId: string,
  contact: any,
  job: any,
  parsed: any,
  userId: string
) {
  try {
    let twilioClient: any = null;
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
      day: "numeric",
    });
    const jobTime = new Date(job.startTime).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
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
      const twilioMessage = await twilioClient!.messages.create({
        body: message,
        from: fromNumber,
        to: e164Phone,
      });

      await storage.createMessage(organizationId, userId, {
        contactId: contact.id,
        jobId: job.id,
        campaignId: null,
        direction: "outbound",
        content: message,
        status: "sent",
        twilioSid: twilioMessage.sid,
      });

      await creditService.consumeCreditsForOrganization(
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