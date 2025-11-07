import { format } from "date-fns";
import type { Contact, Job } from "@shared/schema";

export function renderTemplate(template: string, contact: Contact, job: Job): string {
  return template
    .replace(/{FirstName}/g, contact.firstName)
    .replace(/{LastName}/g, contact.lastName)
    .replace(/{JobName}/g, job.name)
    .replace(/{Date}/g, format(new Date(job.startTime), "MMMM d, yyyy"))
    .replace(/{Time}/g, format(new Date(job.startTime), "h:mm a"))
    .replace(/{FromDate}/g, format(new Date(job.startTime), "MMMM d, yyyy"))
    .replace(/{ToDate}/g, format(new Date(job.endTime), "MMMM d, yyyy"))
    .replace(/{FromTime}/g, format(new Date(job.startTime), "h:mm a"))
    .replace(/{ToTime}/g, format(new Date(job.endTime), "h:mm a"))
    .replace(/{Location}/g, job.location);
}
