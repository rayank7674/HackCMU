import { NextResponse } from "next/server";
import type { HazardState, HomeProfile, HouseholdProfile } from "@/types";
import type { OptimizationConstraints } from "@/lib/optimization";
import {
  BASELINE_SCENARIO,
  STRESS_PRESETS,
  buildHouseholdGraph,
  scenarioIncludesLocalFeeder,
  compareCounterfactual,
  counterfactualBackupPower,
  customScenario,
  findMinimumBreakdown,
  findWorstCase,
  fortifyFromStress,
  presetById,
  simulate,
  type StressScenario,
} from "@/lib/stress";

const ACTIONS = new Set([
  "simulate",
  "min",
  "worst",
  "fortify",
  "counterfactual_backup",
  "presets",
] as const);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseScenario(value: unknown): StressScenario | null {
  if (!isRecord(value)) return null;
  if (typeof value.id === "string") {
    const preset = presetById(value.id);
    if (preset) return preset;
  }
  const power = value.powerAvailability;
  const road = value.roadAccessibility;
  const transport = value.transport;
  if (
    (power === 100 || power === 75 || power === 50 || power === 25 || power === 0) &&
    (road === 100 || road === 75 || road === 50) &&
    (transport === "car" ||
      transport === "limited" ||
      transport === "none" ||
      transport === "unchanged")
  ) {
    const water =
      value.waterAvailability === 50 || value.waterAvailability === 0
        ? value.waterAvailability
        : 100;
    const hours = value.outageHours === 6 || value.outageHours === 12 ? value.outageHours : null;
    return customScenario({
      powerAvailability: power,
      roadAccessibility: road,
      transport,
      waterAvailability: water,
      outageHours: hours,
    });
  }
  return null;
}

function missingProfile() {
  return NextResponse.json(
    {
      ok: false,
      status: "unavailable",
      reason: "profile_missing",
      modeled: true,
      forecast: false,
    },
    { status: 400 },
  );
}

/**
 * POST /api/stress
 * Pure engine wrapper. Never invents official alerts.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json(
      { ok: false, status: "unavailable", reason: "invalid_request" },
      { status: 400 },
    );
  }

  const action = typeof body.action === "string" ? body.action : "simulate";
  if (!ACTIONS.has(action as never) && action !== "presets") {
    return NextResponse.json(
      { ok: false, status: "unavailable", reason: "unknown_action" },
      { status: 400 },
    );
  }

  if (action === "presets") {
    return NextResponse.json({
      ok: true,
      modeled: true,
      forecast: false,
      presets: STRESS_PRESETS,
    });
  }

  if (!isRecord(body.home)) return missingProfile();
  const home = body.home as unknown as HomeProfile;
  const household = (
    isRecord(body.household) ? body.household : {}
  ) as unknown as HouseholdProfile;
  const scenario = parseScenario(body.scenario) ?? BASELINE_SCENARIO;
  const graph = buildHouseholdGraph(home, household, {
    includeLocalFeeder: scenarioIncludesLocalFeeder(scenario),
  });

  if (action === "simulate") {
    const result = simulate(graph, scenario);
    return NextResponse.json({
      ok: true,
      modeled: true,
      forecast: false,
      graph,
      result,
    });
  }

  if (action === "min") {
    const found = findMinimumBreakdown(home, household);
    return NextResponse.json({
      ok: true,
      modeled: true,
      forecast: false,
      ...found,
    });
  }

  if (action === "worst") {
    const found = findWorstCase(home, household);
    return NextResponse.json({
      ok: true,
      modeled: true,
      forecast: false,
      ...found,
    });
  }

  if (action === "counterfactual_backup") {
    const compared = compareCounterfactual({
      home,
      household,
      scenario,
      variantHome: counterfactualBackupPower(home),
    });
    return NextResponse.json({
      ok: true,
      modeled: true,
      forecast: false,
      ...compared,
    });
  }

  const hazards = isRecord(body.hazards)
    ? (body.hazards as unknown as HazardState)
    : null;
  if (!hazards) {
    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        reason: "hazard_state_missing",
        message:
          "Fortify needs a HazardState. Fail closed - StormReady will not invent alerts or an all-clear.",
      },
      { status: 400 },
    );
  }

  const simulated = simulate(graph, scenario);
  const fortify = fortifyFromStress(
    simulated,
    home,
    household,
    hazards,
    isRecord(body.constraints)
      ? (body.constraints as Partial<OptimizationConstraints>)
      : undefined,
  );
  return NextResponse.json({
    ok: true,
    modeled: true,
    forecast: false,
    result: simulated,
    fortify,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    modeled: true,
    forecast: false,
    presets: STRESS_PRESETS,
  });
}
