import { NextResponse, type NextRequest } from "next/server";
import { authDisabledResponse } from "@/lib/auth/disabled";
import { isAuth0Configured } from "@/lib/auth/env";
import {
  isAuth0HandledPath,
  isProtectedPlanApiPath,
} from "@/lib/auth/paths";
import { getAuth0Client, withAbsoluteLogoutReturnTo } from "@/lib/auth0";

/**
 * Auth0 v4 mounts login/logout/callback via this Next.js 16 proxy.
 *
 * Matcher is intentionally narrow: Auth0's own routes plus Save/Load
 * plan APIs. Anonymous onboarding, plan browse, and the rest of the
 * app never run through here.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authRoute = isAuth0HandledPath(pathname);
  const planApi = isProtectedPlanApiPath(pathname);

  if (!isAuth0Configured()) {
    if (authRoute) return authDisabledResponse(request);
    return NextResponse.next();
  }

  const client = getAuth0Client();
  if (!client) {
    if (authRoute) return authDisabledResponse(request);
    return NextResponse.next();
  }

  const authResponse = await client.middleware(
    withAbsoluteLogoutReturnTo(request),
  );
  if (authRoute) return authResponse;

  if (planApi) {
    const session = await client.getSession(request);
    if (!session?.user?.sub) {
      return NextResponse.json(
        {
          ok: false,
          error: "unauthenticated",
          message: "Sign in required. Auth0 session did not provide a user sub.",
        },
        { status: 401 },
      );
    }
  }

  return authResponse;
}

export const config = {
  matcher: [
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/callback",
    "/api/auth/me",
    "/api/auth/access-token",
    "/api/auth/backchannel-logout",
    "/api/save-plan",
    "/api/load-plan",
  ],
};
