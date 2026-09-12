import { afterEach, describe, expect, it } from "vitest";
import { GET as loadPlan } from "@/app/api/load-plan/route";
import { POST as savePlan } from "@/app/api/save-plan/route";
import { GET as authLogin } from "@/app/api/auth/login/route";
import { DEV_BYPASS_ENV, DEV_BYPASS_SUB_HEADER } from "@/lib/auth/identity";
import { createEmptyHomeProfile } from "@/lib/stormready";

const PUBLIC_URL = "NEXT_PUBLIC_SUPABASE_URL";
const PUBLIC_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

const originalEnv = {
  url: process.env[PUBLIC_URL],
  key: process.env[PUBLIC_KEY],
  bypass: process.env[DEV_BYPASS_ENV],
  nodeEnv: process.env.NODE_ENV,
};

afterEach(() => {
  restore(PUBLIC_URL, originalEnv.url);
  restore(PUBLIC_KEY, originalEnv.key);
  restore(DEV_BYPASS_ENV, originalEnv.bypass);
  restore("NODE_ENV", originalEnv.nodeEnv);
});

describe("POST /api/save-plan", () => {
  it("returns 503 when Supabase env is missing", async () => {
    delete process.env[PUBLIC_URL];
    delete process.env[PUBLIC_KEY];

    const response = await savePlan(
      new Request("http://localhost/api/save-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home: createEmptyHomeProfile(), household: null }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.error).toBe("supabase_not_configured");
    expect(body.message).toMatch(/NEXT_PUBLIC_SUPABASE_URL/i);
  });

  it("returns 401 when Supabase is set but Auth0 identity is not", async () => {
    process.env[PUBLIC_URL] = "https://example.supabase.co";
    process.env[PUBLIC_KEY] = "anon-key";
    delete process.env[DEV_BYPASS_ENV];

    const response = await savePlan(
      new Request("http://localhost/api/save-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home: createEmptyHomeProfile(), household: null }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.error).toBe("auth_not_configured");
    expect(body.message).toMatch(/Auth0/i);
    expect(body.message).toMatch(/sub/i);
  });

  it("ignores the dev bypass header in production", async () => {
    process.env[PUBLIC_URL] = "https://example.supabase.co";
    process.env[PUBLIC_KEY] = "anon-key";
    process.env[DEV_BYPASS_ENV] = "1";
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";

    const response = await savePlan(
      new Request("http://localhost/api/save-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [DEV_BYPASS_SUB_HEADER]: "auth0|dev-user",
        },
        body: JSON.stringify({ home: createEmptyHomeProfile(), household: null }),
      }),
    );
    expect(response.status).toBe(401);
  });
});

describe("GET /api/load-plan", () => {
  it("returns 503 when Supabase env is missing", async () => {
    delete process.env[PUBLIC_URL];
    delete process.env[PUBLIC_KEY];
    const response = await loadPlan(new Request("http://localhost/api/load-plan"));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.error).toBe("supabase_not_configured");
  });

  it("returns 401 when identity is missing", async () => {
    process.env[PUBLIC_URL] = "https://example.supabase.co";
    process.env[PUBLIC_KEY] = "anon-key";
    delete process.env[DEV_BYPASS_ENV];
    const response = await loadPlan(new Request("http://localhost/api/load-plan"));
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.error).toBe("auth_not_configured");
  });
});

describe("GET /api/auth/login", () => {
  it("returns a clear Auth0-not-wired response", async () => {
    const response = await authLogin(
      new Request("http://localhost/api/auth/login", {
        headers: { accept: "application/json" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(501);
    expect(body.error).toBe("auth_not_configured");
    expect(body.message).toMatch(/Auth0/i);
  });
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  if (key === "NODE_ENV") {
    (process.env as { NODE_ENV?: string }).NODE_ENV = value;
    return;
  }
  process.env[key] = value;
}
