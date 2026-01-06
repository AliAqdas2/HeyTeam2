/**
 * Cron Jobs for Message Delivery System
 * 
 * This module contains scheduled tasks that run periodically to ensure
 * reliable message delivery, including SMS fallback for push notifications.
 */

import { storage } from "./storage";
import type { Contact, Job, Template, Campaign, PushNotificationDelivery } from "@shared/schema";
import { format } from "date-fns";

// Import utilities from routes (these would ideally be in a shared module)
let twilioClient: any = null;
let fromNumber: string = "";
let rosterBaseUrl: string = "";

// Twilio client getter functions (to be initialized from index.ts)
let getTwilioClientFn: () => Promise<any> = async () => null;
let getTwilioFromPhoneNumberFn: () => Promise<string> = async () => "";

export function initCronDependencies(
  getTwilioClient: () => Promise<any>,
  getTwilioFromPhoneNumber: () => Promise<string>,
  baseUrl: string
) {
  getTwilioClientFn = getTwilioClient;
  getTwilioFromPhoneNumberFn = getTwilioFromPhoneNumber;
  rosterBaseUrl = baseUrl;
}

/**
 * Constructs E.164 formatted phone number
 */
function constructE164Phone(countryCode: string, phone: string): string {
  // Remove any non-digit characters
  const cleanPhone = phone.replace(/\D/g, "");
  
  // Map country code to dial prefix
  const countryDialCodes: Record<string, string> = {
    US: "+1",
    CA: "+1",
    GB: "+44",
    AU: "+61",
    NZ: "+64",
    DE: "+49",
    FR: "+33",
    ES: "+34",
    IT: "+39",
    NL: "+31",
    BE: "+32",
    AT: "+43",
    CH: "+41",
    SE: "+46",
    NO: "+47",
    DK: "+45",
    FI: "+358",
    IE: "+353",
    PT: "+351",
    PL: "+48",
    CZ: "+420",
    HU: "+36",
    RO: "+40",
    BG: "+359",
    GR: "+30",
    HR: "+385",
    SK: "+421",
    SI: "+386",
    // Add more as needed
  };
  
  const dialCode = countryDialCodes[countryCode.toUpperCase()] || "+1";
  
  // If phone already starts with +, return as is
  if (cleanPhone.startsWith("+")) {
    return cleanPhone;
  }
  
  // If phone starts with the country dial code digits, prepend +
  const dialDigits = dialCode.replace("+", "");
  if (cleanPhone.startsWith(dialDigits)) {
    return `+${cleanPhone}`;
  }
  
  // Otherwise, prepend the full dial code
  return `${dialCode}${cleanPhone}`;
}

/**
 * Renders template variables with contact and job data
 */
function renderTemplate(template: string, contact: Contact, job: Job): string {
  return template
    .replace(/{{firstName}}/g, contact.firstName)
    .replace(/{{lastName}}/g, contact.lastName)
    .replace(/{{jobName}}/g, job.name)
    .replace(/{{jobLocation}}/g, job.location)
    .replace(/{{jobDate}}/g, format(new Date(job.startTime), "MMM d, yyyy"))
    .replace(/{{jobTime}}/g, format(new Date(job.startTime), "h:mm a"));
}

/**
 * Process pending SMS fallbacks for push notifications that weren't delivered.
 * This function is called by the cron scheduler every 15 seconds.
 */
