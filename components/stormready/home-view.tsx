"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuthControls } from "@/components/stormready/auth-controls";
import { usePlanData } from "@/components/stormready/plan-data";
import { LoadingCard } from "@/components/stormready/query-state";
import { useCloudPlanSync } from "@/lib/auth/cloud-sync";
import {
  SEVERITY_RANK,
  formatLocation,
  formatRelativeTime,
} from "@/lib/stormready-format";
import { useProfile } from "@/lib/use-profile";

export function HomeView() {
  const { profile, hydrated } = useProfile();
  useCloudPlanSync();
  const hasProfile = Boolean(profile.home || profile.household);
  const plan = usePlanData(profile, hydrated && hasProfile);

  if (!hydrated) {
    return (
      <main className="flex flex-1 flex-col px-5 pb-8 pt-10">
        <LoadingCard title="StormReady" label="Loading…" lines={2} />
      </main>
    );
  }

  if (!hasProfile) {
    return <Welcome />;
  }

  const alert = [...(plan.alerts?.hazards ?? [])].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  )[0];
  const topAction = plan.recommendations[0];
  const lastUpdated =
    plan.alerts?.observedAt ?? profile.updatedAt ?? profile.home?.updatedAt ?? null;

  return (
    <main className="flex min-h-full flex-1 flex-col px-5 pb-8 pt-8">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
        StormReady
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        {formatLocation(profile.home)}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Last updated {formatRelativeTime(lastUpdated)}
      </p>

      <div className="mt-6 grid gap-3 sr-card-grid">
        <Card eyebrow="Current alert" title={alertTitle(plan, alert?.headline)}>
          {plan.alertsStatus === "error"
            ? "Official alerts could not be loaded. StormReady will not invent a warning."
            : plan.alertsStatus === "unavailable"
              ? "Official alerts are unavailable. StormReady will not invent a warning."
              : plan.alertsStatus === "loading"
                ? "Looking up official products for your location."
                : alert
                  ? "From the last official check for your saved location."
                  : plan.alerts?.allClear === true
                    ? "An official check reported no active products."
                    : "Alert status is not confirmed. This is not an all-clear."}
        </Card>
        <Card eyebrow="Top action" title={actionTitle(plan, topAction?.title)}>
          {plan.recommendationsStatus === "error"
            ? "Recommended actions could not be loaded. StormReady will not invent a checklist."
            : plan.recommendationsStatus === "unavailable"
              ? "Actions will appear when the plan service is connected."
              : plan.recommendationsStatus === "loading"
                ? "Building your plan from official alerts and your home details."
                : topAction
                  ? "Open your plan for timing, constraints, and why this matters."
                  : "No confirmed actions yet."}
        </Card>
      </div>

      <div className="mt-8 flex flex-col gap-3 sr-cta">
        <Button href="/plan">Open your plan</Button>
        <Button href="/onboarding" variant="secondary">
          Update home details
        </Button>
      </div>
    </main>
  );
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
          StormReady shows unavailable — it will not invent warnings.
        </Card>
        <Card title="Yours to keep local">
          Home and household details are stored in this browser until you choose
          to save a plan.
        </Card>
      </div>
    </main>
  );
}

function alertTitle(
  plan: ReturnType<typeof usePlanData>,
  headline?: string,
): string {
  if (plan.alertsStatus === "unavailable" || plan.alertsStatus === "error") {
    return "Unavailable";
  }
  if (plan.alertsStatus === "loading") return "Checking…";
  if (headline) return headline;
  if (plan.alerts?.allClear === true) return "No active official products";
  return "Not confirmed";
}

function actionTitle(
  plan: ReturnType<typeof usePlanData>,
  title?: string,
): string {
  if (
    plan.recommendationsStatus === "unavailable" ||
    plan.recommendationsStatus === "error"
  ) {
    return "Unavailable";
  }
  if (plan.recommendationsStatus === "loading") return "Checking…";
  return title ?? "None confirmed";
}
