"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuthControls } from "@/components/stormready/auth-controls";
import { usePlanData } from "@/components/stormready/plan-data";
import { LoadingCard } from "@/components/stormready/query-state";
import { useCloudPlanSync } from "@/lib/auth/cloud-sync";
import { STRESS_TEST_HREF } from "@/components/layout/bottom-nav";
import { formatLocation, formatRelativeTime, formatSeverity, SEVERITY_RANK } from "@/lib/stormready-format";
import { useProfile } from "@/lib/use-profile";

export function HomeView() {
  const { profile, hydrated } = useProfile();
  useCloudPlanSync();
  const hasProfile = Boolean(profile.home || profile.household);
  const plan = usePlanData(profile, hydrated && hasProfile);

  if (!hydrated) return <main className="flex flex-1 flex-col px-5 pb-8 pt-10"><LoadingCard title="StormReady" label="Loading…" lines={2} /></main>;
  if (!hasProfile) return <Welcome />;

  const alert = [...(plan.alerts?.hazards ?? [])].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];
  const lastUpdated = plan.alerts?.observedAt ?? profile.updatedAt ?? profile.home?.updatedAt ?? null;
  const alertCopy = plan.alertsStatus === "loading"
    ? "Checking your area…"
    : plan.alertsStatus === "error" || plan.alertsStatus === "unavailable"
      ? "We could not check your area"
      : alert
        ? `${formatSeverity(alert.severity)}: ${alert.headline}`
        : plan.alerts?.allClear === true
          ? "No active alerts"
          : "Alert status not confirmed";

  return (
    <main className="flex min-h-full flex-1 flex-col px-5 pb-10 pt-8">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Home</p>
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">StormReady</h1>
            <p className="mt-2 max-w-xl text-base leading-relaxed text-muted">
              A clear, practical plan for what your household should do before severe weather.
            </p>
          </div>
          <Button href="/plan">Get my plan</Button>
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-surface p-4" aria-labelledby="status-title">
          <div className="flex items-start gap-3">
            <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${alert ? "bg-danger" : plan.alertsStatus === "error" || plan.alertsStatus === "unavailable" ? "bg-warning" : "bg-success"}`} aria-hidden />
            <div className="min-w-0">
              <p id="status-title" className="text-sm font-semibold text-foreground">{alertCopy}</p>
              <p className="mt-1 text-xs text-muted">{formatLocation(profile.home)} · Updated {formatRelativeTime(lastUpdated)}</p>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Card title="Nearby alerts"><Link href="/map" className="text-sm font-semibold text-accent-strong hover:underline">Open map</Link></Card>
          <Card title="Practice a response"><Link href={STRESS_TEST_HREF} className="text-sm font-semibold text-accent-strong hover:underline">Stress test</Link></Card>
          <Card title="Update your home"><Link href="/onboarding" className="text-sm font-semibold text-accent-strong hover:underline">Edit details</Link></Card>
        </div>
      </div>
    </main>
  );
}

export function Welcome() {
  return (
    <main className="flex min-h-full flex-1 flex-col px-5 pb-10 pt-10">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">StormReady</p>
        <h1 className="mt-4 max-w-lg text-4xl font-semibold tracking-tight text-foreground">Know what to do before the weather turns.</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">StormReady turns your home and household details into a short, practical preparedness plan.</p>
        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Button href="/onboarding">Get my plan</Button>
          <AuthControls returnTo="/" />
        </div>
        <p className="mt-6 text-sm text-muted">No account required. Save your plan later if you want access across devices.</p>
      </div>
    </main>
  );
}

