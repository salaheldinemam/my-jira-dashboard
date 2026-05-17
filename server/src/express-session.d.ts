import "express-session";

declare module "express-session" {
  interface SessionData {
    atlassianOAuthState?: string;
    jira?: {
      authMode: "basic" | "oauth";
      baseUrl: string;
      email: string;
      cloudId?: string;
      displayName?: string;
      accountId?: string;
      avatarUrl?: string;
      tokenEnc: string;
      refreshTokenEnc?: string;
      expiresAt?: number;
      statusMapping?: Record<string, string[]> | null;
    } | null;
  }
}

export {};
