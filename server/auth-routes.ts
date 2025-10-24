import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { CreditService } from "./lib/credit-service";

const creditService = new CreditService(storage);

const router = Router();

// Register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, email, password, countryCode, mobileNumber } = insertUserSchema.parse(req.body);

    // Check if user already exists (username is now company name)
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: "Company name already exists" });
    }

    const existingEmail = await storage.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with mobile number
    const user = await storage.createUser({
      username, // Company name
      email,
      countryCode,
      mobileNumber,
      password: hashedPassword,
    });

    // Grant 10 trial SMS credits to new users (non-expiring)
    await creditService.grantCredits(
      user.id,
      "trial",
      10,
      null, // No source reference
      null  // No expiry for trial credits
    );

    console.log(`New registration: ${username} - Granted 10 trial SMS credits`);
    console.log(`Email: ${email}`);
    console.log(`Mobile: ${countryCode} ${mobileNumber}`);
    console.log(`Account created but not verified`);

    // Set session
    req.session.userId = user.id;

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      organizationId: user.organizationId,
      teamRole: user.teamRole,
      emailVerified: user.emailVerified,
      mobileVerified: user.mobileVerified,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});

// Login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // Find user by email
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Set session
    req.session.userId = user.id;

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
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

// Logout
router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.json({ message: "Logged out successfully" });
  });
});

// Get current user
router.get("/me", async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      mobileNumber: user.mobileNumber,
      countryCode: user.countryCode,
      currency: user.currency,
      isAdmin: user.isAdmin,
      organizationId: user.organizationId,
      teamRole: user.teamRole,
      emailVerified: user.emailVerified,
      mobileVerified: user.mobileVerified,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Failed to get user" });
  }
});

// Update user profile
router.patch("/profile", async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { firstName, lastName, email, mobileNumber, countryCode } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: "First name, last name, and email are required" });
    }

    // Update user
    const updatedUser = await storage.updateUser(req.session.userId, {
      firstName,
      lastName,
      email,
      mobileNumber: mobileNumber || null,
      countryCode: countryCode || null,
    });

    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      mobileNumber: updatedUser.mobileNumber,
      countryCode: updatedUser.countryCode,
      currency: updatedUser.currency,
      isAdmin: updatedUser.isAdmin,
      organizationId: updatedUser.organizationId,
      teamRole: updatedUser.teamRole,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// Forgot password - Request reset
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: "If the email exists, a reset link will be sent" });
    }

    // Generate reset token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await storage.createPasswordResetToken({
      userId: user.id,
      token,
      expiresAt,
    });

    // TODO: Send email with reset link
    // For now, log the token (in production, send via email)
    console.log(`Password reset token for ${email}: ${token}`);
    console.log(`Reset link: http://localhost:5000/reset-password?token=${token}`);

    res.json({ message: "If the email exists, a reset link will be sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Failed to process request" });
  }
});

// Reset password
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Token and password required" });
    }

    // Find token
    const resetToken = await storage.getPasswordResetToken(token);
    if (!resetToken) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Check if expired
    if (new Date() > resetToken.expiresAt) {
      await storage.deletePasswordResetToken(token);
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    await storage.updateUserPassword(resetToken.userId, hashedPassword);

    // Delete used token
    await storage.deletePasswordResetToken(token);

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

export default router;
