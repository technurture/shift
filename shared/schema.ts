import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  password: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  plan: z.string().default("free"),
  emailsExtracted: z.number().default(0),
  linksScanned: z.number().default(0),
  shopifyStoresUsedToday: z.number().default(0),
  shopifyLastResetDate: z.string().optional(),
  isEmailVerified: z.boolean().default(false),
  verificationCode: z.string().optional(),
  verificationCodeExpiry: z.date().optional(),
  resetCode: z.string().optional(),
  resetCodeExpiry: z.date().optional(),
  createdAt: z.date(),
});

export const extractionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  url: z.string(),
  status: z.string().default("processing"),
  emails: z.array(z.string()).default([]),
  scannedAt: z.date(),
});

export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const insertExtractionSchema = z.object({
  userId: z.string(),
  url: z.string(),
  status: z.string().default("processing"),
  emails: z.array(z.string()).default([]),
});

export const shopifyStoreSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  emails: z.array(z.string()),
  country: z.string().optional(),
  currency: z.string().optional(),
});

export const shopifySearchSchema = z.object({
  id: z.string(),
  userId: z.string(),
  filters: z.object({
    language: z.string().optional(),
    currency: z.string().optional(),
    maxResults: z.number(),
  }),
  stores: z.array(shopifyStoreSchema),
  totalFound: z.number(),
  searchedAt: z.date(),
});

export const insertShopifySearchSchema = z.object({
  userId: z.string(),
  filters: z.object({
    language: z.string().optional(),
    currency: z.string().optional(),
    maxResults: z.number(),
  }),
  stores: z.array(shopifyStoreSchema),
  totalFound: z.number(),
});

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type InsertExtraction = z.infer<typeof insertExtractionSchema>;
export type ShopifyStore = z.infer<typeof shopifyStoreSchema>;
export type ShopifySearch = z.infer<typeof shopifySearchSchema>;
export type InsertShopifySearch = z.infer<typeof insertShopifySearchSchema>;
