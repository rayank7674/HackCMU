import { MAX_SURFACED, MIN_SURFACED } from "@/lib/recommendations/ranking";
import type { RecommendationPriority } from "@/types";
import { PLANNING_ASSUMPTION_DISCLAIMER, toCostUnits } from "./planning-values";
import type {
  ConstraintEffect,
  OptimizationConstraints,
  OptimizationResult,
  PreparednessAction,
  RejectedAction,
  RejectionReason,
} from "./types";

const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const UTIL_SCALE = 10_000;
const TRANSPORT_READINESS_BOOST = 0.2;

function costUnits(action: PreparednessAction): number {
  return action.estimatedCostUnits ?? action.estimatedCostDollars;
}

function budgetCapOf(constraints: OptimizationConstraints): number | null {
  return toCostUnits(
    constraints.budgetUnits !== undefined && constraints.budgetUnits !== null
      ? constraints.budgetUnits
      : constraints.budgetDollars,
  );
}

function cloneAction(action: PreparednessAction): PreparednessAction {
  const units = costUnits(action);
  return {
    ...action,
    estimatedCostUnits: units,
    estimatedCostDollars: units,
    hazardKinds: [...action.hazardKinds],
    constraintEffects: [...action.constraintEffects],
    estimatedCostRange: { ...action.estimatedCostRange },
  };
}

function addEffect(action: PreparednessAction, effect: ConstraintEffect): void {
  if (!action.constraintEffects.includes(effect)) {
    action.constraintEffects.push(effect);
  }
}

function compareHard(a: PreparednessAction, b: PreparednessAction): number {
  const priority = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (priority !== 0) return priority;
  if (a.official !== b.official) return a.official ? -1 : 1;
  const aHousehold = a.ruleId.startsWith("household.") ? 1 : 0;
  const bHousehold = b.ruleId.startsWith("household.") ? 1 : 0;
  if (aHousehold !== bHousehold) return aHousehold - bHousehold;
  return a.ruleId.localeCompare(b.ruleId);
}

function compareUtility(a: PreparednessAction, b: PreparednessAction): number {
  if (b.utility !== a.utility) return b.utility - a.utility;
  return a.ruleId.localeCompare(b.ruleId);
}

function scaledUtility(action: PreparednessAction): number {
  return Math.round(action.utility * UTIL_SCALE);
}

function packState(k: number, b: number, t: number): string {
  return `${k}:${b}:${t}`;
}

function unpackState(state: string): { k: number; b: number; t: number } {
  const [k, b, t] = state.split(":").map(Number);
  return { k, b, t };
}

/**
 * Exact 0/1 knapsack over remaining budget, time, and cardinality.
 * Unconstrained dimensions are treated as zero-weight.
 */
type KnapsackCell = {
  util: number;
  picks: number[];
};

function knapsackSelect(
  items: PreparednessAction[],
  budgetCap: number | null,
  timeCap: number | null,
  maxItems: number,
): PreparednessAction[] {
  if (items.length === 0 || maxItems <= 0) return [];

  const budgetLimited = budgetCap !== null;
  const timeLimited = timeCap !== null;

  if (!budgetLimited && !timeLimited) {
    return [...items].sort(compareUtility).slice(0, maxItems);
  }

  const B = budgetLimited ? Math.max(0, Math.floor(budgetCap)) : 0;
  const T = timeLimited ? Math.max(0, Math.floor(timeCap)) : 0;
  const K = Math.max(0, maxItems);

  const costOf = (item: PreparednessAction) =>
    budgetLimited ? costUnits(item) : 0;
  const timeOf = (item: PreparednessAction) =>
    timeLimited ? item.estimatedTimeMinutes : 0;

  const ordered = [...items].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  let states = new Map<string, KnapsackCell>();
  states.set(packState(0, 0, 0), { util: 0, picks: [] });

  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];
    const c = costOf(item);
    const tm = timeOf(item);
    const u = scaledUtility(item);
    if (c > B || tm > T) continue;

    const next = new Map(states);
    for (const [state, cell] of states) {
      const { k, b, t } = unpackState(state);
      if (k >= K) continue;
      const nextB = b + c;
      const nextT = t + tm;
      if (nextB > B || nextT > T) continue;
      const nextKey = packState(k + 1, nextB, nextT);
      const nextUtil = cell.util + u;
      const existing = next.get(nextKey);
      if (existing === undefined || nextUtil > existing.util) {
        next.set(nextKey, { util: nextUtil, picks: [...cell.picks, i] });
      }
    }
    states = next;
  }

  let best: KnapsackCell = { util: 0, picks: [] };
  for (const cell of states.values()) {
    if (cell.util > best.util) best = cell;
  }

  return [...new Set(best.picks)]
    .map((index) => ordered[index])
    .sort(compareUtility);
}

