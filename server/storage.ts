import { ObjectId } from "mongodb";
import { connectToDatabase } from "./db";
import type { User, InsertUser, Extraction, InsertExtraction, ShopifySearch, InsertShopifySearch, Notification, InsertNotification } from "@shared/schema";

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
  
  createShopifySearch(search: InsertShopifySearch): Promise<ShopifySearch>;
  getShopifySearchesByUser(userId: string): Promise<ShopifySearch[]>;
  deleteShopifySearch(id: string, userId: string): Promise<void>;
  
  // Notification methods
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  getUnreadNotificationsCount(userId: string): Promise<number>;
  markNotificationAsRead(id: string, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(id: string, userId: string): Promise<void>;
  
  // Subscription methods
  getUsersWithExpiringPlans(daysUntilExpiry: number): Promise<User[]>;
  getUsersWithExpiredPlans(): Promise<User[]>;
  updateSubscription(userId: string, updates: {
    plan: string;
    planStartDate?: Date;
    planExpiresAt?: Date;
    planStatus?: "active" | "expired" | "cancelled";
    monthlyEmailsUsed?: number;
    monthlyLinksScanned?: number;
    monthlyUsageResetDate?: string;
    lastReminderSentAt?: Date;
    paystackCustomerCode?: string;
    paystackSubscriptionCode?: string;
  }): Promise<void>;
  incrementMonthlyUsage(userId: string, emails: number, links: number): Promise<void>;
  resetMonthlyUsage(userId: string): Promise<void>;
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
      planStatus: "active" as const,
      monthlyEmailsUsed: 0,
      monthlyLinksScanned: 0,
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

  async createShopifySearch(search: InsertShopifySearch): Promise<ShopifySearch> {
    const { shopifySearches } = await connectToDatabase();
    const id = new ObjectId().toString();
    const now = new Date();
    
    const searchDoc = {
      _id: id,
      ...search,
      searchedAt: now,
    };
    
    await shopifySearches.insertOne(searchDoc);
    
    const { _id, ...rest } = searchDoc;
    return { id: _id, ...rest } as ShopifySearch;
  }

  async getShopifySearchesByUser(userId: string): Promise<ShopifySearch[]> {
    const { shopifySearches } = await connectToDatabase();
    const docs = await shopifySearches
      .find({ userId })
      .sort({ searchedAt: -1 })
      .toArray();
    
    return docs.map(doc => {
      const { _id, ...rest } = doc;
      return { id: _id, ...rest } as ShopifySearch;
    });
  }

  async deleteShopifySearch(id: string, userId: string): Promise<void> {
    const { shopifySearches } = await connectToDatabase();
    await shopifySearches.deleteOne({ _id: id, userId });
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const { notifications } = await connectToDatabase();
    const id = new ObjectId().toString();
    const now = new Date();
    
    const notificationDoc = {
      _id: id,
      ...notification,
      isRead: false,
      createdAt: now,
    };
    
    await notifications.insertOne(notificationDoc);
    
    const { _id, ...rest } = notificationDoc;
    return { id: _id, ...rest } as Notification;
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    const { notifications } = await connectToDatabase();
    const docs = await notifications
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    
    return docs.map((doc: any) => {
      const { _id, ...rest } = doc;
      return { id: _id, ...rest } as Notification;
    });
  }

  async getUnreadNotificationsCount(userId: string): Promise<number> {
    const { notifications } = await connectToDatabase();
    return await notifications.countDocuments({ userId, isRead: false });
  }

  async markNotificationAsRead(id: string, userId: string): Promise<void> {
    const { notifications } = await connectToDatabase();
    await notifications.updateOne(
      { _id: id, userId },
      { $set: { isRead: true } }
    );
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const { notifications } = await connectToDatabase();
    await notifications.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    const { notifications } = await connectToDatabase();
    await notifications.deleteOne({ _id: id, userId });
  }

  async getUsersWithExpiringPlans(daysUntilExpiry: number): Promise<User[]> {
    const { users } = await connectToDatabase();
    const now = new Date();
    const expiryThreshold = new Date(now.getTime() + daysUntilExpiry * 24 * 60 * 60 * 1000);
    
    const docs = await users.find({
      plan: { $in: ["basic", "premium"] },
      planStatus: "active",
      planExpiresAt: { $lte: expiryThreshold, $gt: now }
    }).toArray();
    
    return docs.map(doc => {
      const { _id, ...rest } = doc;
      return { id: _id, ...rest } as User;
    });
  }

  async getUsersWithExpiredPlans(): Promise<User[]> {
    const { users } = await connectToDatabase();
    const now = new Date();
    
    const docs = await users.find({
      plan: { $in: ["basic", "premium"] },
      planStatus: "active",
      planExpiresAt: { $lt: now }
    }).toArray();
    
    return docs.map(doc => {
      const { _id, ...rest } = doc;
      return { id: _id, ...rest } as User;
    });
  }

  async updateSubscription(userId: string, updates: {
    plan: string;
    planStartDate?: Date;
    planExpiresAt?: Date;
    planStatus?: "active" | "expired" | "cancelled";
    monthlyEmailsUsed?: number;
    monthlyLinksScanned?: number;
    monthlyUsageResetDate?: string;
    lastReminderSentAt?: Date;
    paystackCustomerCode?: string;
    paystackSubscriptionCode?: string;
  }): Promise<void> {
    const { users } = await connectToDatabase();
    await users.updateOne(
      { _id: userId },
      { $set: updates }
    );
  }

  async incrementMonthlyUsage(userId: string, emails: number, links: number): Promise<void> {
    const { users } = await connectToDatabase();
    await users.updateOne(
      { _id: userId },
      { 
        $inc: { 
          monthlyEmailsUsed: emails,
          monthlyLinksScanned: links
        } 
      }
    );
  }

  async resetMonthlyUsage(userId: string): Promise<void> {
    const { users } = await connectToDatabase();
    const today = new Date().toISOString().split('T')[0];
    await users.updateOne(
      { _id: userId },
      { 
        $set: { 
          monthlyEmailsUsed: 0,
          monthlyLinksScanned: 0,
          monthlyUsageResetDate: today
        } 
      }
    );
  }
}

export const storage = new MongoStorage();
