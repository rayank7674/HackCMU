"use client";

import {
  AUTH0_LOGIN_PATH,
  AUTH0_LOGOUT_PATH,
  type AuthIdentity,
} from "./identity";

export type AuthSessionStatus = "loading" | "unauthenticated" | "authenticated";

export type AuthSession = {
  status: AuthSessionStatus;
  identity: AuthIdentity | null;
  /**
   * False until Auth0 env + SDK are wired. The Save My Plan control uses
   * this to show "Sign in to save". Replace `useAuthSession` internals
   * with Auth0 `useUser()` (or middleware-provided session) later.
   */
  authConfigured: boolean;
  loginHref: typeof AUTH0_LOGIN_PATH;
  logoutHref: typeof AUTH0_LOGOUT_PATH;
};

/**
 * Client hook for Save My Plan / sign-in CTA.
 *
 * Today Auth0 is not installed, so this always returns unauthenticated.
 * Later:
 *
 *   const { user, isLoading } = useUser();
 *   if (isLoading) return { status: "loading", ... };
 *   if (!user?.sub) return { status: "unauthenticated", ... };
 *   return { status: "authenticated", identity: { sub: user.sub, email: user.email }, ... };
 */
export function useAuthSession(): AuthSession {
  return {
    status: "unauthenticated",
    identity: null,
    authConfigured: false,
    loginHref: AUTH0_LOGIN_PATH,
    logoutHref: AUTH0_LOGOUT_PATH,
  };
}

export function canSavePlan(session: AuthSession): boolean {
  return session.status === "authenticated" && Boolean(session.identity?.sub);
}
