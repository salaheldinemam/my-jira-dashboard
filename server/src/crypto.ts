import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(secret: string): Buffer {
  return crypto.scryptSync(secret, "jira-insights-salt", 32);
}

export function encryptSecret(plain: string, sessionSecret: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey(sessionSecret);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptSecret(payload: string, sessionSecret: string): string {
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const key = getKey(sessionSecret);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