export async function processPendingSmsFallbacks(): Promise<void> {
  try {
    // Get pending fallbacks atomically (marks them as processing)
    const pendingFallbacks = await storage.getAndLockPendingFallbacks();
    
    if (pendingFallbacks.length === 0) {
      return;
    }
    
    console.log(`[CronJob] Processing ${pendingFallbacks.length} pending SMS fallbacks`);
    
    // Initialize Twilio client if not already done
    try {
      twilioClient = await getTwilioClientFn();
      fromNumber = await getTwilioFromPhoneNumberFn();
    } catch (error) {
      console.log("[CronJob] Twilio not configured, messages will be logged only");
    }
    
    // Group by campaign for efficiency
    const byCampaign = new Map<string, PushNotificationDelivery[]>();
    for (const delivery of pendingFallbacks) {
      const key = delivery.campaignId || 'no-campaign';
      if (!byCampaign.has(key)) {
        byCampaign.set(key, []);
      }
      byCampaign.get(key)!.push(delivery);
    }
    
    // Process each campaign's fallbacks
    for (const [campaignId, deliveries] of byCampaign) {
      await processCampaignFallbacks(campaignId, deliveries);
    }
    
    console.log(`[CronJob] Completed processing ${pendingFallbacks.length} SMS fallbacks`);
  } catch (error) {
    console.error("[CronJob] Error in processPendingSmsFallbacks:", error);
  }
}

/**
 * Process fallbacks for a specific campaign
 */
async function processCampaignFallbacks(
  campaignId: string,
  deliveries: PushNotificationDelivery[]
): Promise<void> {
  if (deliveries.length === 0) return;
  
  const firstDelivery = deliveries[0];
  const jobId = firstDelivery.jobId;
  const organizationId = firstDelivery.organizationId;
  
  // Fetch job
  const job = await storage.getJob(jobId);
  if (!job) {
    console.error(`[CronJob] Job ${jobId} not found for fallback processing`);
    return;
  }
  
  // Fetch template or get custom message
  let template: Template | undefined;
  let customMessage: string | undefined;
  
  if (firstDelivery.templateId) {
    template = await storage.getTemplate(firstDelivery.templateId);
  }
  if (firstDelivery.customMessage) {
    customMessage = firstDelivery.customMessage;
  }
  
  if (!template && !customMessage) {
    console.error(`[CronJob] No template or custom message for fallback - campaign ${campaignId}`);
    return;
  }
  
  // Process each delivery
  for (const delivery of deliveries) {
    await sendSmsFallback(delivery, job, template, customMessage, organizationId);
  }
}

/**
 * Send SMS fallback for a single delivery
 */
