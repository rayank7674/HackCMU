import { isUnknown, type BudgetClass, type Unknownable } from "@/types";

export const BUDGET_CLASSES = [
  "zero",
  "low",
  "moderate",
  "flexible",
] as const satisfies readonly BudgetClass[];

const BUDGET_RANK: Record<BudgetClass, number> = {
  zero: 0,
  low: 1,
  moderate: 2,
  flexible: 3,
};

/** Human label - classes only, never a dollar figure. */
export function budgetLabel(budgetClass: BudgetClass): string {
  switch (budgetClass) {
    case "zero":
      return "no-cost";
    case "low":
      return "low-cost";
    case "moderate":
      return "moderate-cost";
    case "flexible":
      return "higher-cost";
  }
}

export function budgetRank(budgetClass: BudgetClass): number {
  return BUDGET_RANK[budgetClass];
}

/**
 * Unknown household budget is not treated as flexible. Prefer no-cost and
 * low-cost actions until the class is known.
 */
export function actionFitsBudget(
  costClass: BudgetClass,
  householdBudget: Unknownable<BudgetClass>,
): boolean {
  if (isUnknown(householdBudget)) {
    return costClass === "zero" || costClass === "low";
  }
  return BUDGET_RANK[costClass] <= BUDGET_RANK[householdBudget];
}

export function isLowestBudgetClass(
  householdBudget: Unknownable<BudgetClass>,
): boolean {
  return householdBudget === "zero";
}
