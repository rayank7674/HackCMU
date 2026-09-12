/**
 * Auth identity for Save My Plan.
 *
 * Auth0 `sub` is the stable User key written to Supabase (`users.auth0_sub`).
 * Email is stored when Auth0 provides it.
 */

import { NextRequest } from "next/server";
import { getAuth0Client } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth/env";

export {
  AUTH0_CALLBACK_PATH,
  AUTH0_LOGIN_PATH,
  AUTH0_LOGOUT_PATH,
  AUTH0_ME_PATH,
  AUTH0_SESSION_PATH,
  isAuth0Configured,
  loginHref,
  logoutHref,
  safeReturnTo,
} from "@/lib/auth/env";

export const DEV_BYPASS_SUB_HEADER = "x-stormready-dev-sub";
export const DEV_BYPASS_EMAIL_HEADER = "x-stormready-dev-email";
export const DEV_BYPASS_ENV = "ALLOW_SAVE_PLAN_DEV_BYPASS";

export type AuthIdentity = {
  /** Auth0 `sub` claim, e.g. `auth0|abc123`. */
  sub: string;
  email?: string | null;
  /**
   * Optional Auth0 ID token. When present, the server Supabase client
   * can send it so RLS (`auth.jwt()->>'sub'`) applies.
   */
  accessToken?: string | null;
};

/**
 * Dev-only identity bypass. Requires NODE_ENV !== production AND an
 * explicit ALLOW_SAVE_PLAN_DEV_BYPASS=1. Never honored in production.
 */
export function isDevBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const flag = process.env[DEV_BYPASS_ENV]?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export async function getAuth0Identity(
  request: Request,
): Promise<AuthIdentity | null> {
  const client = getAuth0Client();
  if (!client) return null;

  try {
    const session = await client.getSession(toNextRequest(request));
    const user = session?.user;
    const sub = user?.sub?.trim();
    if (!session || !user || !sub) return null;
    return {
      sub,
      email: user.email ?? null,
      accessToken: session.tokenSet?.idToken ?? null,
    };
  } catch {
    return null;
  }
}

export async function resolveAuthIdentity(
  request: Request,
): Promise<AuthIdentity | null> {
  const fromAuth0 = await getAuth0Identity(request);
  if (fromAuth0?.sub.trim()) {
    return {
      sub: fromAuth0.sub.trim(),
      email: fromAuth0.email ?? null,
      accessToken: fromAuth0.accessToken ?? null,
    };
  }

  return readDevBypassIdentity(request);
}

export function readDevBypassIdentity(request: Request): AuthIdentity | null {
  if (!isDevBypassEnabled()) return null;
  const sub = request.headers.get(DEV_BYPASS_SUB_HEADER)?.trim() ?? "";
  if (!sub) return null;
  const email = request.headers.get(DEV_BYPASS_EMAIL_HEADER)?.trim() || null;
  return { sub, email };
}

export function toNextRequest(request: Request): NextRequest {
  return request instanceof NextRequest
    ? request
    : new NextRequest(request.url, request);
}
