import dotenv from "dotenv";
import { MongoClient, Db, Collection } from "mongodb";
import type { User, Extraction } from "@shared/schema";

dotenv.config();

const mongoUrl = process.env.MONGODB_URL;
if (!mongoUrl) {
  throw new Error("Missing MONGODB_URL environment variable");
}

const client = new MongoClient(mongoUrl);

let db: Db;
let users: Collection<Omit<User, "id"> & { _id: string }>;
let extractions: Collection<Omit<Extraction, "id"> & { _id: string }>;

async function connectToDatabase() {
  if (db) return { db, users, extractions };
  
  await client.connect();
  db = client.db("milkthelink");
  users = db.collection("users");
  extractions = db.collection("extractions");
  
  await users.createIndex({ email: 1 }, { unique: true });
  await extractions.createIndex({ userId: 1 });
  
  console.log("Connected to MongoDB");
  
  return { db, users, extractions };
}

export { connectToDatabase, client };
export type { Db, Collection };
