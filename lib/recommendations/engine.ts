import {
  createEmptyHomeProfile,
  createEmptyHouseholdProfile,
} from "@/lib/profile-store";
import type { HazardState, HomeProfile, HouseholdProfile } from "@/types";
import {
  optimizePreparednessPlan,
  resolveOptimizationConstraints,
  toPreparednessActions,
} from "@/lib/optimization";
import { ALL_RULES, RULE_COUNT } from "../rules";
import type { RuleContext, RuleMatch } from "../rules/types";
import { toRankedRecommendationFromAction } from "./ranking";
import {
  ENGINE_REASONS,
  type EngineResult,
  type RecommendationInput,
} from "./types";

function unavailable(reason: string): EngineResult {
  return {
    status: "unavailable",
    reason,
    recommendations: [],
    matchedRuleIds: [],
    ruleCount: RULE_COUNT,
    optimization: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUsableHazardState(value: HazardState | null): value is HazardState {
  return (
    value !== null &&
    typeof value.observedAt === "string" &&
    value.observedAt !== "" &&
    Array.isArray(value.hazards)
  );
}

/**
 * Fail closed when we cannot honestly describe the hazard picture.
 * An empty hazards list is all-clear only when `allClear === true`.
 */
export function explainHazardAvailability(
  input: RecommendationInput,
): string | null {
  if (input.hazardSource === "unavailable") {
    return ENGINE_REASONS.hazardApiUnavailable;
  }
  if (input.hazards === null || input.hazards === undefined) {
    return ENGINE_REASONS.hazardStateMissing;
  }
  if (!isUsableHazardState(input.hazards)) {
    return ENGINE_REASONS.hazardStateMissing;
  }
  // Missing / garbage allClear is unconfirmed — only true|false are known.
  if (input.hazards.allClear !== true && input.hazards.allClear !== false) {
    return ENGINE_REASONS.hazardStateUnconfirmed;
  }
  if (input.hazards.allClear === false && input.hazards.hazards.length === 0) {
    return ENGINE_REASONS.hazardStateInconsistent;
  }
  return null;
}

function buildContext(input: RecommendationInput): RuleContext | null {
  if (input.home === null || input.home === undefined) return null;
  const home: HomeProfile = createEmptyHomeProfile(input.home);
  const household: HouseholdProfile = input.household
    ? createEmptyHouseholdProfile(input.household)
    : createEmptyHouseholdProfile();
  if (!input.hazards) return null;
  return { home, household, hazards: input.hazards };
}

export function evaluateRules(ctx: RuleContext): RuleMatch[] {
  return ALL_RULES.flatMap((rule) => {
    const match = rule.evaluate(ctx);
    return match ? [match] : [];
  });
}

/**
 * Deterministic Phase 1 engine. Independent of UI and LLMs.
 * Never invents official alerts — `official` is only set when a warning,
 * emergency, or evacuation product is present on HazardState.
 */
export function recommend(input: RecommendationInput): EngineResult {
  if (input.home === null || input.home === undefined) {
    return unavailable(ENGINE_REASONS.profileMissing);
  }

  const hazardReason = explainHazardAvailability(input);
  if (hazardReason) return unavailable(hazardReason);

  const ctx = buildContext(input);
  if (!ctx) return unavailable(ENGINE_REASONS.hazardStateMissing);

  const matches = evaluateRules(ctx);
  const candidates = toPreparednessActions(matches, ctx);
  const constraints = resolveOptimizationConstraints(input.constraints, ctx);
  const optimization = optimizePreparednessPlan(candidates, constraints, {
    hasBackupPower: ctx.home.hasBackupPower === true,
  });
  const allClear =
    ctx.hazards.allClear === true && ctx.hazards.hazards.length === 0;

  return {
    status: "ok",
    reason: allClear ? ENGINE_REASONS.allClear : ENGINE_REASONS.activeHazards,
    recommendations: optimization.selected.map(toRankedRecommendationFromAction),
    matchedRuleIds: matches.map((match) => match.ruleId).sort(),
    ruleCount: RULE_COUNT,
    optimization,
  };
}

export function isRecommendationInput(value: unknown): value is RecommendationInput {
  if (!isRecord(value)) return false;
  if (value.home !== null && value.home !== undefined && !isRecord(value.home)) {
    return false;
  }
  if (
    value.household !== null &&
    value.household !== undefined &&
    !isRecord(value.household)
  ) {
    return false;
  }
  if (
    value.hazards !== null &&
    value.hazards !== undefined &&
    !isRecord(value.hazards)
  ) {
    return false;
  }
  if (
    value.hazardSource !== undefined &&
    value.hazardSource !== "live" &&
    value.hazardSource !== "unavailable" &&
    value.hazardSource !== "fixture"
  ) {
    return false;
  }
  if (value.constraints !== undefined && !isRecord(value.constraints)) {
    return false;
  }
  return true;
}

export { RULE_COUNT };
