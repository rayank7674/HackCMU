import type {
  BudgetClass,
  HazardKind,
  RecommendationCategory,
  RecommendationHorizon,
  RecommendationPriority,
} from "@/types";

export type TransportMode = "car" | "limited" | "none" | "unknown";

export type OptimizationConstraints = {
  /** Planning dollars. `null` means no budget cap. */
  budgetDollars: number | null;
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
  hardConstraint: boolean;
  official: boolean;
  selected: boolean;
  utility: number;
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
  planningCostDollars: number;
  planningMinutes: number;
  hardCount: number;
  discretionaryCount: number;
  notes: string[];
};

export type OptimizationDiff = {
  addedIds: string[];
  removedIds: string[];
  reordered: boolean;
  beforeIds: string[];
  afterIds: string[];
  constraintChanges: {
    budgetDollars: { from: number | null; to: number | null };
    availableTimeMinutes: { from: number | null; to: number | null };
    transport: { from: TransportMode; to: TransportMode };
  };
  planningCostDelta: number;
  planningMinutesDelta: number;
  summary: string;
};
