import {
  createEmptyHomeProfile,
  createEmptyHouseholdProfile,
} from "@/lib/profile-store";
import { explainHazardAvailability } from "@/lib/recommendations/engine";
import type { OptimizationConstraints, OptimizationResult } from "@/lib/optimization";
import type { HazardState, HomeProfile, HouseholdProfile } from "@/types";
import { fortifyFromStress } from "./fortify";
import { buildHouseholdGraph } from "./graph";
import { simulate } from "./propagate";
import { presetById } from "./presets";
import { findMinimumBreakdown, findWorstCase } from "./search";
import type {
  MinBreakdown,
  StressResult,
  StressScenario,
  WorstCase,
} from "./types";

export type StressActionName = "simulate" | "min" | "worst" | "fortify";

export type StressRunOk = {
  ok: true;
  modeled: true;
  forecast: false;
  action: StressActionName;
  result: StressResult | null;
  breakdown: MinBreakdown | WorstCase | null;
  optimization: OptimizationResult | null;
};

export type StressRunFail = {
  ok: false;
  status: "unavailable";
  reason: string;
  modeled: true;
  forecast: false;
};

export type StressRunResult = StressRunOk | StressRunFail;

const POWER = new Set([100, 75, 50, 25, 0]);
const ROAD = new Set([100, 75, 50]);
const WATER = new Set([100, 50, 0]);
const TRANSPORT = new Set(["car", "limited", "none", "unchanged"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseStressScenario(value: unknown): StressScenario | null {
  if (typeof value === "string") {
    return presetById(value) ?? null;
  }
  if (!isRecord(value)) return null;
  const power = value.powerAvailability;
  const road = value.roadAccessibility;
  const transport = value.transport;
  const water = value.waterAvailability ?? 100;
  if (typeof power !== "number" || !POWER.has(power)) return null;
  if (typeof road !== "number" || !ROAD.has(road)) return null;
  if (typeof transport !== "string" || !TRANSPORT.has(transport)) return null;
  if (typeof water !== "number" || !WATER.has(water)) return null;
  const outage =
    value.outageHours === 6 || value.outageHours === 12 || value.outageHours === null
      ? value.outageHours
      : null;
  const boost =
    value.hazardBoost === "wind" ||
    value.hazardBoost === "flood" ||
    value.hazardBoost === "winter"
      ? value.hazardBoost
      : null;
  const id = typeof value.id === "string" && value.id.trim() ? value.id : "custom";
  const label =
    typeof value.label === "string" && value.label.trim()
      ? value.label
      : "Custom modeled scenario";
  const disclaimer =
    typeof value.disclaimer === "string" && value.disclaimer.trim()
      ? value.disclaimer
      : "Simulated planning scenario. Not a forecast and not an official alert.";
  return {
    id,
    label,
    disclaimer,
    powerAvailability: power as StressScenario["powerAvailability"],
    roadAccessibility: road as StressScenario["roadAccessibility"],
    transport: transport as StressScenario["transport"],
    waterAvailability: water as StressScenario["waterAvailability"],
    outageHours: outage,
    hazardBoost: boost,
  };
}

export function parseStressAction(value: unknown): StressActionName | null {
  if (
    value === "simulate" ||
    value === "min" ||
    value === "worst" ||
    value === "fortify"
  ) {
    return value;
  }
  return null;
}

export function runStress(input: {
  home: HomeProfile | null | undefined;
  household?: HouseholdProfile | null;
  scenario?: unknown;
  action: StressActionName;
  constraints?: Partial<OptimizationConstraints>;
  hazards?: HazardState | null;
}): StressRunResult {
  if (!input.home) {
    return {
      ok: false,
      status: "unavailable",
      reason: "profile_missing",
      modeled: true,
      forecast: false,
    };
  }

  const home = createEmptyHomeProfile(input.home);
  const household = input.household
    ? createEmptyHouseholdProfile(input.household)
    : createEmptyHouseholdProfile();

  if (input.action === "min") {
    const breakdown = findMinimumBreakdown(home, household);
    return {
      ok: true,
      modeled: true,
      forecast: false,
      action: "min",
      result: breakdown.result,
      breakdown,
      optimization: null,
    };
  }

  if (input.action === "worst") {
    const breakdown = findWorstCase(home, household);
    return {
      ok: true,
      modeled: true,
      forecast: false,
      action: "worst",
      result: breakdown.result,
      breakdown,
      optimization: null,
    };
  }

  const scenario = parseStressScenario(input.scenario);
  if (!scenario) {
    return {
      ok: false,
      status: "unavailable",
      reason: "invalid_scenario",
      modeled: true,
      forecast: false,
    };
  }

  const result = simulate(buildHouseholdGraph(home, household), scenario);

  if (input.action === "simulate") {
    return {
      ok: true,
      modeled: true,
      forecast: false,
      action: "simulate",
      result,
      breakdown: null,
      optimization: null,
    };
  }

  const hazardBlock = explainHazardAvailability({
    home,
    household,
    hazards: input.hazards ?? null,
    hazardSource: input.hazards ? "live" : "unavailable",
  });
  if (hazardBlock) {
    return {
      ok: false,
      status: "unavailable",
      reason: hazardBlock,
      modeled: true,
      forecast: false,
    };
  }
  if (!input.hazards) {
    return {
      ok: false,
      status: "unavailable",
      reason: "hazard_state_missing",
      modeled: true,
      forecast: false,
    };
  }

  const optimization = fortifyFromStress(
    result,
    home,
    household,
    input.hazards,
    input.constraints,
  );

  return {
    ok: true,
    modeled: true,
    forecast: false,
    action: "fortify",
    result,
    breakdown: null,
    optimization,
  };
}
