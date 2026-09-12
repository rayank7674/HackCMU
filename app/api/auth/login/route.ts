import { authDisabledResponse } from "@/lib/auth/disabled";
import { getAuth0Client } from "@/lib/auth0";

/**
 * `/api/auth/login` — Auth0 v4 login start.
 * When env is missing this is the graceful 501 persist tests expect.
 * When env is present, proxy.ts usually handles this first.
 */
export async function GET(request: Request) {
  const client = getAuth0Client();
  if (!client) return authDisabledResponse(request);
  return client.middleware(request);
}
