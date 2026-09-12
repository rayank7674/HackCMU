"use client";

import { useAuthSession } from "@/lib/auth/session";
import { useProfile } from "@/lib/use-profile";

/**
 * A visitor is someone on the public landing page: no household on this
 * device and no Auth0 session. Everyone else is in the app, where Home
 * is the plan.
 */
export function useAppAccess() {
  const { profile, hydrated } = useProfile();
  const session = useAuthSession("/");
  const hasHousehold = Boolean(profile.home || profile.household);
  const signedIn = session.status === "authenticated";
  const inApp = hasHousehold || signedIn;
  const ready = hydrated && (hasHousehold || session.status !== "loading");

  return { ready, inApp, hasHousehold, signedIn };
}
