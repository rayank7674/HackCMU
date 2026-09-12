export const AUTH0_HANDLED_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/callback",
  "/api/auth/me",
  "/api/auth/access-token",
  "/api/auth/backchannel-logout",
] as const;

export const PROTECTED_PLAN_API_PATHS = [
  "/api/save-plan",
  "/api/load-plan",
] as const;

export function isAuth0HandledPath(pathname: string): boolean {
  return (AUTH0_HANDLED_PATHS as readonly string[]).includes(pathname);
}

export function isProtectedPlanApiPath(pathname: string): boolean {
  return (PROTECTED_PLAN_API_PATHS as readonly string[]).includes(pathname);
}
