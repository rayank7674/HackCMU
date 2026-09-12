import { isUnknown, type BudgetClass, type Unknownable } from "@/types";
import type { RecommendationCategory, RecommendationHorizon } from "@/types";

/**
 * Discrete knapsack cost units from budget class - not contractor prices.
 * zero=0, low=1, moderate=2, flexible=3.
 */
export const COST_UNITS_BY_CLASS: Record<BudgetClass, number> = {
  zero: 0,
  low: 1,
  moderate: 2,
  flexible: 3,
};

/** Household budget class → unit cap (same ladder as action cost). */
export const HOUSEHOLD_COST_UNITS: Record<BudgetClass, number> = {
  zero: 0,
  low: 1,
  moderate: 2,
  flexible: 3,
};

/** @deprecated alias - cost units, not dollars */
export const PLANNING_DOLLARS_BY_COST_CLASS = COST_UNITS_BY_CLASS;
/** @deprecated alias - cost units, not dollars */
export const HOUSEHOLD_PLANNING_DOLLARS = HOUSEHOLD_COST_UNITS;

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

/** Unit span for the class - not a dollar range. */
export const COST_CLASS_RANGE: Record<BudgetClass, { min: number; max: number }> =
  {
    zero: { min: 0, max: 0 },
    low: { min: 0, max: 1 },
    moderate: { min: 1, max: 2 },
    flexible: { min: 2, max: 3 },
  };

export function costUnitsForClass(costClass: BudgetClass): number {
  return COST_UNITS_BY_CLASS[costClass];
}

/** @deprecated use costUnitsForClass */
export function planningDollarsForCostClass(costClass: BudgetClass): number {
  return costUnitsForClass(costClass);
}

/**
 * Unknown household budget is not treated as flexible - cap at low (1 unit).
 */
export function costUnitsForHousehold(
  budgetClass: Unknownable<BudgetClass>,
): number {
  if (isUnknown(budgetClass)) return HOUSEHOLD_COST_UNITS.low;
  return HOUSEHOLD_COST_UNITS[budgetClass];
}

/** @deprecated use costUnitsForHousehold */
export function planningDollarsForHousehold(
  budgetClass: Unknownable<BudgetClass>,
): number {
  return costUnitsForHousehold(budgetClass);
}

/**
 * Map a session cap onto discrete units.
 * Values 0–3 are already units. Larger numbers are treated as legacy
 * planning-dollar aliases (0 / ≤50 / ≤150 / more), never as prices.
 */
export function toCostUnits(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return 0;
  if (value <= 3) return Math.floor(value);
  if (value <= 50) return 1;
  if (value <= 150) return 2;
  return 3;
}

export function labelForCostUnits(units: number | null): string {
  if (units === null) return "unconstrained";
  if (units <= 0) return "no-cost";
  if (units === 1) return "low-cost";
  if (units === 2) return "moderate-cost";
  return "higher-cost";
}

export function planningMinutesFor(
  category: RecommendationCategory,
  horizon: RecommendationHorizon,
): number {
  if (horizon === "before_next_event") return PLANNING_MINUTES_BEFORE_NEXT_EVENT;
  if (horizon === "long_term") return PLANNING_MINUTES_LONG_TERM;
  return NOW_MINUTES_BY_CATEGORY[category];
}

export const PLANNING_ASSUMPTION_DISCLAIMER =
  "Cost classes are discrete ranking units (no-cost / low / moderate / higher), not contractor prices. Preparedness utility is not a safety or survival percentage.";
