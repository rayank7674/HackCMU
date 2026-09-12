"use client";

import { useEffect, useRef } from "react";
import { loadProfile, restoreProfile } from "@/lib/profile-store";
import { buildLocalSnapshot, consumePendingSave } from "@/lib/plan-cache";
import { fetchSavedPlan, postSavePlan } from "@/lib/stormready-cloud";
import { notifyProfileChanged } from "@/lib/use-profile";
import { canSavePlan, useAuthSession } from "./session";
import {
  shouldMigrateLocalProfile,
  shouldRestoreCloudProfile,
} from "./sync-rules";

export type CloudSyncNotice = {
  kind: "restored" | "saved" | "error";
  message: string;
};

export { shouldMigrateLocalProfile, shouldRestoreCloudProfile };

export function useCloudPlanSync(onNotice?: (notice: CloudSyncNotice) => void) {
  const session = useAuthSession();
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (!canSavePlan(session) || !session.identity?.sub) return;
    if (ranFor.current === session.identity.sub) return;
    ranFor.current = session.identity.sub;

    let cancelled = false;

    (async () => {
      const pendingSave = consumePendingSave();
      const local = loadProfile();
      const cloud = await fetchSavedPlan();
      if (cancelled) return;

      const cloudSnapshot = cloud.ok ? cloud.data.snapshot : null;
      const cloudUpdatedAt = snapshotUpdatedAt(cloudSnapshot);

      if (pendingSave && shouldMigrateLocalProfile(local, cloudUpdatedAt, true)) {
        const snapshot = buildLocalSnapshot();
        if (snapshot.home || snapshot.household) {
          const saved = await postSavePlan(snapshot);
          if (cancelled) return;
          onNotice?.(
            saved.ok
              ? { kind: "saved", message: "Saved this plan to your account." }
              : { kind: "error", message: saved.message },
          );
          return;
        }
      }

      if (
        cloudSnapshot &&
        (cloudSnapshot.home || cloudSnapshot.household) &&
        shouldRestoreCloudProfile(local, cloudUpdatedAt)
      ) {
        restoreProfile({
          home: cloudSnapshot.home,
          household: cloudSnapshot.household,
          updatedAt: cloudUpdatedAt,
        });
        notifyProfileChanged();
        onNotice?.({
          kind: "restored",
          message: "Restored your saved plan from your account.",
        });
        return;
      }

      if (shouldMigrateLocalProfile(local, cloudUpdatedAt, false)) {
        const snapshot = buildLocalSnapshot();
        if (!snapshot.home && !snapshot.household) return;
        const saved = await postSavePlan(snapshot);
        if (cancelled) return;
        onNotice?.(
          saved.ok
            ? { kind: "saved", message: "Saved this plan to your account." }
            : { kind: "error", message: saved.message },
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, onNotice]);
}

function snapshotUpdatedAt(
  snapshot: {
    home?: { updatedAt?: string } | null;
    household?: { updatedAt?: string } | null;
  } | null,
): string | null {
  if (!snapshot) return null;
  const homeAt = snapshot.home?.updatedAt;
  const householdAt = snapshot.household?.updatedAt;
  if (homeAt && householdAt) {
    return Date.parse(homeAt) >= Date.parse(householdAt) ? homeAt : householdAt;
  }
  return homeAt ?? householdAt ?? null;
}
