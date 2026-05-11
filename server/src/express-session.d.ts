import "express-session";

declare module "express-session" {
  interface SessionData {
    jira?: {
      baseUrl: string;
      email: string;
      tokenEnc: string;
      statusMapping?: Record<string, string[]> | null;
    } | null;
  }
}

export {};
