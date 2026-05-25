import https from "node:https";

let warnedInsecure = false;

function isInsecureTlsEnabled(): boolean {
  const v = process.env.ATLASSIAN_INSECURE_TLS?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * HTTPS agent for outbound calls to Atlassian/Jira.
 * On corporate networks with TLS inspection, set NODE_EXTRA_CA_CERTS to your org root CA,
 * or for local dev only: ATLASSIAN_INSECURE_TLS=true (ignored in production).
 */
export function getOutboundHttpsAgent(): https.Agent | undefined {
  if (!isInsecureTlsEnabled()) return undefined;
  if (process.env.NODE_ENV === "production") {
    if (!warnedInsecure) {
      console.warn("ATLASSIAN_INSECURE_TLS is set but ignored when NODE_ENV=production");
      warnedInsecure = true;
    }
    return undefined;
  }
  if (!warnedInsecure) {
    console.warn(
      "ATLASSIAN_INSECURE_TLS: TLS certificate verification disabled for outbound HTTPS (development only)"
    );
    warnedInsecure = true;
  }
  return new https.Agent({ rejectUnauthorized: false });
}

/** Spread into axios request config or axios.create({ ... }). */
export function axiosOutboundConfig(): { httpsAgent?: https.Agent } {
  const httpsAgent = getOutboundHttpsAgent();
  return httpsAgent ? { httpsAgent } : {};
}

export function isTlsCertificateError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  if (code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || code === "SELF_SIGNED_CERT_IN_CHAIN") return true;
  const cause = "cause" in err ? (err as { cause: unknown }).cause : null;
  if (cause && typeof cause === "object" && "code" in cause) {
    const c = String((cause as { code: unknown }).code);
    return c === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || c === "SELF_SIGNED_CERT_IN_CHAIN";
  }
  return false;
}

export const TLS_HELP_MESSAGE =
  "TLS certificate verification failed (common behind corporate proxies). " +
  "Set NODE_EXTRA_CA_CERTS to your organization root CA file, or for local dev only add ATLASSIAN_INSECURE_TLS=true to .env";
