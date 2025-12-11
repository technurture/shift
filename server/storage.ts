import { ObjectId } from "mongodb";
import { connectToDatabase } from "./db";
import type { User, InsertUser, Extraction, InsertExtraction } from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(userId: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(userId: string): Promise<void>;
  updateUserStats(userId: string, emailsCount: number): Promise<void>;
  updateVerificationCode(userId: string, code: string, expiry: Date): Promise<void>;
  verifyEmail(userId: string): Promise<void>;
  updateResetCode(userId: string, code: string, expiry: Date): Promise<void>;
  clearResetCode(userId: string): Promise<void>;
  updateUserPlan(userId: string, plan: string): Promise<void>;
  
  createExtraction(extraction: InsertExtraction): Promise<Extraction>;
  getExtractionsByUser(userId: string): Promise<Extraction[]>;
  deleteExtraction(id: string, userId: string): Promise<void>;
  getUserPlanLimits(userId: string): Promise<{ plan: string; emailsExtracted: number; linksScanned: number }>;
  
  getShopifyUsageToday(userId: string): Promise<number>;
  updateShopifyUsage(userId: string, storesUsed: number): Promise<void>;
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
      shopifyStoresUsedToday: 0,
      isEmailVerified: false,
      createdAt: now,
    };
    
    await users.insertOne(userDoc);
    
    const { _id, ...rest } = userDoc;
    return { id: _id, ...rest } as User;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | undefined> {
    const { users } = await connectToDatabase();
    
    const { id, ...updateFields } = updates;
    
    const result = await users.findOneAndUpdate(
      { _id: userId },
      { $set: updateFields },
      { returnDocument: "after" }
    );
    
    if (!result) return undefined;
    
    const { _id, ...rest } = result;
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

  async updateVerificationCode(userId: string, code: string, expiry: Date): Promise<void> {
    const { users } = await connectToDatabase();
    await users.updateOne(
      { _id: userId },
      { 
        $set: { 
          verificationCode: code,
          verificationCodeExpiry: expiry
        } 
      }
    );
  }

  async verifyEmail(userId: string): Promise<void> {
    const { users } = await connectToDatabase();
    await users.updateOne(
      { _id: userId },
      { 
        $set: { isEmailVerified: true },
        $unset: { 
          verificationCode: "",
          verificationCodeExpiry: ""
        } 
      }
    );
  }

  async updateResetCode(userId: string, code: string, expiry: Date): Promise<void> {
    const { users } = await connectToDatabase();
    await users.updateOne(
      { _id: userId },
      { 
        $set: { 
          resetCode: code,
          resetCodeExpiry: expiry
        } 
      }
    );
  }

  async clearResetCode(userId: string): Promise<void> {
    const { users } = await connectToDatabase();
    await users.updateOne(
      { _id: userId },
      { 
        $unset: { 
          resetCode: "",
          resetCodeExpiry: ""
        } 
      }
    );
  }

  async updateUserPlan(userId: string, plan: string): Promise<void> {
    const { users } = await connectToDatabase();
    await users.updateOne(
      { _id: userId },
      { $set: { plan } }
    );
  }

  async deleteUser(userId: string): Promise<void> {
    const { users, extractions } = await connectToDatabase();
    await extractions.deleteMany({ userId });
    await users.deleteOne({ _id: userId });
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

  async getShopifyUsageToday(userId: string): Promise<number> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const today = new Date().toISOString().split('T')[0];
    const lastResetDate = (user as any).shopifyLastResetDate;
    
    if (lastResetDate !== today) {
      return 0;
    }
    
    return (user as any).shopifyStoresUsedToday || 0;
  }

  async updateShopifyUsage(userId: string, storesUsed: number): Promise<void> {
    const { users } = await connectToDatabase();
    const today = new Date().toISOString().split('T')[0];
    
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const lastResetDate = (user as any).shopifyLastResetDate;
    
    if (lastResetDate !== today) {
      await users.updateOne(
        { _id: userId },
        { 
          $set: { 
            shopifyStoresUsedToday: storesUsed,
            shopifyLastResetDate: today
          } 
        }
      );
    } else {
      await users.updateOne(
        { _id: userId },
        { 
          $inc: { shopifyStoresUsedToday: storesUsed }
        }
      );
    }
  }
}

export const storage = new MongoStorage();
