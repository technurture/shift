import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import { extractEmailsFromUrl } from "./lib/email-extractor";

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
  
  // Auth Routes
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
      
      // Set session
      req.session.userId = user.id;
      
      // Don't send password back
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
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
      
      // Set session
      req.session.userId = user.id;
      
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
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
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });
  
  // Extraction Routes
  app.post("/api/extract", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      
      // Check plan limits
      const limits = await storage.getUserPlanLimits(req.session.userId);
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
          userId: req.session.userId,
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
        userId: req.session.userId,
        url,
        status: result.emails.length > 0 ? "success" : "failed",
        emails: result.emails,
      });
      
      // Update user stats
      await storage.updateUserStats(req.session.userId, result.emails.length);
      
      res.json({
        extraction,
        emailsFound: result.emails.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Extraction failed" });
    }
  });
  
  app.get("/api/extractions", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const extractions = await storage.getExtractionsByUser(req.session.userId);
      res.json(extractions);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch extractions" });
    }
  });
  
  app.get("/api/stats", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const limits = await storage.getUserPlanLimits(req.session.userId);
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

  return httpServer;
}
