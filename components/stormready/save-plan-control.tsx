"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { canSavePlan, useAuthSession } from "@/lib/auth/session";
import { loginHref } from "@/lib/auth/identity";
import { buildLocalSnapshot, markPendingSave } from "@/lib/plan-cache";
import { postSavePlan } from "@/lib/stormready-cloud";
import type { StormReadySnapshot } from "@/lib/stormready";

type SavePlanControlProps = {
  snapshot?: StormReadySnapshot;
  returnTo?: string;
};

export function SavePlanControl({
  snapshot,
  returnTo = "/home",
}: SavePlanControlProps) {
  const session = useAuthSession(returnTo);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (session.status === "loading") {
    return (
      <p className="text-xs leading-relaxed text-muted">Checking sign-in…</p>
    );
  }

  if (!canSavePlan(session)) {
    if (!session.authConfigured) {
      return (
        <section>
          <Button disabled variant="secondary">
            Save My Plan
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Sign-in is not connected on this deployment. Your plan stays on
            this device.
          </p>
        </section>
      );
    }

    return (
      <section>
        <Button
          variant="secondary"
          onClick={() => {
            markPendingSave();
            window.location.assign(loginHref(returnTo));
          }}
        >
          Save My Plan
        </Button>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          You&apos;ll sign in, then FaultLine will save this household plan
          to your account.
        </p>
      </section>
    );
  }

  return (
    <section>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setNotice(null);
          const payload = snapshot ?? buildLocalSnapshot();
          if (!payload.home && !payload.household) {
            setBusy(false);
            setNotice("Nothing on this device to save yet.");
            return;
          }
          const result = await postSavePlan(payload);
          setBusy(false);
          setNotice(result.ok ? "Plan saved." : result.message);
        }}
      >
        {busy ? "Saving…" : "Save My Plan"}
      </Button>
      {notice ? (
        <p className="mt-2 text-xs leading-relaxed text-muted">{notice}</p>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Saves this household plan to your account.
        </p>
      )}
    </section>
  );
}
