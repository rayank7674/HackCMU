import type { RecommendationPriority } from "@/types";
import type { PreparednessAction } from "@/lib/optimization/types";
import { actionFitsBudget } from "./budget";
import type { RankedRecommendation } from "./types";
import type { RuleContext, RuleMatch } from "../rules/types";
import type { RecommendationHorizon } from "@/types";

const PRIORITY_WEIGHT: Record<RecommendationPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const HORIZON_WEIGHT: Record<RecommendationHorizon, number> = {
  now: 3,
  before_next_event: 2,
  long_term: 1,
};

export const MIN_SURFACED = 3;
export const MAX_SURFACED = 5;

function compareMatches(
  a: RuleMatch,
  b: RuleMatch,
  ctx: RuleContext,
): number {
  // Official evacuation/warning always outranks discretionary prep.
  if (a.official !== b.official) return a.official ? -1 : 1;

  const priority = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  if (priority !== 0) return priority;

  const horizon = HORIZON_WEIGHT[b.horizon] - HORIZON_WEIGHT[a.horizon];
  if (horizon !== 0) return horizon;

  const aFits = actionFitsBudget(a.costClass, ctx.household.budgetClass);
  const bFits = actionFitsBudget(b.costClass, ctx.household.budgetClass);
  if (aFits !== bFits) return aFits ? -1 : 1;

  return a.ruleId.localeCompare(b.ruleId);
}

export function sortMatches(
  matches: RuleMatch[],
  ctx: RuleContext,
): RuleMatch[] {
  return [...matches].sort((a, b) => compareMatches(a, b, ctx));
}

/**
 * Keep 3–5 actions. Official matches are never dropped to make room for
 * discretionary ones. Over-budget discretionary matches fill only if we
 * would otherwise surface fewer than MIN_SURFACED.
 */
export function selectTopMatches(
  matches: RuleMatch[],
  ctx: RuleContext,
): RuleMatch[] {
  const sorted = sortMatches(matches, ctx);
  const official = sorted.filter((match) => match.official);
  const discretionary = sorted.filter((match) => !match.official);

  const inBudget = discretionary.filter((match) =>
    actionFitsBudget(match.costClass, ctx.household.budgetClass),
  );
  const overBudget = discretionary.filter(
    (match) => !actionFitsBudget(match.costClass, ctx.household.budgetClass),
  );

  const picked: RuleMatch[] = [];
  for (const match of official) {
    if (picked.length >= MAX_SURFACED) break;
    picked.push(match);
  }
  for (const match of inBudget) {
    if (picked.length >= MAX_SURFACED) break;
    picked.push(match);
  }
  if (picked.length < MIN_SURFACED) {
    for (const match of overBudget) {
      if (picked.length >= MAX_SURFACED) break;
      picked.push(match);
    }
  }

  return picked.slice(0, MAX_SURFACED);
}

export function toRankedRecommendation(match: RuleMatch): RankedRecommendation {
  return {
    id: match.ruleId,
    title: match.title,
    body: match.body,
    priority: match.priority,
    category: match.category,
    hazardKinds: match.hazardKinds,
    ruleId: match.ruleId,
    rationale: match.rationale,
    timeframe: match.horizon,
    provenance: match.official ? "external_source" : "user_reported",
    horizon: match.horizon,
    official: match.official,
    costClass: match.costClass,
  };
}

export function toRankedRecommendationFromAction(
  action: PreparednessAction,
): RankedRecommendation {
  return {
    id: action.id,
    title: action.title,
    body: action.body,
    priority: action.priority,
    category: action.category,
    hazardKinds: action.hazardKinds,
    ruleId: action.ruleId,
    rationale: action.rationale,
    timeframe: action.horizon,
    provenance: action.official ? "external_source" : "user_reported",
    horizon: action.horizon,
    official: action.official,
    costClass: action.costClass,
    hardConstraint: action.hardConstraint,
    estimatedTimeMinutes: action.estimatedTimeMinutes,
    estimatedCostRange: action.estimatedCostRange,
    utilityScore: action.utility,
    hazardRelevance: action.hazardRelevance,
    householdFit: action.householdFit,
    urgency: action.urgency,
    costEstimateSource: action.costEstimateSource,
    costEstimateConfidence: action.costEstimateConfidence,
    constraintEffects: action.constraintEffects,
  };
}
