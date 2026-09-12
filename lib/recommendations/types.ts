import type {
  BudgetClass,
  HazardState,
  HomeProfile,
  HouseholdProfile,
  Recommendation,
  RecommendationHorizon,
} from "@/types";

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
};

export type RankedRecommendation = Recommendation & {
  horizon: RecommendationHorizon;
  official: boolean;
  costClass: BudgetClass;
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
