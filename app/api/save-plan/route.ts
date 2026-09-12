import { NextResponse } from "next/server";
import { requirePlanRouteContext } from "@/lib/supabase/plan-api";
import { saveStormReadySnapshot } from "@/lib/supabase/persist";
import type {
  HomeProfile,
  HouseholdProfile,
  StormReadySnapshot,
} from "@/types";
import { hydrateHazardState, hydrateRecommendations } from "@/lib/supabase/persist";
import { hydrateHomeProfile, hydrateHouseholdProfile } from "@/lib/profile-store";

/**
 * POST /api/save-plan
 * Body: StormReadySnapshot { home, household, hazards?, recommendations? }
 *
 * 503 if Supabase env is missing.
 * 401 if Auth0 identity is not available (dev bypass is development-only).
 */
export async function POST(request: Request) {
  const context = await requirePlanRouteContext(request);
  if (!context.ok) return context.response;

  const body = await request.json().catch(() => null);
  const snapshot = parseSnapshot(body);
  if (!snapshot) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Body must be a StormReady snapshot with home and/or household.",
      },
      { status: 400 },
    );
  }

  const result = await saveStormReadySnapshot(
    context.client,
    context.identity,
    snapshot,
  );
  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    userId: result.userId,
    snapshot: result.snapshot,
  });
}

function parseSnapshot(value: unknown): StormReadySnapshot | null {
  if (!isRecord(value)) return null;
  const home = parseHome(value.home);
  const household = parseHousehold(value.household);
  if (home === undefined || household === undefined) return null;
  if (home === null && household === null) return null;

  return {
    home,
    household,
    hazards: value.hazards === undefined ? null : hydrateHazardState(value.hazards),
    recommendations: hydrateRecommendations(value.recommendations),
  };
}

function parseHome(value: unknown): HomeProfile | null | undefined {
  if (value === null || value === undefined) return null;
  const home = hydrateHomeProfile(value);
  return home ?? undefined;
}

function parseHousehold(value: unknown): HouseholdProfile | null | undefined {
  if (value === null || value === undefined) return null;
  const household = hydrateHouseholdProfile(value);
  return household ?? undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
