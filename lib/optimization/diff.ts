import { labelForCostUnits } from "./planning-values";
import type { OptimizationDiff, OptimizationResult } from "./types";

function summarize(diff: Omit<OptimizationDiff, "summary">): string {
  const bits: string[] = [];
  if (diff.addedIds.length > 0) {
    bits.push(`Added ${diff.addedIds.join(", ")}`);
  }
  if (diff.removedIds.length > 0) {
    bits.push(`Removed ${diff.removedIds.join(", ")}`);
  }
  const budget = diff.constraintChanges.budgetUnits;
  if (budget.from !== budget.to) {
    bits.push(
      `Cost class ${labelForCostUnits(budget.from)} → ${labelForCostUnits(budget.to)}`,
    );
  }
  const time = diff.constraintChanges.availableTimeMinutes;
  if (time.from !== time.to) {
    bits.push(`Time ${formatTime(time.from)} → ${formatTime(time.to)}`);
  }
  const transport = diff.constraintChanges.transport;
  if (transport.from !== transport.to) {
    bits.push(`Transport ${transport.from} → ${transport.to}`);
  }
  if (bits.length === 0 && diff.reordered) {
    bits.push("Same actions, different order");
  }
  if (bits.length === 0) {
    return "No change";
  }
  return bits.join(". ") + ".";
}

function formatTime(value: number | null): string {
  if (value === null) return "unconstrained";
  return `${value} min`;
}

export function diffOptimizationResults(
  before: OptimizationResult,
  after: OptimizationResult,
): OptimizationDiff {
  const beforeSet = new Set(before.selectedIds);
  const afterSet = new Set(after.selectedIds);
  const addedIds = after.selectedIds.filter((id) => !beforeSet.has(id));
  const removedIds = before.selectedIds.filter((id) => !afterSet.has(id));
  const sameMembers =
    addedIds.length === 0 &&
    removedIds.length === 0 &&
    before.selectedIds.length === after.selectedIds.length;
  const reordered =
    sameMembers &&
    before.selectedIds.some((id, index) => after.selectedIds[index] !== id);

  const fromUnits =
    before.constraintsUsed.budgetUnits ??
    before.constraintsUsed.budgetDollars ??
    null;
  const toUnits =
    after.constraintsUsed.budgetUnits ?? after.constraintsUsed.budgetDollars ?? null;

  const diff: OptimizationDiff = {
    addedIds,
    removedIds,
    reordered,
    beforeIds: [...before.selectedIds],
    afterIds: [...after.selectedIds],
    constraintChanges: {
      budgetUnits: { from: fromUnits, to: toUnits },
      budgetDollars: { from: fromUnits, to: toUnits },
      availableTimeMinutes: {
        from: before.constraintsUsed.availableTimeMinutes,
        to: after.constraintsUsed.availableTimeMinutes,
      },
      transport: {
        from: before.constraintsUsed.transport,
        to: after.constraintsUsed.transport,
      },
    },
    planningCostDelta: after.planningCostUnits - before.planningCostUnits,
    planningMinutesDelta: after.planningMinutes - before.planningMinutes,
    summary: "",
  };
  diff.summary = summarize(diff);
  return diff;
}

