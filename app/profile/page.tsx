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

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 pb-8 pt-4">
        {!hydrated ? (
          <p className="text-sm text-muted">Loading this device…</p>
        ) : profile.home || profile.household ? (
          <>
            <Card eyebrow="This device" title={formatLocation(profile.home)}>
              <p>{formatDwelling(profile.home?.dwellingType ?? "unknown")}</p>
              <p className="mt-2">{householdSummary(profile.household)}</p>
            </Card>
            <div className="flex flex-wrap gap-2">
              <Button href="/onboarding">Update home details</Button>
              <SavePlanControl
                snapshot={{
                  home: profile.home,
                  household: profile.household,
                  hazards: null,
                  recommendations: [],
                }}
                returnTo="/profile"
              />
            </div>
            <details className="rounded-2xl border border-border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Account
              </summary>
              <div className="mt-3">
                <AuthControls returnTo="/profile" />
              </div>
            </details>
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
        <p className="text-xs leading-relaxed text-muted">
          Onboarding stays anonymous. Log in only to save or restore a plan.
        </p>
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
