import { afterEach, describe, expect, it } from "vitest";
import { GET as sessionGET } from "@/app/api/auth/session/route";
import { GET as authCatchAllGET } from "@/app/api/auth/[auth0]/route";
import { GET as loadPlanGET } from "@/app/api/load-plan/route";
import { POST as savePlanPOST } from "@/app/api/save-plan/route";
import { NextRequest } from "next/server";

const KEYS = [
  "AUTH0_SECRET",
  "AUTH0_ISSUER_BASE_URL",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "ALLOW_SAVE_PLAN_DEV_BYPASS",
] as const;

const previous = new Map<string, string | undefined>();

function stash() {
  for (const key of KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
}

function restore() {
  for (const key of KEYS) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(restore);

describe("Auth0 routes without env", () => {
  it("GET /api/auth/session reports disabled", async () => {
    stash();
    const response = await sessionGET(
      new Request("http://localhost/api/auth/session"),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.configured).toBe(false);
    expect(body.user).toBeNull();
  });

  it("GET /api/auth/login is a graceful 501", async () => {
    stash();
    const response = await authCatchAllGET(
      new NextRequest("http://localhost/api/auth/login"),
    );
    const body = await response.json();
    expect(response.status).toBe(501);
    expect(body.error).toBe("auth_not_configured");
  });
});

describe("save/load plan gates", () => {
  it("returns 503 when Supabase env is missing", async () => {
    stash();
    const save = await savePlanPOST(
      new Request("http://localhost/api/save-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home: { id: "h1" }, household: null }),
      }),
    );
    const saveBody = await save.json();
    expect(save.status).toBe(503);
    expect(saveBody.error).toBe("supabase_not_configured");

    const load = await loadPlanGET(new Request("http://localhost/api/load-plan"));
    const loadBody = await load.json();
    expect(load.status).toBe(503);
    expect(loadBody.error).toBe("supabase_not_configured");
  });

  it("returns 401 auth_not_configured when Supabase is set but Auth0 is not", async () => {
    stash();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

    const response = await savePlanPOST(
      new Request("http://localhost/api/save-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home: { id: "h1" }, household: null }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.error).toBe("auth_not_configured");
  });
});
