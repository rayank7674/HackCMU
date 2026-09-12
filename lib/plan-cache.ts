import type { HazardState, Recommendation, StormReadySnapshot } from "@/types";
import { loadProfile } from "@/lib/profile-store";

export const PLAN_CACHE_KEY = "stormready:latest-plan:v1";
export const PENDING_SAVE_KEY = "stormready:pending-save";

export type CachedPlanExtras = {
  hazards: HazardState | null;
  recommendations: Recommendation[];
  updatedAt: string;
};

export function canUseSessionStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof window.sessionStorage !== "undefined";
  } catch {
    return false;
  }
}

export function cachePlanExtras(input: {
  hazards?: HazardState | null;
  recommendations?: Recommendation[];
}): CachedPlanExtras | null {
  if (!canUseSessionStorage()) return null;
  const extras: CachedPlanExtras = {
    hazards: input.hazards ?? null,
    recommendations: input.recommendations ?? [],
    updatedAt: new Date().toISOString(),
  };
  try {
    window.sessionStorage.setItem(PLAN_CACHE_KEY, JSON.stringify(extras));
  } catch {
    return extras;
  }
  return extras;
}

export function loadPlanExtras(): CachedPlanExtras | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(PLAN_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPlanExtras;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      hazards: parsed.hazards ?? null,
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [],
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function markPendingSave(): void {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(PENDING_SAVE_KEY, "1");
  } catch {
    // ignore
  }
}

export function consumePendingSave(): boolean {
  if (!canUseSessionStorage()) return false;
  try {
    const pending = window.sessionStorage.getItem(PENDING_SAVE_KEY) === "1";
    window.sessionStorage.removeItem(PENDING_SAVE_KEY);
    return pending;
  } catch {
    return false;
  }
}

export function buildLocalSnapshot(): StormReadySnapshot {
  const profile = loadProfile();
  const extras = loadPlanExtras();
  return {
    home: profile.home,
    household: profile.household,
    hazards: extras?.hazards ?? null,
    recommendations: extras?.recommendations ?? [],
  };
}
