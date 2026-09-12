import { authDisabledResponse } from "@/lib/auth/disabled";
import { handleAuth0Middleware } from "@/lib/auth0";

/**
 * `/api/auth/login` - Auth0 v4 login start.
 * When env is missing this is the graceful 501 persist tests expect.
 * When env is present, proxy.ts usually handles this first.
 */
export async function GET(request: Request) {
  const response = await handleAuth0Middleware(request);
  if (!response) return authDisabledResponse(request);
  return response;
}
