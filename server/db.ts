import { MongoClient, Db, Collection } from "mongodb";
import type { User, Extraction } from "@shared/schema";

const client = new MongoClient(process.env.MONGODB_URL!);

let db: Db;
let users: Collection<Omit<User, "id"> & { _id: string }>;
let extractions: Collection<Omit<Extraction, "id"> & { _id: string }>;

async function connectToDatabase() {
  if (db) return { db, users, extractions };
  
  await client.connect();
  db = client.db("mailsift");
  users = db.collection("users");
  extractions = db.collection("extractions");
  
  await users.createIndex({ email: 1 }, { unique: true });
  await extractions.createIndex({ userId: 1 });
  
  console.log("Connected to MongoDB");
  
  return { db, users, extractions };
}

export { connectToDatabase, client };
export type { Db, Collection };
