import type {
  BudgetClass,
  HazardState,
  HomeProfile,
  HouseholdProfile,
  Recommendation,
  RecommendationHorizon,
} from "@/types";
import type {
  ConstraintEffect,
  CostEstimateConfidence,
  CostEstimateSource,
  OptimizationConstraints,
  OptimizationResult,
} from "@/lib/optimization/types";

export type HazardSource = "live" | "unavailable" | "fixture";

export type RecommendationInput = {
  home: HomeProfile | null;
  household: HouseholdProfile | null;
  hazards: HazardState | null;
  /**
   * Adapters set `unavailable` when the NWS/geocode fetch failed.
   * The engine then fails closed — it does not invent an all-clear.
   */
  hazardSource?: HazardSource;
  /** Optional knapsack caps from Help Me Prioritize (session-only). */
  constraints?: Partial<OptimizationConstraints>;
};

export type RankedRecommendation = Recommendation & {
  horizon: RecommendationHorizon;
  official: boolean;
  costClass: BudgetClass;
  hardConstraint?: boolean;
  estimatedTimeMinutes?: number;
  estimatedCostRange?: { min: number; max: number };
  /** Preparedness utility 0–1 — not a safety or survival score. */
  utilityScore?: number;
  hazardRelevance?: number;
  householdFit?: number;
  urgency?: number;
  costEstimateSource?: CostEstimateSource;
  costEstimateConfidence?: CostEstimateConfidence;
  constraintEffects?: ConstraintEffect[];
};

export type EngineStatus = "ok" | "unavailable";

export type EngineResult = {
  status: EngineStatus;
  /**
   * Explicit machine reason. Null only when status is ok and hazards
   * were confirmed (all-clear or active products).
   */
  reason: string | null;
  recommendations: RankedRecommendation[];
  matchedRuleIds: string[];
  ruleCount: number;
  /** Null when the engine fails closed. */
  optimization: OptimizationResult | null;
};

export const ENGINE_REASONS = {
  profileMissing: "profile_missing",
  hazardStateMissing: "hazard_state_missing",
  hazardApiUnavailable: "hazard_api_unavailable",
  hazardStateUnconfirmed: "hazard_state_unconfirmed",
  hazardStateInconsistent: "hazard_state_inconsistent",
  allClear: "all_clear",
  activeHazards: "active_hazards",
} as const;
