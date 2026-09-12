/**
 * Auth identity for Save My Plan.
 *
 * Auth0 SDK is not installed in this PR. `getAuth0Identity` is the hook
 * a later agent should fill with `getSession()` / `getAccessToken()`.
 * The Auth0 user `sub` is the stable identifier written to users.auth0_sub.
 */

export const AUTH0_LOGIN_PATH = "/api/auth/login";
export const AUTH0_LOGOUT_PATH = "/api/auth/logout";

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

export function isAuth0Configured(): boolean {
  return Boolean(
    process.env.AUTH0_SECRET?.trim() &&
      process.env.AUTH0_ISSUER_BASE_URL?.trim() &&
      process.env.AUTH0_CLIENT_ID?.trim() &&
      process.env.AUTH0_CLIENT_SECRET?.trim(),
  );
}

/**
 * Dev-only identity bypass. Requires NODE_ENV !== production AND an
 * explicit ALLOW_SAVE_PLAN_DEV_BYPASS=1. Never honored in production.
 */
export function isDevBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const flag = process.env[DEV_BYPASS_ENV]?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/**
 * Replace this body with Auth0 session lookup, for example:
 *
 *   const session = await auth0.getSession(request);
 *   if (!session?.user?.sub) return null;
 *   return { sub: session.user.sub, email: session.user.email ?? null };
 */
export async function getAuth0Identity(
  request: Request,
): Promise<AuthIdentity | null> {
  void request;
  return null;
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
