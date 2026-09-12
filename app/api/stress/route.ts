import { NextResponse } from "next/server";
import {
  parseStressAction,
  runStress,
} from "@/lib/stress";
import type { OptimizationConstraints } from "@/lib/optimization";
import type { HazardState, HomeProfile, HouseholdProfile } from "@/types";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * POST /api/stress
 * { home, household, scenario, action: "simulate"|"min"|"worst"|"fortify", constraints?, hazards? }
 *
 * Fail closed when home is missing. Fortify also fails closed without a
 * confirmed hazard state (never invents alerts or an all-clear).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        reason: "invalid_request",
        modeled: true,
        forecast: false,
      },
      { status: 400 },
    );
  }

  const action = parseStressAction(body.action);
  if (!action) {
    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        reason: "invalid_request",
        modeled: true,
        forecast: false,
      },
      { status: 400 },
    );
  }

  const home = isRecord(body.home) ? (body.home as HomeProfile) : null;
  const household = isRecord(body.household)
    ? (body.household as HouseholdProfile)
    : null;
  const hazards = isRecord(body.hazards) ? (body.hazards as HazardState) : null;
  const constraints = isRecord(body.constraints)
    ? (body.constraints as Partial<OptimizationConstraints>)
    : undefined;

  const result = runStress({
    home,
    household,
    scenario: body.scenario,
    action,
    constraints,
    hazards,
  });

  if (!result.ok) {
    const status = result.reason === "profile_missing" || result.reason === "invalid_scenario"
      ? 400
      : 200;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
