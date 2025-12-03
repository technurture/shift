import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import { extractEmailsFromUrl } from "./lib/email-extractor";
import { signToken, verifyToken } from "./lib/jwt";

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
      
      // Set session for web
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
      
      // Generate JWT token for mobile
      const token = signToken(user.id);
      
      // Don't send password back
      const { password: _, ...userWithoutPassword } = user;
      res.json({ ...userWithoutPassword, token });
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

  // Batch extraction endpoint - allows multiple URLs at once
  app.post("/api/extract/batch", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { urls } = req.body;
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: "URLs array is required" });
      }
      
      // Limit batch size
      const maxBatchSize = 10;
      const urlsToProcess = urls.slice(0, maxBatchSize);
      
      // Check plan limits
      const limits = await storage.getUserPlanLimits(userId);
      const planLimit = PLAN_LIMITS[limits.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
      
      if (limits.linksScanned + urlsToProcess.length > planLimit.links) {
        return res.status(403).json({ 
          error: `Link scan limit reached. You have ${planLimit.links - limits.linksScanned} scans remaining.`,
          limitReached: true 
        });
      }
      
      const results: any[] = [];
      let totalEmailsFound = 0;
      
      // Process URLs sequentially to avoid overwhelming the system
      for (const url of urlsToProcess) {
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
          
          results.push({
            url,
            success: result.emails.length > 0,
            emailsFound: result.emails.length,
            extraction,
          });
        } catch (error: any) {
          const extraction = await storage.createExtraction({
            userId,
            url,
            status: "failed",
            emails: [],
          });
          
          results.push({
            url,
            success: false,
            emailsFound: 0,
            error: error.message,
            extraction,
          });
        }
      }
      
      // Update user stats
      if (totalEmailsFound > 0) {
        await storage.updateUserStats(userId, totalEmailsFound);
      }
      
      res.json({
        processed: results.length,
        totalEmailsFound,
        results,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Batch extraction failed" });
    }
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

  return httpServer;
}
