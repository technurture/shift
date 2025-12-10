import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import { extractEmailsFromUrl } from "./lib/email-extractor";
import { signToken, verifyToken } from "./lib/jwt";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPlanUpgradeEmail,
  sendContactEmail,
} from "./lib/email";

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const PLAN_PRICES: Record<string, number> = {
  basic: 5000000,
  premium: 15000000,
};

async function getUserIdFromRequest(req: Request): Promise<string | null> {
  if (req.session?.userId) {
    return req.session.userId;
  }
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded) {
      return decoded.userId;
    }
  }
  
  return null;
}

// Plan limits configuration
const PLAN_LIMITS = {
  free: { links: 500, emails: 500 },
  basic: { links: 1000, emails: 1000 },
  premium: { links: Infinity, emails: Infinity },
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Auth Routes (Session-based for web clients)
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = insertUserSchema.parse(req.body);
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
      });
      
      // Generate verification code and set expiry (15 minutes)
      const verificationCode = generateVerificationCode();
      const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
      await storage.updateVerificationCode(user.id, verificationCode, verificationCodeExpiry);
      
      // Send verification email
      await sendVerificationEmail(email, verificationCode, firstName);
      
      // Set session for web
      req.session.userId = user.id;
      
      // Don't send password back
      const { password: _, ...userWithoutPassword } = user;
      res.json({ ...userWithoutPassword, isEmailVerified: false });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create account" });
    }
  });
  
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      
      // Get user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Check password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Set session for web
      req.session.userId = user.id;
      
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Login failed" });
    }
  });
  
  // Mobile Auth Routes (JWT-based for mobile clients)
  app.post("/api/mobile/auth/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = insertUserSchema.parse(req.body);
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
      });
      
      // Generate verification code and set expiry (15 minutes)
      const verificationCode = generateVerificationCode();
      const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
      await storage.updateVerificationCode(user.id, verificationCode, verificationCodeExpiry);
      
      // Send verification email
      await sendVerificationEmail(email, verificationCode, firstName);
      
      // Generate JWT token for mobile
      const token = signToken(user.id);
      
      // Don't send password back
      const { password: _, ...userWithoutPassword } = user;
      res.json({ ...userWithoutPassword, isEmailVerified: false, token });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create account" });
    }
  });
  
  app.post("/api/mobile/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      
      // Get user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Check password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Generate JWT token for mobile
      const token = signToken(user.id);
      
      const { password: _, ...userWithoutPassword } = user;
      res.json({ ...userWithoutPassword, token });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Login failed" });
    }
  });
  
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err: Error | null) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });
  
  app.get("/api/auth/me", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });
  
  // Extraction Routes
  app.post("/api/extract", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      
      // Check plan limits
      const limits = await storage.getUserPlanLimits(userId);
      const planLimit = PLAN_LIMITS[limits.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
      
      if (limits.linksScanned >= planLimit.links) {
        return res.status(403).json({ 
          error: "Link scan limit reached. Please upgrade your plan.",
          limitReached: true 
        });
      }
      
      // Extract emails
      const result = await extractEmailsFromUrl(url);
      
      if (result.error) {
        // Still create extraction record with failed status
        const extraction = await storage.createExtraction({
          userId,
          url,
          status: "failed",
          emails: [],
        });
        
        return res.status(400).json({ 
          error: result.error,
          extraction 
        });
      }
      
      // Check email limit
      if (limits.emailsExtracted + result.emails.length > planLimit.emails) {
        return res.status(403).json({ 
          error: "Email extraction limit reached. Please upgrade your plan.",
          limitReached: true 
        });
      }
      
      // Create extraction record
      const extraction = await storage.createExtraction({
        userId,
        url,
        status: result.emails.length > 0 ? "success" : "failed",
        emails: result.emails,
      });
      
      // Update user stats
      await storage.updateUserStats(userId, result.emails.length);
      
      res.json({
        extraction,
        emailsFound: result.emails.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Extraction failed" });
    }
  });
  
  app.get("/api/extractions", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const extractions = await storage.getExtractionsByUser(userId);
      res.json(extractions);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch extractions" });
    }
  });
  
  app.get("/api/stats", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const limits = await storage.getUserPlanLimits(userId);
      const planLimit = PLAN_LIMITS[limits.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
      
      res.json({
        plan: limits.plan,
        emailsExtracted: limits.emailsExtracted,
        linksScanned: limits.linksScanned,
        emailsLimit: planLimit.emails,
        linksLimit: planLimit.links,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch stats" });
    }
  });

  // Helper function for controlled concurrent processing with proper concurrency limiting
  async function processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrencyLimit: number
  ): Promise<R[]> {
    const results: (R | undefined)[] = new Array(items.length);
    const executing = new Set<Promise<void>>();
    
    for (let i = 0; i < items.length; i++) {
      const index = i;
      const item = items[i];
      
      // Use definite assignment assertion since we assign promiseRef synchronously before async code runs
      let promiseRef!: Promise<void>;
      const promise = (async () => {
        try {
          results[index] = await processor(item);
        } finally {
          executing.delete(promiseRef);
        }
      })();
      promiseRef = promise;
      
      executing.add(promise);
      
      // If we've hit the concurrency limit, wait for one to complete
      if (executing.size >= concurrencyLimit) {
        await Promise.race(executing);
      }
    }
    
    // Wait for all remaining to complete
    await Promise.all(executing);
    
    return results.filter((r): r is R => r !== undefined);
  }

  // Batch extraction endpoint - allows multiple URLs at once with CONCURRENT processing
  app.post("/api/extract/batch", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { urls, concurrency = 5 } = req.body;
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: "URLs array is required" });
      }
      
      // Increased batch size limit (up to 100 URLs)
      const maxBatchSize = 100;
      const urlsToProcess = urls.slice(0, maxBatchSize);
      
      // Concurrency limit (max 10 parallel requests to avoid overwhelming)
      const concurrencyLimit = Math.min(Math.max(1, concurrency), 10);
      
      // Check plan limits
      const limits = await storage.getUserPlanLimits(userId);
      const planLimit = PLAN_LIMITS[limits.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
      
      if (limits.linksScanned + urlsToProcess.length > planLimit.links) {
        return res.status(403).json({ 
          error: `Link scan limit reached. You have ${planLimit.links - limits.linksScanned} scans remaining.`,
          limitReached: true 
        });
      }
      
      let totalEmailsFound = 0;
      
      // Process URLs concurrently with controlled parallelism
      const processUrl = async (url: string) => {
        try {
          const result = await extractEmailsFromUrl(url);
          
          const extraction = await storage.createExtraction({
            userId,
            url,
            status: result.emails.length > 0 ? "success" : "failed",
            emails: result.emails || [],
          });
          
          if (result.emails.length > 0) {
            totalEmailsFound += result.emails.length;
          }
          
          return {
            url,
            success: result.emails.length > 0,
            emailsFound: result.emails.length,
            extraction,
          };
        } catch (error: any) {
          const extraction = await storage.createExtraction({
            userId,
            url,
            status: "failed",
            emails: [],
          });
          
          return {
            url,
            success: false,
            emailsFound: 0,
            error: error.message,
            extraction,
          };
        }
      };
      
      // Execute with concurrency control
      const results = await processWithConcurrency(
        urlsToProcess,
        processUrl,
        concurrencyLimit
      );
      
      // Update user stats
      if (totalEmailsFound > 0) {
        await storage.updateUserStats(userId, totalEmailsFound);
      }
      
      res.json({
        processed: results.length,
        totalEmailsFound,
        results,
        concurrencyUsed: concurrencyLimit,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Batch extraction failed" });
    }
  });

  // Streaming batch extraction endpoint with Server-Sent Events for real-time progress
  app.post("/api/extract/batch/stream", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { urls, concurrency = 5 } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: "URLs array is required" });
    }
    
    // Setup SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    const maxBatchSize = 100;
    const urlsToProcess = urls.slice(0, maxBatchSize);
    const concurrencyLimit = Math.min(Math.max(1, concurrency), 10);
    
    // Check plan limits
    const limits = await storage.getUserPlanLimits(userId);
    const planLimit = PLAN_LIMITS[limits.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
    
    if (limits.linksScanned + urlsToProcess.length > planLimit.links) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: `Link scan limit reached. You have ${planLimit.links - limits.linksScanned} scans remaining.`
      })}\n\n`);
      res.end();
      return;
    }
    
    res.write(`data: ${JSON.stringify({ 
      type: 'start', 
      total: urlsToProcess.length,
      concurrency: concurrencyLimit 
    })}\n\n`);
    
    let completed = 0;
    let totalEmailsFound = 0;
    const results: any[] = [];
    const executing = new Set<Promise<void>>();
    
    const processUrl = async (url: string) => {
      try {
        const result = await extractEmailsFromUrl(url);
        
        const extraction = await storage.createExtraction({
          userId,
          url,
          status: result.emails.length > 0 ? "success" : "failed",
          emails: result.emails || [],
        });
        
        if (result.emails.length > 0) {
          totalEmailsFound += result.emails.length;
        }
        
        completed++;
        const progressResult = {
          url,
          success: result.emails.length > 0,
          emailsFound: result.emails.length,
          extraction,
        };
        results.push(progressResult);
        
        res.write(`data: ${JSON.stringify({ 
          type: 'progress', 
          completed,
          total: urlsToProcess.length,
          result: progressResult
        })}\n\n`);
        
      } catch (error: any) {
        const extraction = await storage.createExtraction({
          userId,
          url,
          status: "failed",
          emails: [],
        });
        
        completed++;
        const errorResult = {
          url,
          success: false,
          emailsFound: 0,
          error: error.message,
          extraction,
        };
        results.push(errorResult);
        
        res.write(`data: ${JSON.stringify({ 
          type: 'progress', 
          completed,
          total: urlsToProcess.length,
          result: errorResult
        })}\n\n`);
      }
    };
    
    // Process with proper concurrency control using Set
    for (let i = 0; i < urlsToProcess.length; i++) {
      const url = urlsToProcess[i];
      
      // Use definite assignment assertion since we assign promiseRef synchronously before async code runs
      let promiseRef!: Promise<void>;
      const promise = (async () => {
        try {
          await processUrl(url);
        } finally {
          executing.delete(promiseRef);
        }
      })();
      promiseRef = promise;
      
      executing.add(promise);
      
      // If we've hit the concurrency limit, wait for one to complete
      if (executing.size >= concurrencyLimit) {
        await Promise.race(executing);
      }
    }
    
    await Promise.all(executing);
    
    // Update user stats
    if (totalEmailsFound > 0) {
      await storage.updateUserStats(userId, totalEmailsFound);
    }
    
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      processed: results.length,
      totalEmailsFound,
      results
    })}\n\n`);
    res.end();
  });

  // Delete extraction
  app.delete("/api/extractions/:id", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { id } = req.params;
      await storage.deleteExtraction(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete extraction" });
    }
  });

  // Email Verification Routes
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({ error: "Email and code are required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (user.isEmailVerified) {
        return res.status(400).json({ error: "Email is already verified" });
      }
      
      if (!user.verificationCode || !user.verificationCodeExpiry) {
        return res.status(400).json({ error: "No verification code found. Please request a new one." });
      }
      
      if (user.verificationCode !== code) {
        return res.status(400).json({ error: "Invalid verification code" });
      }
      
      if (new Date() > new Date(user.verificationCodeExpiry)) {
        return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
      }
      
      await storage.verifyEmail(user.id);
      await sendWelcomeEmail(email, user.firstName, user.plan);
      
      res.json({ success: true, message: "Email verified successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Verification failed" });
    }
  });

  app.post("/api/auth/resend-code", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (user.isEmailVerified) {
        return res.status(400).json({ error: "Email is already verified" });
      }
      
      const verificationCode = generateVerificationCode();
      const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
      await storage.updateVerificationCode(user.id, verificationCode, verificationCodeExpiry);
      
      await sendVerificationEmail(email, verificationCode, user.firstName);
      
      res.json({ success: true, message: "Verification code sent" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to resend code" });
    }
  });

  // Password Reset Routes
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ success: true, message: "If an account exists, a reset code has been sent" });
      }
      
      const resetCode = generateVerificationCode();
      const resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
      await storage.updateResetCode(user.id, resetCode, resetCodeExpiry);
      
      await sendPasswordResetEmail(email, resetCode, user.firstName);
      
      res.json({ success: true, message: "If an account exists, a reset code has been sent" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      
      if (!email || !code || !newPassword) {
        return res.status(400).json({ error: "Email, code, and new password are required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (!user.resetCode || !user.resetCodeExpiry) {
        return res.status(400).json({ error: "No reset code found. Please request a new one." });
      }
      
      if (user.resetCode !== code) {
        return res.status(400).json({ error: "Invalid reset code" });
      }
      
      if (new Date() > new Date(user.resetCodeExpiry)) {
        return res.status(400).json({ error: "Reset code has expired. Please request a new one." });
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { password: hashedPassword });
      await storage.clearResetCode(user.id);
      
      res.json({ success: true, message: "Password reset successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to reset password" });
    }
  });

  // Profile Update Route
  app.patch("/api/user/profile", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { firstName, lastName } = req.body;
      
      const updates: Partial<{ firstName: string; lastName: string }> = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }
      
      const updatedUser = await storage.updateUser(userId, updates);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update profile" });
    }
  });

  // Change Password Route (for logged-in users)
  app.post("/api/user/change-password", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { password: hashedPassword });
      
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to change password" });
    }
  });

  // Delete Account Route
  app.delete("/api/user/account", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ error: "Password is required to confirm account deletion" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: "Password is incorrect" });
      }
      
      await storage.deleteUser(userId);
      
      req.session.destroy((err: Error | null) => {
        if (err) {
          console.error("Error destroying session:", err);
        }
      });
      
      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete account" });
    }
  });

  // Contact Form Route
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, message } = req.body;
      
      if (!name || !email || !message) {
        return res.status(400).json({ error: "Name, email, and message are required" });
      }
      
      const result = await sendContactEmail(name, email, message);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error || "Failed to send message" });
      }
      
      res.json({ success: true, message: "Message sent successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send message" });
    }
  });

  // Helper function to get the base URL for callbacks
  function getBaseUrl(req: Request): string {
    // Check for APP_DOMAIN first
    if (process.env.APP_DOMAIN) {
      const domain = process.env.APP_DOMAIN;
      return domain.startsWith('http') ? domain : `https://${domain}`;
    }
    
    // Check for REPLIT_DEV_DOMAIN (development)
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    
    // Check for REPLIT_DOMAINS (production)
    if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(',');
      if (domains.length > 0 && domains[0].trim()) {
        return `https://${domains[0].trim()}`;
      }
    }
    
    // Fallback to request origin
    const origin = req.headers.origin || req.headers.referer;
    if (origin) {
      return origin.replace(/\/$/, '');
    }
    
    // Last resort - construct from host header
    const host = req.headers.host;
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    return host ? `${protocol}://${host}` : 'http://localhost:5000';
  }

  // Paystack Payment Routes
  app.post("/api/payment/initialize", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { plan } = req.body;
      
      if (!plan || !PLAN_PRICES[plan]) {
        return res.status(400).json({ error: "Invalid plan selected" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Payment service not configured" });
      }
      
      // Construct the callback URL
      const baseUrl = getBaseUrl(req);
      const callbackUrl = `${baseUrl}/payment/callback`;
      
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          amount: PLAN_PRICES[plan],
          callback_url: callbackUrl,
          metadata: {
            userId: user.id,
            plan: plan,
          },
        }),
      });
      
      const data = await response.json();
      
      if (!data.status) {
        return res.status(400).json({ error: data.message || "Failed to initialize payment" });
      }
      
      res.json({
        success: true,
        authorization_url: data.data.authorization_url,
        reference: data.data.reference,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to initialize payment" });
    }
  });

  app.get("/api/payment/verify/:reference", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { reference } = req.params;
      
      if (!reference) {
        return res.status(400).json({ error: "Reference is required" });
      }
      
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Payment service not configured" });
      }
      
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${paystackSecretKey}`,
        },
      });
      
      const data = await response.json();
      
      if (!data.status) {
        return res.status(400).json({ error: data.message || "Failed to verify payment" });
      }
      
      if (data.data.status !== "success") {
        return res.status(400).json({ error: "Payment was not successful" });
      }
      
      const metadata = data.data.metadata;
      const plan = metadata?.plan;
      
      if (!plan) {
        return res.status(400).json({ error: "Invalid payment metadata" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await storage.updateUserPlan(userId, plan);
      await sendPlanUpgradeEmail(user.email, user.firstName, plan);
      
      res.json({
        success: true,
        message: "Payment verified successfully",
        plan: plan,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to verify payment" });
    }
  });

  return httpServer;
}
