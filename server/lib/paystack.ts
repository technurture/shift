import type { User } from "@shared/schema";
import crypto from "crypto";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export function validatePaystackSignature(
  payload: string | Buffer,
  signature: string | undefined
): boolean {
  if (!signature || !PAYSTACK_SECRET_KEY) {
    return false;
  }
  
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(payload)
    .digest("hex");
  
  return hash === signature;
}

export const PLAN_PRICES = {
  basic: {
    amount: 4500000, // 45,000 NGN in kobo
    usd: 29,
    name: "Basic Plan",
    monthlyLimit: 1000,
    shopifyDailyLimit: 50,
  },
  premium: {
    amount: 15000000, // 150,000 NGN in kobo
    usd: 99,
    name: "Premium Plan",
    monthlyLimit: -1, // unlimited
    shopifyDailyLimit: 1000,
  },
} as const;

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface InitializeTransactionData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

interface VerifyTransactionData {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  customer: {
    email: string;
    customer_code: string;
  };
  metadata?: {
    userId?: string;
    plan?: string;
  };
}

async function paystackRequest<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: any
): Promise<PaystackResponse<T>> {
  const response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paystack API error: ${error}`);
  }

  return response.json();
}

export async function initializeTransaction(
  email: string,
  amount: number,
  userId: string,
  plan: "basic" | "premium",
  callbackUrl: string
): Promise<InitializeTransactionData> {
  const reference = `MTL_${plan}_${userId}_${Date.now()}`;
  
  const response = await paystackRequest<InitializeTransactionData>(
    "/transaction/initialize",
    "POST",
    {
      email,
      amount,
      currency: "NGN",
      reference,
      callback_url: callbackUrl,
      metadata: {
        userId,
        plan,
        custom_fields: [
          {
            display_name: "Plan",
            variable_name: "plan",
            value: plan,
          },
          {
            display_name: "User ID",
            variable_name: "user_id",
            value: userId,
          },
        ],
      },
    }
  );

  return response.data;
}

export async function verifyTransaction(
  reference: string
): Promise<VerifyTransactionData> {
  const response = await paystackRequest<VerifyTransactionData>(
    `/transaction/verify/${reference}`
  );

  return response.data;
}

export function calculateExpiryDate(startDate: Date = new Date()): Date {
  const expiryDate = new Date(startDate);
  expiryDate.setDate(expiryDate.getDate() + 30);
  return expiryDate;
}

export function getDaysUntilExpiry(expiresAt: Date): number {
  const now = new Date();
  const diffTime = expiresAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function isSubscriptionExpired(expiresAt: Date | undefined): boolean {
  if (!expiresAt) return false;
  return new Date() > new Date(expiresAt);
}

export function getPlanLimits(plan: string): { monthlyLimit: number; shopifyDailyLimit: number } {
  if (plan === "basic") {
    return { monthlyLimit: 1000, shopifyDailyLimit: 50 };
  } else if (plan === "premium") {
    return { monthlyLimit: -1, shopifyDailyLimit: 1000 };
  }
  return { monthlyLimit: 500, shopifyDailyLimit: 0 };
}

export function hasExceededMonthlyLimit(user: User): boolean {
  if (user.plan === "premium") return false;
  if (user.plan === "free") {
    return (user.emailsExtracted || 0) >= 500 || (user.linksScanned || 0) >= 500;
  }
  if (user.plan === "basic") {
    const monthlyUsed = (user.monthlyEmailsUsed || 0) + (user.monthlyLinksScanned || 0);
    return monthlyUsed >= 1000;
  }
  return false;
}

export { PAYSTACK_PUBLIC_KEY };
