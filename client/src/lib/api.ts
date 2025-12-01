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

  // Extractions
  async extractEmails(url: string) {
    return this.request<{ extraction: Extraction; emailsFound: number }>("/extract", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  }

  async getExtractions() {
    return this.request<Extraction[]>("/extractions");
  }

  async getStats() {
    return this.request<Stats>("/stats");
  }
}

export const api = new ApiClient();
