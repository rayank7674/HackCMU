import type { HazardState, HomeProfile, HouseholdProfile } from "@/types";
import type { OptimizationConstraints } from "@/lib/optimization";
import type { StressScenario } from "./types";

export const STRESS_PATH = "/api/stress";

export type StressAction =
  | "simulate"
  | "min"
  | "worst"
  | "fortify"
  | "counterfactual_backup"
  | "presets";

export type StressRequest = {
  action: StressAction;
  home?: HomeProfile | null;
  household?: HouseholdProfile | null;
  scenario?: Partial<StressScenario> | { id: string };
  hazards?: HazardState | null;
  constraints?: Partial<OptimizationConstraints>;
};

export async function postStress(body: StressRequest): Promise<unknown> {
  const response = await fetch(STRESS_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}
