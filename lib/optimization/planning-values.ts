import { isUnknown, type BudgetClass, type Unknownable } from "@/types";
import type { RecommendationCategory, RecommendationHorizon } from "@/types";

/**
 * Planning-dollar assumptions for the knapsack — NOT contractor prices.
 * Flexible actions are capped at $400 inside the solver.
 */
export const PLANNING_DOLLARS_BY_COST_CLASS: Record<BudgetClass, number> = {
  zero: 0,
  low: 50,
  moderate: 150,
  flexible: 400,
};

/** Household budget class → planning-dollar cap (flexible uses $500). */
export const HOUSEHOLD_PLANNING_DOLLARS: Record<BudgetClass, number> = {
  zero: 0,
  low: 50,
  moderate: 150,
  flexible: 500,
};

export const PLANNING_MINUTES_BEFORE_NEXT_EVENT = 90;
export const PLANNING_MINUTES_LONG_TERM = 240;

const NOW_MINUTES_BY_CATEGORY: Record<RecommendationCategory, number> = {
  evacuate: 15,
  shelter: 15,
  supplies: 20,
  medical: 15,
  pets: 15,
  power: 20,
  water: 15,
  communication: 10,
  documents: 15,
  other: 20,
};

export const COST_CLASS_RANGE: Record<BudgetClass, { min: number; max: number }> =
  {
    zero: { min: 0, max: 0 },
    low: { min: 0, max: 50 },
    moderate: { min: 50, max: 150 },
    flexible: { min: 150, max: 400 },
  };

export function planningDollarsForCostClass(costClass: BudgetClass): number {
  return PLANNING_DOLLARS_BY_COST_CLASS[costClass];
}

/**
 * Unknown household budget is not treated as flexible — same preference as
 * low/no-cost ranking ($50 planning cap).
 */
export function planningDollarsForHousehold(
  budgetClass: Unknownable<BudgetClass>,
): number {
  if (isUnknown(budgetClass)) return HOUSEHOLD_PLANNING_DOLLARS.low;
  return HOUSEHOLD_PLANNING_DOLLARS[budgetClass];
}

/** Horizon + category planning minutes (now is 10–25). */
export function planningMinutesFor(
  category: RecommendationCategory,
  horizon: RecommendationHorizon,
): number {
  if (horizon === "before_next_event") return PLANNING_MINUTES_BEFORE_NEXT_EVENT;
  if (horizon === "long_term") return PLANNING_MINUTES_LONG_TERM;
  return NOW_MINUTES_BY_CATEGORY[category];
}

export const PLANNING_ASSUMPTION_DISCLAIMER =
  "Planning dollars and minutes are ranking assumptions, not contractor quotes or measured task times. Preparedness utility is not a safety or survival percentage.";