async function sendSmsFallback(
  delivery: PushNotificationDelivery,
  job: Job,
  template: Template | undefined,
  customMessage: string | undefined,
  organizationId: string | null
): Promise<void> {
  const processingStartTime = Date.now();
  
  try {
    // Fetch contact
    const contact = await storage.getContact(delivery.contactId);
    if (!contact) {
      console.error(`[CronJob] Contact ${delivery.contactId} not found for SMS fallback`);
      return;
    }
    
    // Skip opted-out contacts
    if (contact.isOptedOut) {
      console.log(`[CronJob] Skipping opted-out contact ${contact.id}`);
      return;
    }
    
    // Skip contacts with login (they get messages in portal)
    if (contact.hasLogin) {
      console.log(`[CronJob] Contact ${contact.id} has login, updating status to delivered (portal)`);
      await storage.updatePushNotificationDelivery(delivery.id, {
        status: "delivered",
        deliveredAt: new Date(),
      });
      return;
    }
    
    // Log sms_fallback_triggered event
    await storage.createMessageLog({
      organizationId: organizationId || '',
      jobId: job.id,
      campaignId: delivery.campaignId,
      contactId: contact.id,
      eventType: "sms_fallback_triggered",
      channel: "sms",
      status: "pending",
      pushDeliveryId: delivery.id,
      scheduledAt: delivery.fallbackDueAt,
      metadata: JSON.stringify({
        reason: "Push notification not delivered within timeout",
        delayMs: Date.now() - (delivery.fallbackDueAt?.getTime() || 0),
      }),
    });
    
    // Determine message content
    let messageContent: string;
    if (customMessage) {
      messageContent = customMessage
        .replace(/{{firstName}}/g, contact.firstName)
        .replace(/{{lastName}}/g, contact.lastName)
        .replace(/{{jobName}}/g, job.name)
        .replace(/{{jobLocation}}/g, job.location)
        .replace(/{{jobDate}}/g, format(new Date(job.startTime), "MMM d, yyyy"))
        .replace(/{{jobTime}}/g, format(new Date(job.startTime), "h:mm a"));
    } else if (template) {
      messageContent = renderTemplate(template.content, contact, job);
    } else {
      console.error(`[CronJob] No message content for fallback`);
      return;
    }
    
    let twilioSid: string | null = null;
    let status = "sent";
    let errorMessage: string | null = null;
    
    // Send via Twilio
    if (twilioClient && fromNumber) {
      try {
        const e164Phone = constructE164Phone(contact.countryCode || "US", contact.phone);
        const twilioMessage = await twilioClient.messages.create({
          body: messageContent,
          from: fromNumber,
          to: e164Phone,
        });
        twilioSid = twilioMessage.sid;
        console.log(`[CronJob] SMS fallback sent to ${contact.id} - Twilio SID: ${twilioSid}`);
      } catch (error: any) {
        status = "failed";
        errorMessage = error?.message || "Twilio send failed";
        console.error(`[CronJob] SMS fallback failed for ${contact.id}: ${errorMessage}`);
      }
    } else {
      console.log(`[DEV MODE] Would send SMS fallback to ${contact.phone}: ${messageContent}`);
      twilioSid = `dev-fallback-${Date.now()}`;
    }
    
    const processingTimeMs = Date.now() - processingStartTime;
    
    // Update delivery record
    await storage.updatePushNotificationDelivery(delivery.id, {
      status: status === "sent" ? "sms_fallback" : "failed",
      smsFallbackSentAt: new Date(),
    });
    
    // Create message record
    if (organizationId) {
      // Note: We don't have userId in cron context, using empty string
      // In production, you might want to store userId in delivery record
      await storage.createMessage(organizationId, '', {
        contactId: contact.id,
        jobId: job.id,
        campaignId: delivery.campaignId,
        direction: "outbound",
        content: messageContent,
        status,
        twilioSid,
      });
    }
    
    // Log the final event
    if (status === "sent") {
      await storage.createMessageLog({
        organizationId: organizationId || '',
        jobId: job.id,
        campaignId: delivery.campaignId,
        contactId: contact.id,
        eventType: "sms_sent",
        channel: "sms",
        status: "success",
        twilioSid,
        pushDeliveryId: delivery.id,
        sentAt: new Date(),
        costCredits: 1,
        processingTimeMs,
        metadata: JSON.stringify({
          isFallback: true,
          phone: contact.phone,
          countryCode: contact.countryCode,
        }),
      });
    } else {
      await storage.createMessageLog({
        organizationId: organizationId || '',
        jobId: job.id,
        campaignId: delivery.campaignId,
        contactId: contact.id,
        eventType: "sms_failed",
        channel: "sms",
        status: "failed",
        pushDeliveryId: delivery.id,
        errorMessage,
        failedAt: new Date(),
        processingTimeMs,
        metadata: JSON.stringify({
          isFallback: true,
          phone: contact.phone,
          countryCode: contact.countryCode,
        }),
      });
    }
  } catch (error) {
    console.error(`[CronJob] Error processing SMS fallback for delivery ${delivery.id}:`, error);
    
    // Log error but don't throw - we want to continue processing other fallbacks
    try {
      await storage.createMessageLog({
        organizationId: organizationId || '',
        jobId: job.id,
        campaignId: delivery.campaignId,
        contactId: delivery.contactId,
        eventType: "sms_failed",
        channel: "sms",
        status: "failed",
        pushDeliveryId: delivery.id,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        failedAt: new Date(),
        metadata: JSON.stringify({ isFallback: true, error: String(error) }),
      });
    } catch (logError) {
      console.error("[CronJob] Failed to log error:", logError);
    }
  }
}

/**
 * Check for stale fallbacks that might have failed processing
 * and reset them for retry
 */
export async function checkStaleFallbacks(): Promise<void> {
  // This could be run less frequently (every 5 minutes) to catch edge cases
  // where fallbackProcessed was set but processing failed
  console.log("[CronJob] Checking for stale fallbacks...");
  // Implementation would reset fallbackProcessed for old entries that are still "sent"
  // For now, this is a placeholder for future enhancement
}

