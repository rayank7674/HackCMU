import { NextResponse } from "next/server";
import { isAuth0Configured } from "@/lib/auth/identity";

const MESSAGE =
  "Sign-in is not available yet. Your plan stays on this device. A later change will serve Auth0 at this path and put the user sub on the session.";

/**
 * Placeholder for @auth0/nextjs-auth0's /api/auth/login.
 * Returns 501 until Auth0 is configured and the SDK is installed.
 */
export async function GET(request: Request) {
  const payload = {
    ok: false,
    error: "auth_not_configured",
    configured: isAuth0Configured(),
    message: MESSAGE,
  };

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return new NextResponse(loginPlaceholderHtml(payload.message), {
      status: 501,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json(payload, { status: 501 });
}

function loginPlaceholderHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in — StormReady</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f4f7fb; color: #1a2a3a; }
    main { max-width: 28rem; margin: 4rem auto; padding: 0 1.25rem; }
    h1 { font-size: 1.5rem; }
    p { line-height: 1.5; color: #5b6b7c; }
    a { color: #1e4f86; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <h1>Sign in is not connected yet</h1>
    <p>${escapeHtml(message)}</p>
    <p><a href="/plan">Back to your plan</a></p>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
