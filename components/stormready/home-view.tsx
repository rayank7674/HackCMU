"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandLink } from "@/components/layout/brand-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AuthControls } from "@/components/stormready/auth-controls";
import { PlanView } from "@/components/stormready/plan-view";
import { LoadingCard } from "@/components/stormready/query-state";
import { APP_NAME } from "@/lib/brand";
import { useAppAccess } from "@/lib/use-app-access";

export function HomeView() {
  const { ready, inApp } = useAppAccess();
  const router = useRouter();

  useEffect(() => {
    if (ready && inApp) {
      router.replace("/home");
    }
  }, [inApp, ready, router]);

  if (!ready || inApp) {
    return (
      <main className="flex flex-1 flex-col px-5 pb-8 pt-10">
        <LoadingCard title={APP_NAME} label="Loading…" lines={2} />
      </main>
    );
  }

  return <Welcome />;
}

export function InAppHomeView() {
  const { ready, inApp } = useAppAccess();
  const router = useRouter();

  useEffect(() => {
    if (ready && !inApp) {
      router.replace("/");
    }
  }, [inApp, ready, router]);

  if (!ready || !inApp) {
    return (
      <main className="flex flex-1 flex-col px-5 pb-8 pt-10">
        <LoadingCard title={APP_NAME} label="Loading…" lines={2} />
      </main>
    );
  }

  return <PlanView />;
}

export function Welcome() {
  return (
    <main className="flex min-h-full flex-1 flex-col px-5 pb-10 pt-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-start justify-between gap-3">
          <BrandLink className="text-xs font-semibold uppercase tracking-[0.16em] text-accent" />
          <ThemeToggle />
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
          Your home.
          <span className="mt-1 block">Your risk.</span>
          <span className="mt-1 block text-accent">Your plan.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          A calm, anonymous setup for this household. About three minutes. Your
          answers stay on this device.
        </p>

        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Button href="/onboarding">Get Started</Button>
          <AuthControls returnTo="/home" />
        </div>

        <div className="mt-10 grid gap-3 sr-card-grid">
          <Card title="No account required">
            You can finish setup without signing in. Log in only when you want
            to save a plan across devices.
          </Card>
          <Card title="Official sources only">
            {`Alerts come from connected services. If those routes are down, ${APP_NAME} shows unavailable and will not invent warnings.`}
          </Card>
          <Card title="Yours to keep local">
            Home and household details are stored in this browser until you choose
            to save a plan.
          </Card>
        </div>
      </div>
    </main>
  );
}
