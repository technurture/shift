// API client utility functions

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: string;
  emailsExtracted: number;
  linksScanned: number;
  createdAt: string;
  isEmailVerified: boolean;
}

export interface Extraction {
  id: string;
  userId: string;
  url: string;
  status: string;
  emails: string[];
  scannedAt: string;
}

export interface Stats {
  plan: string;
  emailsExtracted: number;
  linksScanned: number;
  emailsLimit: number;
  linksLimit: number;
}

export interface ShopifyStore {
  id: string;
  title: string;
  description: string;
  url: string;
  emails: string[];
  country?: string;
  currency?: string;
  language?: string;
  productCount?: { min: number; max: number };
  createdDate?: string;
}

export interface ShopifyUsage {
  usedToday: number;
  dailyLimit: number;
  remaining: number;
  plan: string;
}

export interface ShopifyFindResult {
  success: boolean;
  stores: ShopifyStore[];
  totalFound: number;
  usage: ShopifyUsage;
}

class ApiClient {
  private baseUrl = "/api";

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async signup(data: { email: string; password: string; firstName: string; lastName: string }) {
    return this.request<User>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async logout() {
    return this.request<{ success: boolean }>("/auth/logout", {
      method: "POST",
    });
  }

  async getCurrentUser() {
    return this.request<User>("/auth/me");
  }

  async verifyEmail(data: { email: string; code: string }) {
    return this.request<User>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async resendVerificationCode(email: string) {
    return this.request<{ message: string }>("/auth/resend-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async forgotPassword(email: string) {
    return this.request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(data: { email: string; code: string; newPassword: string }) {
    return this.request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateProfile(data: { firstName?: string; lastName?: string }) {
    return this.request<User>("/user/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.request<{ success: boolean; message: string }>("/user/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteAccount(password: string) {
    return this.request<{ success: boolean; message: string }>("/user/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    });
  }

  async sendContactMessage(data: { name: string; email: string; message: string }) {
    return this.request<{ message: string }>("/contact", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async initializePayment(plan: string) {
    return this.request<{ authorization_url: string; reference: string }>("/payment/initialize", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
  }

  async verifyPayment(reference: string) {
    return this.request<{ success: boolean; plan: string }>(`/payment/verify/${reference}`);
  }

  // Extractions
  async extractEmails(url: string) {
    return this.request<{ extraction: Extraction; emailsFound: number }>("/extract", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  }

  async extractEmailsBatch(urls: string[]) {
    return this.request<{ 
      processed: number; 
      totalEmailsFound: number; 
      results: Array<{
        url: string;
        success: boolean;
        emailsFound: number;
        extraction: Extraction;
        error?: string;
      }>;
    }>("/extract/batch", {
      method: "POST",
      body: JSON.stringify({ urls }),
    });
  }

  async getExtractions() {
    return this.request<Extraction[]>("/extractions");
  }

  async deleteExtraction(id: string) {
    return this.request<{ success: boolean }>(`/extractions/${id}`, {
      method: "DELETE",
    });
  }

  async getStats() {
    return this.request<Stats>("/stats");
  }

  // Shopify Store Finder
  async getShopifyUsage() {
    return this.request<ShopifyUsage>("/shopify/usage");
  }

  async findShopifyStores(params: {
    language?: string;
    currency?: string;
    maxResults: number;
  }) {
    return this.request<ShopifyFindResult>("/shopify/find", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }
}

export const api = new ApiClient();
