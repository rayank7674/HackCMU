"use client";

import { useEffect, useState } from "react";
import {
  AUTH0_LOGIN_PATH,
  AUTH0_LOGOUT_PATH,
  AUTH0_SESSION_PATH,
  loginHref,
  logoutHref,
  type AuthIdentity,
} from "./identity";

export type AuthSessionStatus = "loading" | "unauthenticated" | "authenticated";

export type AuthSession = {
  status: AuthSessionStatus;
  identity: AuthIdentity | null;
  authConfigured: boolean;
  loginHref: string;
  logoutHref: string;
};

export type AuthSessionResponse = {
  configured: boolean;
  user: { sub: string; email?: string | null } | null;
};

const idle: AuthSession = {
  status: "loading",
  identity: null,
  authConfigured: false,
  loginHref: AUTH0_LOGIN_PATH,
  logoutHref: AUTH0_LOGOUT_PATH,
};

export function useAuthSession(returnTo = "/home"): AuthSession {
  const [session, setSession] = useState<AuthSession>({
    ...idle,
    loginHref: loginHref(returnTo),
    logoutHref: logoutHref("/"),
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(AUTH0_SESSION_PATH, { cache: "no-store" });
        const body = (await response.json().catch(() => null)) as
          | AuthSessionResponse
          | null;
        if (cancelled) return;

        const configured = Boolean(body?.configured);
        const sub = body?.user?.sub?.trim() ?? "";
        if (sub) {
          setSession({
            status: "authenticated",
            identity: { sub, email: body?.user?.email ?? null },
            authConfigured: configured,
            loginHref: loginHref(returnTo),
            logoutHref: logoutHref("/"),
          });
          return;
        }

        setSession({
          status: "unauthenticated",
          identity: null,
          authConfigured: configured,
          loginHref: loginHref(returnTo),
          logoutHref: logoutHref("/"),
        });
      } catch {
        if (cancelled) return;
        setSession({
          status: "unauthenticated",
          identity: null,
          authConfigured: false,
          loginHref: loginHref(returnTo),
          logoutHref: logoutHref("/"),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [returnTo]);

  return session;
}

export function canSavePlan(session: AuthSession): boolean {
  return session.status === "authenticated" && Boolean(session.identity?.sub);
}
