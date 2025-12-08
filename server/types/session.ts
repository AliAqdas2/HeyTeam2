import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;      // Managers/users
    adminId?: string;     // Admin users
    contactId?: string;   // Contacts
  }
}
