"use client";

import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth/session";

type AuthControlsProps = {
  returnTo?: string;
  showWhenConfiguredOnly?: boolean;
};

export function AuthControls({
  returnTo = "/profile",
  showWhenConfiguredOnly = false,
}: AuthControlsProps) {
  const session = useAuthSession(returnTo);

  if (session.status === "loading") {
    return (
      <p className="text-xs leading-relaxed text-muted">Checking sign-in…</p>
    );
  }

  if (session.status === "authenticated") {
    const label = session.identity?.email
      ? `Signed in as ${session.identity.email}`
      : "Signed in";
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs leading-relaxed text-muted">{label}</p>
        <Button href={session.logoutHref} variant="secondary">
          Log Out
        </Button>
      </div>
    );
  }

  if (!session.authConfigured) {
    if (showWhenConfiguredOnly) return null;
    return (
      <Button disabled variant="secondary" title="Auth0 is not configured">
        Log In
      </Button>
    );
  }

  return (
    <Button href={session.loginHref} variant="secondary">
      Log In
    </Button>
  );
}
