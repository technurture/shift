import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { users, extractions, type User, type InsertUser, type Extraction, type InsertExtraction } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle({ client: pool });

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStats(userId: string, emailsCount: number): Promise<void>;
  
  createExtraction(extraction: InsertExtraction): Promise<Extraction>;
  getExtractionsByUser(userId: string): Promise<Extraction[]>;
  getUserPlanLimits(userId: string): Promise<{ plan: string; emailsExtracted: number; linksScanned: number }>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUserStats(userId: string, emailsCount: number): Promise<void> {
    await db.update(users)
      .set({
        emailsExtracted: sql`${users.emailsExtracted} + ${emailsCount}`,
        linksScanned: sql`${users.linksScanned} + 1`,
      })
      .where(eq(users.id, userId));
  }

  async createExtraction(extraction: InsertExtraction): Promise<Extraction> {
    const result = await db.insert(extractions).values(extraction).returning();
    return result[0];
  }

  async getExtractionsByUser(userId: string): Promise<Extraction[]> {
    return await db.select()
      .from(extractions)
      .where(eq(extractions.userId, userId))
      .orderBy(desc(extractions.scannedAt));
  }

  async getUserPlanLimits(userId: string): Promise<{ plan: string; emailsExtracted: number; linksScanned: number }> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return {
      plan: user.plan,
      emailsExtracted: user.emailsExtracted,
      linksScanned: user.linksScanned,
    };
  }
}

export const storage = new DbStorage();
