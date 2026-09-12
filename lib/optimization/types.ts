import type {
  BudgetClass,
  HazardKind,
  RecommendationCategory,
  RecommendationHorizon,
  RecommendationPriority,
} from "@/types";

export type TransportMode = "car" | "limited" | "none" | "unknown";

export type OptimizationConstraints = {
  /**
   * Discrete cost-class units (0=zero, 1=low, 2=moderate, 3=flexible).
   * `null` means no cost-class cap. Not a dollar price.
   */
  budgetUnits?: number | null;
  /**
   * Alias accepted on the API. Mapped onto `budgetUnits` (0–3 already
   * units; larger values are legacy class aliases, not prices).
   */
  budgetDollars?: number | null;
  /** Planning minutes. `null` / unknown time means no time cap. */
  availableTimeMinutes: number | null;
  transport: TransportMode;
};

export type CostEstimateSource = "planning_assumption";

export type CostEstimateConfidence = "low" | "medium";

export type RejectionReason =
  | "excluded_transport"
  | "skipped_backup_power"
  | "over_budget"
  | "over_time"
  | "not_selected"
  | "over_surface_limit";

export type ConstraintEffect =
  | "hard_constraint"
  | "excluded_transport"
  | "skipped_backup_power"
  | "boosted_transport_readiness"
  | "fits_remaining_budget"
  | "fits_remaining_time"
  | "fill_to_minimum";

export type PreparednessAction = {
  id: string;
  ruleId: string;
  title: string;
  body: string;
  rationale: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  hazardKinds: HazardKind[];
  horizon: RecommendationHorizon;
  /** Grounded in an official warning / emergency / evac product. */
  official: boolean;
  /** Official actions OR evacuate category — always selected when eligible. */
  hardConstraint: boolean;
  costClass: BudgetClass;
  /** Discrete cost-class units (0–3), not a price. */
  estimatedCostUnits: number;
  /** @deprecated alias of estimatedCostUnits */
  estimatedCostDollars: number;
  estimatedTimeMinutes: number;
  estimatedCostRange: { min: number; max: number };
  costEstimateSource: CostEstimateSource;
  costEstimateConfidence: CostEstimateConfidence;
  /** Preparedness utility in [0, 1] — not a safety or survival score. */
  utility: number;
  urgency: number;
  hazardRelevance: number;
  householdFit: number;
  requiresTransportation: boolean;
  generatorAcquisition: boolean;
  transportReadiness: boolean;
  constraintEffects: ConstraintEffect[];
};

export type RejectedAction = {
  id: string;
  ruleId: string;
  reasons: RejectionReason[];
};

export type CandidateSummary = {
  id: string;
  ruleId: string;
  title: string;
  category: RecommendationCategory;
  hardConstraint: boolean;
  official: boolean;
  selected: boolean;
  utility: number;
  estimatedCostUnits: number;
  estimatedCostDollars: number;
  estimatedTimeMinutes: number;
};

export type OptimizationResult = {
  solver: "knapsack_dp";
  objective: "maximize_preparedness_utility";
  selected: PreparednessAction[];
  selectedIds: string[];
  rejected: RejectedAction[];
  candidates: CandidateSummary[];
  hardConstraintIds: string[];
  constraintsUsed: OptimizationConstraints;
  planningCostUnits: number;
  /** @deprecated alias of planningCostUnits */
  planningCostDollars: number;
  planningMinutes: number;
  hardCount: number;
  discretionaryCount: number;
  notes: string[];
  /** Set when fewer than MIN_SURFACED actions fit remaining capacity. */
  shortfall: string | null;
};

export type OptimizationDiff = {
  addedIds: string[];
  removedIds: string[];
  /** Same selected id whose rank improved (earlier in the list). */
  promotedIds: string[];
  /** Same selected id whose rank worsened (later in the list). */
  demotedIds: string[];
  addedTitles: string[];
  removedTitles: string[];
  promotedTitles: string[];
  demotedTitles: string[];
  reordered: boolean;
  /** True when official/hard id sets match (order ignored). */
  hardConstraintsUnchanged: boolean;
  beforeIds: string[];
  afterIds: string[];
  constraintChanges: {
    budgetUnits: { from: number | null; to: number | null };
    budgetDollars: { from: number | null; to: number | null };
    availableTimeMinutes: { from: number | null; to: number | null };
    transport: { from: TransportMode; to: TransportMode };
  };
  planningCostDelta: number;
  planningMinutesDelta: number;
  summary: string;
};
