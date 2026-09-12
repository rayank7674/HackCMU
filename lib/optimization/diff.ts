import type { OptimizationDiff, OptimizationResult } from "./types";

function summarize(diff: Omit<OptimizationDiff, "summary">): string {
  const bits: string[] = [];
  if (diff.addedIds.length > 0) {
    bits.push(`Added ${diff.addedIds.join(", ")}`);
  }
  if (diff.removedIds.length > 0) {
    bits.push(`Removed ${diff.removedIds.join(", ")}`);
  }
  const budget = diff.constraintChanges.budgetDollars;
  if (budget.from !== budget.to) {
    bits.push(
      `Budget ${formatCap(budget.from)} → ${formatCap(budget.to)}`,
    );
  }
  const time = diff.constraintChanges.availableTimeMinutes;
  if (time.from !== time.to) {
    bits.push(`Time ${formatCap(time.from, "min")} → ${formatCap(time.to, "min")}`);
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

function formatCap(value: number | null, suffix = ""): string {
  if (value === null) return "unconstrained";
  return suffix ? `${value} ${suffix}` : `$${value}`;
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

  const diff: OptimizationDiff = {
    addedIds,
    removedIds,
    reordered,
    beforeIds: [...before.selectedIds],
    afterIds: [...after.selectedIds],
    constraintChanges: {
      budgetDollars: {
        from: before.constraintsUsed.budgetDollars,
        to: after.constraintsUsed.budgetDollars,
      },
      availableTimeMinutes: {
        from: before.constraintsUsed.availableTimeMinutes,
        to: after.constraintsUsed.availableTimeMinutes,
      },
      transport: {
        from: before.constraintsUsed.transport,
        to: after.constraintsUsed.transport,
      },
    },
    planningCostDelta: after.planningCostDollars - before.planningCostDollars,
    planningMinutesDelta: after.planningMinutes - before.planningMinutes,
    summary: "",
  };
  diff.summary = summarize(diff);
  return diff;
}
