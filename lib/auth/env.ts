/**
 * Auth0 environment mapping.
 *
 * StormReady reads the v3-style names the rest of the team already
 * documented. Auth0 Next.js SDK v4 (Next.js 16 App Router) natively
 * wants AUTH0_DOMAIN + APP_BASE_URL — we map those here so nothing
 * is hardcoded and the build stays green with no Auth0 env at all.
 */

export const AUTH0_LOGIN_PATH = "/api/auth/login";
export const AUTH0_LOGOUT_PATH = "/api/auth/logout";
export const AUTH0_CALLBACK_PATH = "/api/auth/callback";
export const AUTH0_ME_PATH = "/api/auth/me";
export const AUTH0_SESSION_PATH = "/api/auth/session";

export type Auth0Env = {
  secret: string;
  clientId: string;
  clientSecret: string;
  /** Hostname only, e.g. `tenant.us.auth0.com`. */
  domain: string;
  /** Full issuer URL, e.g. `https://tenant.us.auth0.com`. */
  issuer: string;
  /** Optional. SDK infers from the request when omitted. */
  appBaseUrl?: string;
};

export function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

/**
 * True when the four Auth0 secrets + issuer/domain are present.
 * AUTH0_BASE_URL / APP_BASE_URL is recommended but not required —
 * v4 can infer the app origin from the incoming request.
 */
export function isAuth0Configured(): boolean {
  return getAuth0Env() !== null;
}

export function getAuth0Env(): Auth0Env | null {
  const secret = readEnv("AUTH0_SECRET");
  const clientId = readEnv("AUTH0_CLIENT_ID");
  const clientSecret = readEnv("AUTH0_CLIENT_SECRET");
  const issuerOrDomain = readEnv("AUTH0_ISSUER_BASE_URL", "AUTH0_DOMAIN");
  const appBaseUrl = readEnv("AUTH0_BASE_URL", "APP_BASE_URL");

  if (!secret || !clientId || !clientSecret || !issuerOrDomain) {
    return null;
  }

  const domain = toAuth0Domain(issuerOrDomain);
  if (!domain) return null;

  return {
    secret,
    clientId,
    clientSecret,
    domain,
    issuer: toAuth0Issuer(issuerOrDomain),
    appBaseUrl: appBaseUrl || undefined,
  };
}

export function toAuth0Domain(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return new URL(trimmed).hostname;
    }
  } catch {
    return "";
  }
  return trimmed.replace(/\/+$/, "");
}

export function toAuth0Issuer(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/** Relative in-app path only. Rejects protocol-relative and absolute URLs. */
export function safeReturnTo(
  value: string | null | undefined,
  fallback = "/plan",
): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  return value;
}

export function loginHref(returnTo = "/plan"): string {
  const params = new URLSearchParams({ returnTo: safeReturnTo(returnTo) });
  return `${AUTH0_LOGIN_PATH}?${params.toString()}`;
}

export function logoutHref(returnTo = "/"): string {
  const params = new URLSearchParams({ returnTo: safeReturnTo(returnTo, "/") });
  return `${AUTH0_LOGOUT_PATH}?${params.toString()}`;
}
