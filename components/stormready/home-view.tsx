"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuthControls } from "@/components/stormready/auth-controls";
import { usePlanData } from "@/components/stormready/plan-data";
import { LoadingCard } from "@/components/stormready/query-state";
import { useCloudPlanSync } from "@/lib/auth/cloud-sync";
import { STRESS_TEST_HREF } from "@/components/layout/bottom-nav";
import { seasonFromHome } from "@/lib/integrations/season";
import { topChecklistAction } from "@/lib/plan-checklist";
import {
  SEVERITY_RANK,
  formatLocation,
  formatRelativeTime,
  formatSeverity,
  householdSummary,
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
  const stepOne = topChecklistAction(plan.recommendations);
  const lastUpdated =
    plan.alerts?.observedAt ?? profile.updatedAt ?? profile.home?.updatedAt ?? null;
  const season = seasonFromHome(profile.home);

  return (
    <main className="flex min-h-full flex-1 flex-col px-5 pb-8 pt-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
        Now
      </p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {formatLocation(profile.home)}
          </h1>
          {season.applicable ? (
            <p className="mt-3 inline-flex w-fit rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-strong">
              {season.label}
            </p>
          ) : null}
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {season.sourceNote}
          </p>
          <p className="mt-2 text-xs text-muted">
            Last updated {formatRelativeTime(lastUpdated)}
          </p>
        </div>
        <Link
          href="/onboarding"
          className="shrink-0 rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-accent-strong hover:bg-surface-elevated"
        >
          Update home details
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sr-card-grid">
        <Card eyebrow="Official status" title={alertTitle(plan, alert?.headline)}>
          {plan.alertsStatus === "error"
            ? "Official alerts could not be loaded. StormReady will not invent a warning."
            : plan.alertsStatus === "unavailable"
              ? "Official alerts are unavailable. StormReady will not invent a warning."
              : plan.alertsStatus === "loading"
                ? "Looking up official products for your location."
                : alert
                  ? `${formatSeverity(alert.severity)}. From the last official check for your saved location.`
                  : plan.alerts?.allClear === true
                    ? "An official check reported no active products."
                    : "Alert status is not confirmed. This is not an all-clear."}
        </Card>
        <Card
          eyebrow="Step 1 · Top action"
          title={actionTitle(plan, stepOne?.title)}
        >
          {plan.recommendationsStatus === "error"
            ? "Recommended actions could not be loaded. StormReady will not invent a checklist."
            : plan.recommendationsStatus === "unavailable"
              ? "Actions will appear when the plan service is connected."
              : plan.recommendationsStatus === "loading"
                ? "Building your plan from official alerts and your home details."
                : stepOne
                  ? "Same as Step 1 on your plan. Open the plan for the full checklist and why."
                  : "No confirmed actions yet."}
        </Card>
      </div>

      <div className="mt-8 flex flex-col gap-3 sr-cta">
        <Button href="/plan">Open your plan</Button>
      </div>

      <section className="mt-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
          Also useful
        </p>
        <div className="mt-3 grid gap-3 sr-card-grid">
          <Card eyebrow="Map" title="See nearby alerts">
            <p>
              Check how official products relate to your area on the map.
            </p>
            <Link
              href="/map"
              className="mt-3 inline-flex text-sm font-semibold text-accent-strong underline-offset-2 hover:underline"
            >
              Open map
            </Link>
          </Card>
          <Card eyebrow="Stress test" title="Practice a power outage">
            <p>
              Run a simulated outage to spot weak links before a real storm.
            </p>
            <Link
              href={STRESS_TEST_HREF}
              className="mt-3 inline-flex text-sm font-semibold text-accent-strong underline-offset-2 hover:underline"
            >
              Test this house
            </Link>
          </Card>
          <Card eyebrow="Household" title="What we know about this home">
            <p>{householdSummary(profile.household)}</p>
            <Link
              href="/help"
              className="mt-3 inline-flex text-sm font-semibold text-accent-strong underline-offset-2 hover:underline"
            >
              Official help links
            </Link>
          </Card>
        </div>
      </section>
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

