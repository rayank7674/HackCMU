"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import {
  formatDwelling,
  formatLocation,
  householdSummary,
} from "@/lib/stormready-format";
import { AuthControls } from "@/components/stormready/auth-controls";
import { SavePlanControl } from "@/components/stormready/save-plan-control";
import { useCloudPlanSync } from "@/lib/auth/cloud-sync";
import { clearOnboardingStep } from "@/lib/onboarding-progress";
import { useProfile } from "@/lib/use-profile";

export default function ProfilePage() {
  const { profile, hydrated, reset } = useProfile();
  const [confirmClear, setConfirmClear] = useState(false);
  useCloudPlanSync();

  const hasPlan = Boolean(profile.home || profile.household);
  const facts = hasPlan
    ? [
        formatDwelling(profile.home?.dwellingType ?? "unknown"),
        ...householdSummary(profile.household)
          .split(" · ")
          .filter((line) => line && line !== "Household details not added yet."),
      ]
    : [];

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 pb-8 pt-4">
        {!hydrated ? (
          <p className="text-sm text-muted">Loading this device…</p>
        ) : hasPlan ? (
          <>
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                This device
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                {formatLocation(profile.home)}
              </h2>
              {facts.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm leading-relaxed text-muted">
                  {facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            <Card title="Plan">
              <div className="flex flex-col gap-2">
                <Button href="/onboarding">Update home details</Button>
                <SavePlanControl
                  quiet
                  snapshot={{
                    home: profile.home,
                    household: profile.household,
                    hazards: null,
                    recommendations: [],
                  }}
                  returnTo="/profile"
                />
              </div>
            </Card>

            <Card title="Account">
              <AuthControls returnTo="/profile" />
            </Card>

            <Button
              variant="secondary"
              className="border-danger/40 text-danger hover:bg-danger/10"
              onClick={() => setConfirmClear(true)}
            >
              Clear this device
            </Button>
          </>
        ) : (
          <>
            <Card title="Nothing saved here">
              You can set up a home without creating an account. Details stay in
              this browser until you save a plan.
            </Card>
            <Button href="/onboarding">Get Started</Button>
            <AuthControls returnTo="/profile" />
          </>
        )}
      </div>

      <Modal
        open={confirmClear}
        title="Clear this device?"
        onClose={() => setConfirmClear(false)}
      >
        <p>
          This removes the home and household plan stored in this browser. It
          cannot be undone.
        </p>
        <div className="mt-4">
          <Button
            onClick={() => {
              reset();
              clearOnboardingStep();
              setConfirmClear(false);
            }}
          >
            Clear plan
          </Button>
        </div>
      </Modal>
    </main>
  );
}
