import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  plan: text("plan").notNull().default("free"),
  emailsExtracted: integer("emails_extracted").notNull().default(0),
  linksScanned: integer("links_scanned").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const extractions = pgTable("extractions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  url: text("url").notNull(),
  status: text("status").notNull().default("processing"),
  emails: text("emails").array().notNull().default([]),
  scannedAt: timestamp("scanned_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  emailsExtracted: true,
  linksScanned: true,
  createdAt: true,
  plan: true,
});

export const insertExtractionSchema = createInsertSchema(extractions).omit({
  id: true,
  scannedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Extraction = typeof extractions.$inferSelect;
export type InsertExtraction = z.infer<typeof insertExtractionSchema>;
