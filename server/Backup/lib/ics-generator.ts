import type { Job } from "@shared/schema";

/**
 * Generates an iCalendar (.ics) file for a job
 * This follows the RFC 5545 iCalendar specification
 */
export function generateICS(job: Job): string {
  const now = new Date();
  const dtStamp = formatICSDate(now);
  const dtStart = formatICSDate(new Date(job.startTime));
  const dtEnd = formatICSDate(new Date(job.endTime));
  
  // Generate a unique UID for the event using job ID
  const uid = `${job.id}@heyteam.app`;
  
  // Escape special characters in text fields according to RFC 5545
  const summary = escapeICSText(job.name);
  const description = job.description ? escapeICSText(job.description) : '';
  const location = job.location ? escapeICSText(job.location) : '';
  
  // Build the ICS content
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HeyTeam//Job Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
  ];
  
  if (description) {
    icsLines.push(`DESCRIPTION:${description}`);
  }
  
  if (location) {
    icsLines.push(`LOCATION:${location}`);
  }
  
  icsLines.push(
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  );
  
  // Join with CRLF line endings as per RFC 5545
  return icsLines.join('\r\n');
}

/**
 * Formats a Date object to iCalendar date-time format (YYYYMMDDTHHMMSSZ)
 */
function formatICSDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escapes special characters in text fields according to RFC 5545
 * Backslashes, semicolons, commas, and newlines need to be escaped
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')  // Escape backslashes
    .replace(/;/g, '\\;')     // Escape semicolons
    .replace(/,/g, '\\,')     // Escape commas
    .replace(/\n/g, '\\n');   // Escape newlines
}
