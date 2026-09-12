import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  auth0ClientOptions,
  withAbsoluteLogoutReturnTo,
} from "@/lib/auth0";
import {
  getAuth0Env,
  isAuth0Configured,
  loginHref,
  logoutHref,
  safeReturnTo,
  toAbsoluteReturnTo,
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
    stash();
    expect(safeReturnTo("/profile")).toBe("/profile");
    expect(safeReturnTo("//evil.example")).toBe("/home");
    expect(safeReturnTo("https://evil.example")).toBe("/home");
    expect(loginHref("/home")).toBe("/api/auth/login?returnTo=%2Fhome");
    expect(logoutHref("/")).toBe("/api/auth/logout?returnTo=%2F");
  });

  it("makes logout returnTo absolute when AUTH0_BASE_URL is set", () => {
    stash();
    process.env.AUTH0_BASE_URL = "https://hack-cmu.vercel.app";
    expect(toAbsoluteReturnTo("/")).toBe("https://hack-cmu.vercel.app");
    expect(toAbsoluteReturnTo("/home")).toBe(
      "https://hack-cmu.vercel.app/home",
    );
    expect(logoutHref("/")).toBe(
      "/api/auth/logout?returnTo=https%3A%2F%2Fhack-cmu.vercel.app",
    );
  });

  it("makes logout returnTo absolute when APP_BASE_URL is set", () => {
    stash();
    process.env.APP_BASE_URL = "https://hack-cmu.vercel.app";
    expect(logoutHref("/")).toBe(
      "/api/auth/logout?returnTo=https%3A%2F%2Fhack-cmu.vercel.app",
    );
  });
});

describe("Auth0Client production appBaseUrl", () => {
  it("includes appBaseUrl from AUTH0_BASE_URL when Auth0 is configured", () => {
    stash();
    process.env.AUTH0_SECRET = "s".repeat(64);
    process.env.AUTH0_CLIENT_ID = "client";
    process.env.AUTH0_CLIENT_SECRET = "secret";
    process.env.AUTH0_ISSUER_BASE_URL = "https://tenant.us.auth0.com";
    process.env.AUTH0_BASE_URL = "https://hack-cmu.vercel.app";

    const env = getAuth0Env();
    expect(env?.appBaseUrl).toBe("https://hack-cmu.vercel.app");
    expect(auth0ClientOptions(env!).appBaseUrl).toBe(
      "https://hack-cmu.vercel.app",
    );
  });

  it("omits appBaseUrl when AUTH0_BASE_URL / APP_BASE_URL are unset", () => {
    stash();
    process.env.AUTH0_SECRET = "s".repeat(64);
    process.env.AUTH0_CLIENT_ID = "client";
    process.env.AUTH0_CLIENT_SECRET = "secret";
    process.env.AUTH0_DOMAIN = "tenant.us.auth0.com";

    const env = getAuth0Env();
    expect(env?.appBaseUrl).toBeUndefined();
    expect(auth0ClientOptions(env!)).not.toHaveProperty("appBaseUrl");
  });
});

describe("proxy logout returnTo rewrite", () => {
  it("rewrites relative logout returnTo to an absolute URL when base URL is present", () => {
    stash();
    process.env.AUTH0_SECRET = "s".repeat(64);
    process.env.AUTH0_CLIENT_ID = "client";
    process.env.AUTH0_CLIENT_SECRET = "secret";
    process.env.AUTH0_ISSUER_BASE_URL = "https://tenant.us.auth0.com";
    process.env.AUTH0_BASE_URL = "https://hack-cmu.vercel.app";

    const req = new NextRequest(
      "https://hack-cmu.vercel.app/api/auth/logout?returnTo=%2F",
    );
    const out = withAbsoluteLogoutReturnTo(req);
    expect(out.nextUrl.searchParams.get("returnTo")).toBe(
      "https://hack-cmu.vercel.app",
    );
  });

  it("drops a relative logout returnTo when no base URL is configured", () => {
    stash();
    const req = new NextRequest("http://localhost:3000/api/auth/logout?returnTo=%2F");
    const out = withAbsoluteLogoutReturnTo(req);
    expect(out.nextUrl.searchParams.get("returnTo")).toBeNull();
  });

  it("leaves non-logout requests unchanged", () => {
    stash();
    process.env.AUTH0_BASE_URL = "https://hack-cmu.vercel.app";
    const req = new NextRequest(
      "https://hack-cmu.vercel.app/api/auth/login?returnTo=%2Fplan",
    );
    expect(withAbsoluteLogoutReturnTo(req)).toBe(req);
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