function actionFitsRemaining(
  action: PreparednessAction,
  leftoverBudget: number | null,
  leftoverTime: number | null,
): boolean {
  if (leftoverBudget !== null && costUnits(action) > leftoverBudget) {
    return false;
  }
  if (leftoverTime !== null && action.estimatedTimeMinutes > leftoverTime) {
    return false;
  }
  return true;
}

export function optimizePreparednessPlan(
  candidates: PreparednessAction[],
  constraints: OptimizationConstraints,
  options: { hasBackupPower: boolean },
): OptimizationResult {
  const working = candidates.map(cloneAction);
  const rejected = new Map<string, RejectionReason[]>();

  const markRejected = (action: PreparednessAction, reason: RejectionReason) => {
    const list = rejected.get(action.id) ?? [];
    if (!list.includes(reason)) list.push(reason);
    rejected.set(action.id, list);
  };

  const eligible: PreparednessAction[] = [];

  for (const action of working) {
    if (options.hasBackupPower === true && action.generatorAcquisition) {
      addEffect(action, "skipped_backup_power");
      markRejected(action, "skipped_backup_power");
      continue;
    }

    const noCar =
      constraints.transport === "none" || constraints.transport === "limited";

    if (noCar && action.transportReadiness) {
      action.utility = Math.min(1, action.utility + TRANSPORT_READINESS_BOOST);
      addEffect(action, "boosted_transport_readiness");
    }

    if (
      noCar &&
      action.requiresTransportation &&
      !action.hardConstraint
    ) {
      addEffect(action, "excluded_transport");
      markRejected(action, "excluded_transport");
      continue;
    }

    eligible.push(action);
  }

  const hard = eligible
    .filter((action) => action.hardConstraint)
    .sort(compareHard);
  const discretionary = eligible
    .filter((action) => !action.hardConstraint)
    .sort(compareUtility);

  const selectedHard: PreparednessAction[] = [];
  for (const action of hard) {
    addEffect(action, "hard_constraint");
    selectedHard.push(action);
  }

  const hardCost = selectedHard.reduce(
    (sum, action) => sum + costUnits(action),
    0,
  );
  const hardTime = selectedHard.reduce(
    (sum, action) => sum + action.estimatedTimeMinutes,
    0,
  );

  const budgetCap = budgetCapOf(constraints);
  const leftoverBudget =
    budgetCap === null ? null : Math.max(0, budgetCap - hardCost);
  const leftoverTime =
    constraints.availableTimeMinutes === null
      ? null
      : Math.max(0, constraints.availableTimeMinutes - hardTime);

  const hardKept =
    selectedHard.length > MAX_SURFACED
      ? selectedHard.slice(0, MAX_SURFACED)
      : selectedHard;
  for (const extra of selectedHard.slice(MAX_SURFACED)) {
    markRejected(extra, "over_surface_limit");
  }

  const slots = Math.max(0, MAX_SURFACED - hardKept.length);
  const knapsackPicks = knapsackSelect(
    discretionary,
    leftoverBudget,
    leftoverTime,
    slots,
  );

  let remainingBudget = leftoverBudget;
  let remainingTime = leftoverTime;
  const selectedDisc: PreparednessAction[] = [];

  const consume = (action: PreparednessAction) => {
    if (selectedDisc.some((item) => item.id === action.id)) return;
    selectedDisc.push(action);
    if (remainingBudget !== null) {
      remainingBudget = Math.max(0, remainingBudget - costUnits(action));
    }
    if (remainingTime !== null) {
      remainingTime = Math.max(0, remainingTime - action.estimatedTimeMinutes);
    }
    addEffect(action, "fits_remaining_budget");
    addEffect(action, "fits_remaining_time");
  };

  for (const action of knapsackPicks) {
    if (hardKept.length + selectedDisc.length >= MAX_SURFACED) break;
    if (!actionFitsRemaining(action, remainingBudget, remainingTime)) {
      if (remainingBudget !== null && costUnits(action) > remainingBudget) {
        markRejected(action, "over_budget");
      }
      if (
        remainingTime !== null &&
        action.estimatedTimeMinutes > remainingTime
      ) {
        markRejected(action, "over_time");
      }
      continue;
    }
    consume(action);
  }

  const pickedIds = new Set([
    ...hardKept.map((action) => action.id),
    ...selectedDisc.map((action) => action.id),
  ]);

  if (hardKept.length + selectedDisc.length < MIN_SURFACED) {
    const fillers = discretionary
      .filter((action) => !pickedIds.has(action.id))
      .sort(compareUtility);

    for (const action of fillers) {
      if (hardKept.length + selectedDisc.length >= MIN_SURFACED) break;
      if (hardKept.length + selectedDisc.length >= MAX_SURFACED) break;
      if (!actionFitsRemaining(action, remainingBudget, remainingTime)) {
        continue;
      }
      if (remainingBudget === 0 && costUnits(action) > 0) {
        continue;
      }
      addEffect(action, "fill_to_minimum");
      consume(action);
      pickedIds.add(action.id);
    }
  }

  const selected = [...hardKept, ...selectedDisc.sort(compareUtility)];

  for (const action of discretionary) {
    if (pickedIds.has(action.id)) continue;
    const reasons: RejectionReason[] = [];
    if (!actionFitsRemaining(action, leftoverBudget, leftoverTime)) {
      if (leftoverBudget !== null && costUnits(action) > leftoverBudget) {
        reasons.push("over_budget");
      }
      if (leftoverTime !== null && action.estimatedTimeMinutes > leftoverTime) {
        reasons.push("over_time");
      }
    }
    if (reasons.length === 0) reasons.push("not_selected");
    for (const reason of reasons) markRejected(action, reason);
  }

  const rejectedList: RejectedAction[] = [...rejected.entries()]
    .map(([id, reasons]) => {
      const action = working.find((item) => item.id === id);
      return {
        id,
        ruleId: action?.ruleId ?? id,
        reasons,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const planningCostUnits = selected.reduce(
    (sum, action) => sum + costUnits(action),
    0,
  );
  const shortfall =
    selected.length < MIN_SURFACED
      ? `Only ${selected.length} action${selected.length === 1 ? "" : "s"} fit the remaining cost-class and time capacity. Official and evacuate actions are still included.`
      : null;

  const resolvedConstraints: OptimizationConstraints = {
    ...constraints,
    budgetUnits: budgetCap,
    budgetDollars: budgetCap,
  };

  return {
    solver: "knapsack_dp",
    objective: "maximize_preparedness_utility",
    selected,
    selectedIds: selected.map((action) => action.id),
    rejected: rejectedList,
    candidates: working
      .slice()
      .sort((a, b) => a.ruleId.localeCompare(b.ruleId))
      .map((action) => ({
        id: action.id,
        ruleId: action.ruleId,
        title: action.title,
        hardConstraint: action.hardConstraint,
        official: action.official,
        selected: pickedIds.has(action.id),
        utility: action.utility,
        estimatedCostUnits: costUnits(action),
        estimatedCostDollars: costUnits(action),
        estimatedTimeMinutes: action.estimatedTimeMinutes,
      })),
    hardConstraintIds: hardKept.map((action) => action.id),
    constraintsUsed: resolvedConstraints,
    planningCostUnits,
    planningCostDollars: planningCostUnits,
    planningMinutes: selected.reduce(
      (sum, action) => sum + action.estimatedTimeMinutes,
      0,
    ),
    hardCount: hardKept.length,
    discretionaryCount: selected.filter((action) => !action.hardConstraint).length,
    notes: [
      PLANNING_ASSUMPTION_DISCLAIMER,
      ...(shortfall ? [shortfall] : []),
    ],
    shortfall,
  };
}
