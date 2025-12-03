import { ObjectId } from "mongodb";
import { connectToDatabase } from "./db";
import type { User, InsertUser, Extraction, InsertExtraction } from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStats(userId: string, emailsCount: number): Promise<void>;
  
  createExtraction(extraction: InsertExtraction): Promise<Extraction>;
  getExtractionsByUser(userId: string): Promise<Extraction[]>;
  deleteExtraction(id: string, userId: string): Promise<void>;
  getUserPlanLimits(userId: string): Promise<{ plan: string; emailsExtracted: number; linksScanned: number }>;
}

export class MongoStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const { users } = await connectToDatabase();
    const user = await users.findOne({ _id: id });
    if (!user) return undefined;
    
    const { _id, ...rest } = user;
    return { id: _id, ...rest } as User;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { users } = await connectToDatabase();
    const user = await users.findOne({ email });
    if (!user) return undefined;
    
    const { _id, ...rest } = user;
    return { id: _id, ...rest } as User;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const { users } = await connectToDatabase();
    const id = new ObjectId().toString();
    const now = new Date();
    
    const userDoc = {
      _id: id,
      ...insertUser,
      plan: "free",
      emailsExtracted: 0,
      linksScanned: 0,
      createdAt: now,
    };
    
    await users.insertOne(userDoc);
    
    const { _id, ...rest } = userDoc;
    return { id: _id, ...rest } as User;
  }

  async updateUserStats(userId: string, emailsCount: number): Promise<void> {
    const { users } = await connectToDatabase();
    await users.updateOne(
      { _id: userId },
      { 
        $inc: { 
          emailsExtracted: emailsCount,
          linksScanned: 1 
        } 
      }
    );
  }

  async createExtraction(extraction: InsertExtraction): Promise<Extraction> {
    const { extractions } = await connectToDatabase();
    const id = new ObjectId().toString();
    const now = new Date();
    
    const extractionDoc = {
      _id: id,
      ...extraction,
      scannedAt: now,
    };
    
    await extractions.insertOne(extractionDoc);
    
    const { _id, ...rest } = extractionDoc;
    return { id: _id, ...rest } as Extraction;
  }

  async getExtractionsByUser(userId: string): Promise<Extraction[]> {
    const { extractions } = await connectToDatabase();
    const docs = await extractions
      .find({ userId })
      .sort({ scannedAt: -1 })
      .toArray();
    
    return docs.map(doc => {
      const { _id, ...rest } = doc;
      return { id: _id, ...rest } as Extraction;
    });
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

  async deleteExtraction(id: string, userId: string): Promise<void> {
    const { extractions } = await connectToDatabase();
    await extractions.deleteOne({ _id: id, userId });
  }
}

export const storage = new MongoStorage();
