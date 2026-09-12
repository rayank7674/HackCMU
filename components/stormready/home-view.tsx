"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuthControls } from "@/components/stormready/auth-controls";
import { LoadingCard } from "@/components/stormready/query-state";
import { useProfile } from "@/lib/use-profile";

/**
 * `/` is only the welcome door now. Once a household exists, the plan at
 * `/plan` is the home surface, so send people straight there.
 */
export function HomeView() {
  const { profile, hydrated } = useProfile();
  const router = useRouter();
  const hasProfile = Boolean(profile.home || profile.household);

  useEffect(() => {
    if (hydrated && hasProfile) {
      router.replace("/plan");
    }
  }, [hydrated, hasProfile, router]);

  if (!hydrated || hasProfile) {
    return (
      <main className="flex flex-1 flex-col px-5 pb-8 pt-10">
        <LoadingCard title="StormReady" label="Loading…" lines={2} />
      </main>
    );
  }

  return <Welcome />;
}

export function Welcome() {
  return (
    <main className="flex min-h-full flex-1 flex-col px-5 pb-8 pt-10">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
        StormReady
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
        Your home.
        <span className="mt-1 block">Your risk.</span>
        <span className="mt-1 block text-accent-strong">Your plan.</span>
      </h1>
      <p className="mt-4 max-w-sm text-base leading-relaxed text-muted">
        A calm, anonymous setup for this household. About three minutes. Your
        answers stay on this device.
      </p>

      <div className="mt-8 flex flex-col gap-3 sr-cta">
        <Button href="/onboarding">Get Started</Button>
        <AuthControls returnTo="/" />
      </div>

      <div className="mt-10 grid gap-3 sr-card-grid">
        <Card title="No account required">
          You can finish setup without signing in. Log in only when you want
          to save a plan across devices.
        </Card>
        <Card title="Official sources only">
          Alerts come from connected services. If those routes are down,
          StormReady shows unavailable and will not invent warnings.
        </Card>
        <Card title="Yours to keep local">
          Home and household details are stored in this browser until you choose
          to save a plan.
        </Card>
      </div>
    </main>
  );
}
