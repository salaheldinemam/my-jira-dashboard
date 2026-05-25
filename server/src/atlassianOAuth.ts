import axios from "axios";
import crypto from "node:crypto";
import { axiosOutboundConfig } from "./outboundHttps.js";

export type AtlassianOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
};

const AUTH_BASE = "https://auth.atlassian.com";
const API_BASE = "https://api.atlassian.com";

export function getAtlassianOAuthConfig(): AtlassianOAuthConfig | null {
  const clientId = process.env.ATLASSIAN_CLIENT_ID?.trim();
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET?.trim();
  const redirectUri = process.env.ATLASSIAN_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  const scopes = (
    process.env.ATLASSIAN_SCOPES?.trim() ||
    "read:jira-work read:jira-user read:board:jira-software read:sprint:jira-software offline_access"
  ).split(/\s+/);
  return { clientId, clientSecret, redirectUri, scopes };
}

export function isOAuthConfigured(): boolean {
  return getAtlassianOAuthConfig() !== null;
}

export function createOAuthState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function buildAuthorizeUrl(config: AtlassianOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: config.clientId,
    scope: config.scopes.join(" "),
    redirect_uri: config.redirectUri,
    state,
    response_type: "code",
    prompt: "consent",
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export async function exchangeCodeForTokens(
  config: AtlassianOAuthConfig,
  code: string
): Promise<TokenResponse> {
  const { data } = await axios.post<TokenResponse>(
    `${AUTH_BASE}/oauth/token`,
    {
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    },
    { headers: { "Content-Type": "application/json" }, timeout: 30_000, ...axiosOutboundConfig() }
  );
  return data;
}

export async function refreshAccessToken(
  config: AtlassianOAuthConfig,
  refreshToken: string
): Promise<TokenResponse> {
  const { data } = await axios.post<TokenResponse>(
    `${AUTH_BASE}/oauth/token`,
    {
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    },
    { headers: { "Content-Type": "application/json" }, timeout: 30_000, ...axiosOutboundConfig() }
  );
  return data;
}

export type AccessibleResource = {
  id: string;
  url: string;
  name: string;
  scopes: string[];
};

export async function getAccessibleResources(accessToken: string): Promise<AccessibleResource[]> {
  const { data } = await axios.get<AccessibleResource[]>(`${API_BASE}/oauth/token/accessible-resources`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    timeout: 30_000,
    ...axiosOutboundConfig(),
  });
  return data;
}
