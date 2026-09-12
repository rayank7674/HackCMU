import { labelForCostUnits } from "./planning-values";
import type { OptimizationDiff, OptimizationResult } from "./types";

function summarize(diff: Omit<OptimizationDiff, "summary">): string {
  const bits: string[] = [];
  if (diff.addedTitles.length > 0) {
    bits.push(`Added ${diff.addedTitles.join(", ")}`);
  }
  if (diff.removedTitles.length > 0) {
    bits.push(`Removed ${diff.removedTitles.join(", ")}`);
  }
  if (diff.promotedTitles.length > 0) {
    bits.push(`Promoted ${diff.promotedTitles.join(", ")}`);
  }
  if (diff.demotedTitles.length > 0) {
    bits.push(`Demoted ${diff.demotedTitles.join(", ")}`);
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

function sameIdSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const set = new Set(left);
  return right.every((id) => set.has(id));
}

/**
 * Human title for a selected / candidate id. Falls back to the id only
 * when neither list has a title — UI should not dump raw rule ids first.
 */
export function titleForOptimizationId(
  result: OptimizationResult,
  id: string,
): string {
  const selected = result.selected.find((item) => item.id === id);
  if (selected && selected.title.trim() !== "") return selected.title;
  const candidate = result.candidates.find((item) => item.id === id);
  if (candidate && candidate.title.trim() !== "") return candidate.title;
  return id;
}

export function titlesForOptimizationIds(
  results: OptimizationResult[],
  ids: string[],
): string[] {
  return ids.map((id) => {
    for (const result of results) {
      const title = titleForOptimizationId(result, id);
      if (title !== id) return title;
    }
    return id;
  });
}

export function diffOptimizationResults(
  before: OptimizationResult,
  after: OptimizationResult,
): OptimizationDiff {
  const beforeSet = new Set(before.selectedIds);
  const afterSet = new Set(after.selectedIds);
  const addedIds = after.selectedIds.filter((id) => !beforeSet.has(id));
  const removedIds = before.selectedIds.filter((id) => !afterSet.has(id));
  const sharedIds = after.selectedIds.filter((id) => beforeSet.has(id));
  const promotedIds = sharedIds.filter((id) => {
    const beforeRank = before.selectedIds.indexOf(id);
    const afterRank = after.selectedIds.indexOf(id);
    return afterRank < beforeRank;
  });
  const demotedIds = sharedIds.filter((id) => {
    const beforeRank = before.selectedIds.indexOf(id);
    const afterRank = after.selectedIds.indexOf(id);
    return afterRank > beforeRank;
  });
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

  const sources = [after, before];
  const diff: OptimizationDiff = {
    addedIds,
    removedIds,
    promotedIds,
    demotedIds,
    addedTitles: titlesForOptimizationIds(sources, addedIds),
    removedTitles: titlesForOptimizationIds(sources, removedIds),
    promotedTitles: titlesForOptimizationIds(sources, promotedIds),
    demotedTitles: titlesForOptimizationIds(sources, demotedIds),
    reordered,
    hardConstraintsUnchanged: sameIdSet(
      before.hardConstraintIds,
      after.hardConstraintIds,
    ),
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
