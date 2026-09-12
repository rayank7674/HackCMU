import { isKnown, isUnknown } from "@/types";
import type { HazardKind, HomeProfile, HouseholdProfile } from "@/types";
import type { RuleContext, RuleMatch } from "@/lib/rules/types";
import {
  COST_CLASS_RANGE,
  planningDollarsForCostClass,
  planningMinutesFor,
} from "./planning-values";
import type { PreparednessAction } from "./types";

const PRIORITY_URGENCY: Record<RuleMatch["priority"], number> = {
  critical: 1,
  high: 0.8,
  medium: 0.5,
  low: 0.25,
};

const HORIZON_URGENCY: Record<RuleMatch["horizon"], number> = {
  now: 1,
  before_next_event: 0.65,
  long_term: 0.35,
};

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function textBlob(match: RuleMatch): string {
  return `${match.ruleId} ${match.title} ${match.body} ${match.rationale}`.toLowerCase();
}

export function isHardConstraint(match: Pick<RuleMatch, "official" | "category">): boolean {
  return match.official || match.category === "evacuate";
}

/**
 * Buying/acquiring a generator. Quiet-weather "skip buying" outage plans are not this.
 */
export function isGeneratorAcquisition(match: RuleMatch): boolean {
  const text = textBlob(match);
  if (/skip buying a generator/.test(text)) return false;
  return (
    /generator/.test(text) &&
    /(buy|purchase|acquire|shop for|get a generator)/.test(text)
  );
}

export function isTransportReadiness(match: RuleMatch): boolean {
  const text = textBlob(match);
  return (
    match.ruleId.includes("access_evac") ||
    match.ruleId.includes("ready_to_go") ||
    /two ways out|park the car|fuel the vehicle|accessible transport|without a car|evacuation route|request accessible/.test(
      text,
    )
  );
}

export function requiresTransportation(match: RuleMatch): boolean {
  return match.category === "evacuate";
}

function scoreUrgency(match: RuleMatch): number {
  if (match.official) return 1;
  return clamp01(
    0.7 * PRIORITY_URGENCY[match.priority] + 0.3 * HORIZON_URGENCY[match.horizon],
  );
}

function scoreHazardRelevance(match: RuleMatch, ctx: RuleContext): number {
  const active = ctx.hazards.hazards.map((hazard) => hazard.kind);
  if (ctx.hazards.allClear === true && active.length === 0) {
    return match.horizon === "long_term" ? 0.4 : 0.5;
  }
  if (active.length === 0) return 0.25;
  const wanted = new Set<HazardKind>(match.hazardKinds);
  if (active.some((kind) => wanted.has(kind))) return 1;
  return 0.25;
}

/**
 * Unknown roof is not an old roof. Unknown backup power is not "none".
 */
function scoreHouseholdFit(match: RuleMatch, ctx: RuleContext): number {
  const home: HomeProfile = ctx.home;
  const household: HouseholdProfile = ctx.household;
  let fit = 0.45;
  const id = match.ruleId;

  if (id.includes("old_roof")) {
    fit = isKnown(home.roofAgeYears) && home.roofAgeYears >= 15 ? 0.9 : 0.2;
  } else if (id.includes("unknown_roof")) {
    fit = isUnknown(home.roofAgeYears) ? 0.85 : 0.25;
  }

  if (isGeneratorAcquisition(match)) {
    if (home.hasBackupPower === true) fit = 0.05;
    else if (isUnknown(home.hasBackupPower)) fit = 0.4;
    else if (home.hasBackupPower === false) fit = 0.85;
  } else if (match.category === "power") {
    if (home.hasBackupPower === true) fit = Math.min(fit, 0.2);
    else if (isUnknown(home.hasBackupPower)) fit += 0.15;
    else if (home.hasBackupPower === false) fit += 0.25;
  }

  if (match.category === "pets") {
    if (isKnown(household.petCount) && household.petCount > 0) fit += 0.25;
    else if (isUnknown(household.petCount)) fit += 0.15;
  }

  if (match.category === "medical") {
    if (
      household.hasPrescriptionMedications === true ||
      household.hasPowerDependentMedicalDevice === true
    ) {
      fit += 0.25;
    } else if (
      isUnknown(household.hasPrescriptionMedications) ||
      isUnknown(household.hasPowerDependentMedicalDevice)
    ) {
      fit += 0.12;
    }
  }

  if (match.category === "evacuate" || id.includes("access_evac")) {
    if (
      household.hasMobilityNeeds === true ||
      household.canSelfEvacuate === false
    ) {
      fit += 0.2;
    }
  }

  if (match.official) fit = Math.max(fit, 0.85);

  return clamp01(fit);
}

export function toPreparednessAction(
  match: RuleMatch,
  ctx: RuleContext,
): PreparednessAction {
  const urgency = scoreUrgency(match);
  const hazardRelevance = scoreHazardRelevance(match, ctx);
  const householdFit = scoreHouseholdFit(match, ctx);
  const utility = clamp01(0.4 * urgency + 0.3 * hazardRelevance + 0.3 * householdFit);
  const costClass = match.costClass;

  return {
    id: match.ruleId,
    ruleId: match.ruleId,
    title: match.title,
    body: match.body,
    rationale: match.rationale,
    priority: match.priority,
    category: match.category,
    hazardKinds: match.hazardKinds,
    horizon: match.horizon,
    official: match.official,
    hardConstraint: isHardConstraint(match),
    costClass,
    estimatedCostDollars: planningDollarsForCostClass(costClass),
    estimatedTimeMinutes: planningMinutesFor(match.category, match.horizon),
    estimatedCostRange: COST_CLASS_RANGE[costClass],
    costEstimateSource: "planning_assumption",
    costEstimateConfidence: "low",
    utility,
    urgency,
    hazardRelevance,
    householdFit,
    requiresTransportation: requiresTransportation(match),
    generatorAcquisition: isGeneratorAcquisition(match),
    transportReadiness: isTransportReadiness(match),
    constraintEffects: [],
  };
}

export function toPreparednessActions(
  matches: RuleMatch[],
  ctx: RuleContext,
): PreparednessAction[] {
  return [...matches]
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId))
    .map((match) => toPreparednessAction(match, ctx));
}
