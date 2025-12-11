import dotenv from "dotenv";
import { MongoClient, Db, Collection } from "mongodb";
import type { User, Extraction, ShopifySearch, Notification } from "@shared/schema";

dotenv.config();

const mongoUrl = process.env.MONGODB_URL;
if (!mongoUrl) {
  throw new Error("Missing MONGODB_URL environment variable");
}

const client = new MongoClient(mongoUrl);

let db: Db;
let users: Collection<Omit<User, "id"> & { _id: string }>;
let extractions: Collection<Omit<Extraction, "id"> & { _id: string }>;
let shopifySearches: Collection<Omit<ShopifySearch, "id"> & { _id: string }>;
let notifications: Collection<Omit<Notification, "id"> & { _id: string }>;

async function connectToDatabase() {
  if (db) return { db, users, extractions, shopifySearches, notifications };
  
  await client.connect();
  db = client.db("milkthelink");
  users = db.collection("users");
  extractions = db.collection("extractions");
  shopifySearches = db.collection("shopifySearches");
  notifications = db.collection("notifications");
  
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ planExpiresAt: 1 });
  await users.createIndex({ planStatus: 1 });
  await extractions.createIndex({ userId: 1 });
  await shopifySearches.createIndex({ userId: 1 });
  await notifications.createIndex({ userId: 1, createdAt: -1 });
  await notifications.createIndex({ userId: 1, isRead: 1 });
  
  console.log("Connected to MongoDB");
  
  return { db, users, extractions, shopifySearches, notifications };
}

export { connectToDatabase, client };
export type { Db, Collection };
