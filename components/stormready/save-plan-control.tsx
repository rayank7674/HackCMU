"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { canSavePlan, useAuthSession } from "@/lib/auth/session";
import { postSavePlan } from "@/lib/stormready-cloud";
import type { StormReadySnapshot } from "@/lib/stormready";

type SavePlanControlProps = {
  snapshot: StormReadySnapshot;
};

export function SavePlanControl({ snapshot }: SavePlanControlProps) {
  const session = useAuthSession();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!canSavePlan(session)) {
    return (
      <section>
        <Button href={session.loginHref} variant="secondary">
          Sign in to save
        </Button>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Your plan stays on this device until you sign in. Cloud save will use
          your account once Auth0 is connected.
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
          const result = await postSavePlan(snapshot);
          setBusy(false);
          setNotice(
            result.ok
              ? "Plan saved."
              : result.message,
          );
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
