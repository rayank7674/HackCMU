import { afterEach, describe, expect, it } from "vitest";
import {
  getAuth0Env,
  isAuth0Configured,
  loginHref,
  logoutHref,
  safeReturnTo,
  toAuth0Domain,
  toAuth0Issuer,
} from "@/lib/auth/env";
import {
  isAuth0HandledPath,
  isProtectedPlanApiPath,
} from "@/lib/auth/paths";

const AUTH_KEYS = [
  "AUTH0_SECRET",
  "AUTH0_BASE_URL",
  "AUTH0_ISSUER_BASE_URL",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_DOMAIN",
  "APP_BASE_URL",
] as const;

const previous = new Map<string, string | undefined>();

function stash() {
  for (const key of AUTH_KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
}

function restore() {
  for (const key of AUTH_KEYS) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(restore);

describe("Auth0 env mapping", () => {
  it("is disabled when env is missing", () => {
    stash();
    expect(isAuth0Configured()).toBe(false);
    expect(getAuth0Env()).toBeNull();
  });

  it("maps AUTH0_ISSUER_BASE_URL to a domain host", () => {
    stash();
    process.env.AUTH0_SECRET = "s".repeat(64);
    process.env.AUTH0_CLIENT_ID = "client";
    process.env.AUTH0_CLIENT_SECRET = "secret";
    process.env.AUTH0_ISSUER_BASE_URL = "https://tenant.us.auth0.com";
    process.env.AUTH0_BASE_URL = "http://localhost:3000";

    expect(isAuth0Configured()).toBe(true);
    expect(getAuth0Env()).toMatchObject({
      domain: "tenant.us.auth0.com",
      issuer: "https://tenant.us.auth0.com",
      appBaseUrl: "http://localhost:3000",
    });
  });

  it("accepts AUTH0_DOMAIN without a scheme", () => {
    expect(toAuth0Domain("tenant.auth0.com")).toBe("tenant.auth0.com");
    expect(toAuth0Issuer("tenant.auth0.com")).toBe("https://tenant.auth0.com");
  });
});

describe("returnTo helpers", () => {
  it("keeps in-app paths and rejects absolute URLs", () => {
    expect(safeReturnTo("/profile")).toBe("/profile");
    expect(safeReturnTo("//evil.example")).toBe("/plan");
    expect(safeReturnTo("https://evil.example")).toBe("/plan");
    expect(loginHref("/plan")).toBe("/api/auth/login?returnTo=%2Fplan");
    expect(logoutHref("/")).toBe("/api/auth/logout?returnTo=%2F");
  });
});

describe("middleware path gates", () => {
  it("protects only save/load APIs", () => {
    expect(isProtectedPlanApiPath("/api/save-plan")).toBe(true);
    expect(isProtectedPlanApiPath("/api/load-plan")).toBe(true);
    expect(isProtectedPlanApiPath("/api/recommendations")).toBe(false);
    expect(isProtectedPlanApiPath("/onboarding")).toBe(false);
    expect(isProtectedPlanApiPath("/plan")).toBe(false);
  });

  it("handles Auth0 routes under /api/auth/*", () => {
    expect(isAuth0HandledPath("/api/auth/login")).toBe(true);
    expect(isAuth0HandledPath("/api/auth/callback")).toBe(true);
    expect(isAuth0HandledPath("/api/auth/session")).toBe(false);
  });
});
