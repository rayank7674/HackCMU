import { NextRequest } from "next/server";
import { authDisabledResponse } from "@/lib/auth/disabled";
import { getAuth0Client } from "@/lib/auth0";

/**
 * App Router catch-all for `/api/auth/:auth0`.
 *
 * When Auth0 env is present, v4 normally mounts these routes in
 * `proxy.ts`. This handler is the documented fallback
 * (`/api/auth/login`, `/logout`, `/callback`, `/me`) and the graceful
 * disabled response when env is missing.
 */
async function handle(request: NextRequest) {
  const client = getAuth0Client();
  if (!client) return authDisabledResponse(request);
  return client.middleware(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
