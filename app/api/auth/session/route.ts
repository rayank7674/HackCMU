import { NextResponse } from "next/server";
import { getAuth0Identity, isAuth0Configured } from "@/lib/auth/identity";

/**
 * Public session probe for the client hook.
 * Never requires login. Does not live under the Auth0-mounted paths,
 * so middleware does not intercept it.
 */
export async function GET(request: Request) {
  const configured = isAuth0Configured();
  if (!configured) {
    return NextResponse.json({ configured: false, user: null });
  }

  const identity = await getAuth0Identity(request);
  if (!identity) {
    return NextResponse.json({ configured: true, user: null });
  }

  return NextResponse.json({
    configured: true,
    user: { sub: identity.sub, email: identity.email ?? null },
  });
}
