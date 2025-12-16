import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { CreditService } from "./lib/credit-service";
import { sendPasswordResetEmail } from "./email";

const creditService = new CreditService(storage);

const router = Router();

// Middleware to extract userId from header (for mobile apps)
const getMobileUserId = (req: Request): string | null => {
  // Check X-User-ID header first
  const userId = req.headers['x-user-id'] as string;
  if (userId) {
    return userId;
  }
  return null;
};

// Middleware to require mobile auth (userId in header)
const requireMobileAuth = async (req: Request, res: Response, next: any) => {
  const userId = getMobileUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Not authenticated - missing X-User-ID header" });
  }
  
  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }
  
  (req as any).user = user;
  (req as any).userId = userId;
  next();
};

// Register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, firstName, lastName, email, password, countryCode, mobileNumber, referralCode } = req.body;
    
    // Validate input
    const { username: validUsername, firstName: validFirstName, lastName: validLastName, email: validEmail, password: validPassword, countryCode: validCountryCode, mobileNumber: validMobileNumber } = insertUserSchema.parse({ username, firstName, lastName, email, password, countryCode, mobileNumber });

    // Check if user already exists
    const existingUser = await storage.getUserByUsername(validUsername);
    if (existingUser) {
      return res.status(400).json({ message: "Company name already exists" });
    }

    const existingEmail = await storage.getUserByEmail(validEmail);
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Validate referral code if provided
    let resellerId: string | null = null;
    if (referralCode) {
      const reseller = await storage.getResellerByReferralCode(referralCode);
      if (!reseller) {
        return res.status(400).json({ message: "Invalid referral code" });
      }
      if (reseller.status !== "active") {
        return res.status(400).json({ message: "This referral code is no longer active" });
      }
      resellerId = reseller.id;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validPassword, 10);

    // Create user
    const user = await storage.createUser({
      username: validUsername,
      firstName: validFirstName,
      lastName: validLastName,
      email: validEmail,
      password: hashedPassword,
      countryCode: validCountryCode,
      mobileNumber: validMobileNumber,
      resellerId,
    });

    // Award signup credits
    await creditService.grantCredits(
      user.id,
      "trial",
      10,
      null, // No source reference
      null  // No expiry for trial credits
    );

    console.log(`[Mobile Register] User created: ${user.email}, ID: ${user.id}`);

    // Return user data with userId (no session needed)
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      currency: user.currency,
      isAdmin: user.isAdmin,
      organizationId: user.organizationId,
      teamRole: user.teamRole,
      emailVerified: user.emailVerified,
      mobileVerified: user.mobileVerified,
      userId: user.id, // For mobile apps - store this in preferences
    });
  } catch (error: any) {
    console.error("Register error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: error.message || "Failed to register" });
  }
});

// Login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // First, try to find a user (manager/admin)
    const user = await storage.getUserByEmail(email);
    if (user) {
      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log(`[Mobile Login] User logged in: ${user.email}, ID: ${user.id}`);

      // Return user data with userId (no session needed for mobile)
      return res.json({
        type: "user",
        id: user.id,
        username: user.username,
        email: user.email,
        currency: user.currency,
        isAdmin: user.isAdmin,
        organizationId: user.organizationId,
        teamRole: user.teamRole,
        emailVerified: user.emailVerified,
        mobileVerified: user.mobileVerified,
        userId: user.id, // For mobile apps - store this in preferences
      });
    }

    // If not a user, try to find a contact with login enabled
    const contact = await storage.getContactByEmail(email);
    if (contact && contact.hasLogin) {
      // Check if contact has password set
      if (!contact.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, contact.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Update last login timestamp
      await storage.updateContact(contact.id, { lastLoginAt: new Date() });

      console.log(`[Mobile Login] Contact logged in: ${contact.email}, ID: ${contact.id}`);

      // Return contact data with contactId (no session needed for mobile)
      return res.json({
        type: "contact",
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        organizationId: contact.organizationId,
        phone: contact.phone,
        countryCode: contact.countryCode,
        contactId: contact.id, // For mobile apps - store this in preferences
      });
    }

    // Neither user nor contact found
    return res.status(401).json({ message: "Invalid credentials" });

  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ message: error.message || "Failed to login" });
  }
});

// Get current user or contact (requires X-User-ID or X-Contact-ID header)
router.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const contactId = req.headers['x-contact-id'] as string;
    console.log("UserID:",userId );
        console.log("ContactID:",contactId );
    if (userId) {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      return res.json({
        type: "user",
        id: user.id,
        username: user.username,
        email: user.email,
        currency: user.currency,
        isAdmin: user.isAdmin,
        organizationId: user.organizationId,
        teamRole: user.teamRole,
        emailVerified: user.emailVerified,
        mobileVerified: user.mobileVerified,
      });
    }

    if (contactId) {
      const contact = await storage.getContactById(contactId);
      if (!contact) {
        return res.status(401).json({ message: "Contact not found" });
      }
      return res.json({
        type: "contact",
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        organizationId: contact.organizationId,
        phone: contact.phone,
        countryCode: contact.countryCode,
      });
    }

    return res.status(401).json({ message: "Not authenticated - missing X-User-ID or X-Contact-ID header" });
  } catch (error: any) {
    console.error("Get user/contact error:", error);
    res.status(500).json({ message: "Failed to get user/contact" });
  }
});

// Logout (just returns success - client removes userId from storage)
router.post("/logout", requireMobileAuth, async (req: Request, res: Response) => {
  res.json({ message: "Logged out successfully" });
});

// Password reset request
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return res.json({ message: "If that email exists, a password reset link has been sent" });
    }

    const resetToken = randomBytes(32).toString("hex");
    //await storage.setPasswordResetToken(user.id, resetToken);

    //await sendPasswordResetEmail(user.email, resetToken);

    res.json({ message: "If that email exists, a password reset link has been sent" });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Failed to send password reset email" });
  }
});

// Password reset
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: "Token and password required" });
    }

    //const user = await storage.getUserByPasswordResetToken(token);
    // if (!user) {
    //   return res.status(400).json({ message: "Invalid or expired token" });
    // }

    // const hashedPassword = await bcrypt.hash(password, 10);
    // await storage.updateUserPassword(user.id, hashedPassword);
    //await storage.clearPasswordResetToken(user.id);

    res.json({ message: "Password reset successfully" });
  } catch (error: any) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

export default router;

