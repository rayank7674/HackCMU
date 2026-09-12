import { NextResponse } from "next/server";

export const AUTH_DISABLED_MESSAGE =
  "Auth0 is not configured. Set AUTH0_SECRET, AUTH0_ISSUER_BASE_URL, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET. Anonymous onboarding still works.";

export const AUTH_DISABLED_BODY = {
  ok: false as const,
  error: "auth_not_configured",
  configured: false,
  message: AUTH_DISABLED_MESSAGE,
};

export function authDisabledResponse(request: Request): NextResponse {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return new NextResponse(authDisabledHtml(), {
      status: 501,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return NextResponse.json(AUTH_DISABLED_BODY, { status: 501 });
}

function authDisabledHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in - StormReady</title>
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
    <h1>Sign in is not connected</h1>
    <p>${escapeHtml(AUTH_DISABLED_MESSAGE)}</p>
    <p><a href="/">Back to StormReady</a></p>
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
