import { NextResponse } from "next/server";
import {
  isAuth0Configured,
  resolveAuthIdentity,
  type AuthIdentity,
} from "@/lib/auth/identity";
import { isSupabaseConfigured } from "./env";
import { createServerSupabaseClient } from "./server";
import type { ServerSupabaseClient } from "./server";

export const SUPABASE_NOT_CONFIGURED = {
  ok: false as const,
  error: "supabase_not_configured",
  message:
    "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
};

export const AUTH_NOT_CONFIGURED = {
  ok: false as const,
  error: "auth_not_configured",
  message:
    "No signed-in identity. Set Auth0 env vars and sign in — the session must provide the Auth0 user sub.",
};

export const UNAUTHENTICATED = {
  ok: false as const,
  error: "unauthenticated",
  message: "Sign in required. Auth0 session did not provide a user sub.",
};

export type PlanRouteContext =
  | { ok: false; response: NextResponse }
  | { ok: true; identity: AuthIdentity; client: ServerSupabaseClient };

export async function requirePlanRouteContext(
  request: Request,
): Promise<PlanRouteContext> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(SUPABASE_NOT_CONFIGURED, { status: 503 }),
    };
  }

  const identity = await resolveAuthIdentity(request);
  if (!identity) {
    const body = isAuth0Configured() ? UNAUTHENTICATED : AUTH_NOT_CONFIGURED;
    return {
      ok: false,
      response: NextResponse.json(body, { status: 401 }),
    };
  }

  const client = createServerSupabaseClient({
    privileged: true,
    accessToken: identity.accessToken,
  });
  if (!client) {
    return {
      ok: false,
      response: NextResponse.json(SUPABASE_NOT_CONFIGURED, { status: 503 }),
    };
  }

  return { ok: true, identity, client };
}
