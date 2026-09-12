import {
  actionFitsBudget,
  isKnown,
  type BackupPowerType,
  type BudgetClass,
  type ConstructionType,
  type DwellingType,
  type HazardSeverity,
  type HomeProfile,
  type HouseholdProfile,
  type RecommendationHorizon,
  type RecommendationPriority,
  type RecommendationTimeframe,
  type Unknownable,
} from "@/lib/stormready";

export const ONBOARDING_PROGRESS_KEY = "stormready:onboarding:v1";

export const inputClassName =
  "h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/25";

export const DWELLING_OPTIONS: { value: DwellingType; label: string }[] = [
  { value: "single_family", label: "Single-family" },
  { value: "townhouse", label: "Townhouse" },
  { value: "apartment", label: "Apartment" },
  { value: "mobile_home", label: "Mobile home" },
  { value: "manufactured_home", label: "Manufactured" },
  { value: "other", label: "Other" },
];

export const CONSTRUCTION_OPTIONS: { value: ConstructionType; label: string }[] =
  [
    { value: "wood_frame", label: "Wood frame" },
    { value: "masonry", label: "Masonry" },
    { value: "concrete", label: "Concrete" },
    { value: "steel", label: "Steel" },
    { value: "other", label: "Other" },
  ];

export const BACKUP_POWER_OPTIONS: { value: BackupPowerType; label: string }[] =
  [
    { value: "portable_generator", label: "Portable generator" },
    { value: "standby_generator", label: "Standby generator" },
    { value: "battery", label: "Battery" },
    { value: "solar_battery", label: "Solar + battery" },
    { value: "other", label: "Other" },
  ];

export const BUDGET_OPTIONS: { value: BudgetClass; label: string }[] = [
  { value: "zero", label: "Prefer $0 / free options" },
  { value: "low", label: "Under $50" },
  { value: "moderate", label: "$50–200" },
  { value: "flexible", label: "$200 or more" },
];

export function formatLocation(home: HomeProfile | null): string {
  if (!home) return "Location not set";
  const parts = [home.addressLine, home.city, home.state, home.postalCode].filter(
    isKnown,
  );
  return parts.length > 0 ? parts.join(", ") : "Location not set";
}

export function formatDwelling(value: Unknownable<DwellingType>): string {
  if (!isKnown(value)) return "Not specified";
  return DWELLING_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Not yet updated";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not yet updated";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatSeverity(value: HazardSeverity): string {
  if (value === "unknown") return "Unconfirmed";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatPriority(value: RecommendationPriority): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Qualitative cost class only — never a dollar figure or exact price. */
export function formatCostClass(value: string): string {
  switch (value) {
    case "zero":
      return "No cost";
    case "low":
      return "Low cost";
    case "moderate":
      return "Moderate cost";
    case "flexible":
      return "Higher cost";
    default:
      return value;
  }
}

export const PLAN_HORIZONS = [
  "now",
  "before_next_event",
  "long_term",
] as const satisfies readonly RecommendationHorizon[];

export const PLAN_HORIZON_LABELS: Record<RecommendationHorizon, string> = {
  now: "Now",
  before_next_event: "Before the next event",
  long_term: "Long term",
};

const COST_RANK: Record<BudgetClass, number> = {
  zero: 0,
  low: 1,
  moderate: 2,
  flexible: 3,
};

export function asBudgetClass(value: unknown): BudgetClass | null {
  if (
    value === "zero" ||
    value === "low" ||
    value === "moderate" ||
    value === "flexible"
  ) {
    return value;
  }
  return null;
}

export function resolvePlanHorizon(
  timeframe: Unknownable<RecommendationTimeframe>,
  horizon?: Unknownable<string>,
): RecommendationHorizon {
  for (const value of [horizon, timeframe]) {
    if (value === "now" || value === "during_event") return "now";
    if (value === "before_next_event" || value === "before_event") {
      return "before_next_event";
    }
    if (value === "long_term" || value === "after_event") return "long_term";
  }
  return "before_next_event";
}

export function formatHorizon(
  timeframe: Unknownable<RecommendationTimeframe>,
  horizon?: Unknownable<string>,
): string | null {
  const raw =
    horizon && isKnown(horizon)
      ? horizon
      : isKnown(timeframe)
        ? timeframe
        : null;
  if (!raw) return null;
  return PLAN_HORIZON_LABELS[resolvePlanHorizon(timeframe, raw)];
}

export type PlanActionLike = {
  timeframe: Unknownable<RecommendationTimeframe>;
  horizon?: Unknownable<string>;
  costClass?: Unknownable<string>;
};

export type HorizonGroup<T extends PlanActionLike> = {
  horizon: RecommendationHorizon;
  label: string;
  items: T[];
};

export function sortActionsByBudget<T extends PlanActionLike>(
  actions: T[],
  householdBudget: Unknownable<BudgetClass>,
): T[] {
  return [...actions].sort((a, b) => {
    const aCost = asBudgetClass(a.costClass);
    const bCost = asBudgetClass(b.costClass);
    const aFits = aCost ? actionFitsBudget(aCost, householdBudget) : false;
    const bFits = bCost ? actionFitsBudget(bCost, householdBudget) : false;
    if (aFits !== bFits) return aFits ? -1 : 1;
    const aRank = aCost ? COST_RANK[aCost] : 99;
    const bRank = bCost ? COST_RANK[bCost] : 99;
    return aRank - bRank;
  });
}

/** Group 3–5 plan actions under now / before_next_event / long_term.
 * Preserves incoming (optimizer) order within each horizon.
 * `householdBudget` is unused; kept for call-site compatibility.
 */
export function arrangePlanActions<T extends PlanActionLike>(
  actions: T[],
  householdBudget: Unknownable<BudgetClass>,
): HorizonGroup<T>[] {
  void householdBudget;
  const buckets: Record<RecommendationHorizon, T[]> = {
    now: [],
    before_next_event: [],
    long_term: [],
  };

  for (const action of actions) {
    buckets[resolvePlanHorizon(action.timeframe, action.horizon)].push(action);
  }

  return PLAN_HORIZONS.flatMap((horizon) => {
    const items = buckets[horizon];
    if (items.length === 0) return [];
    return [{ horizon, label: PLAN_HORIZON_LABELS[horizon], items }];
  });
}

export function budgetFitLabel(
  costClass: Unknownable<string> | undefined,
  householdBudget: Unknownable<BudgetClass>,
): "Fits budget" | "Above budget" | null {
  const cost = asBudgetClass(costClass);
  if (!cost || !isKnown(householdBudget)) return null;
  return actionFitsBudget(cost, householdBudget)
    ? "Fits budget"
    : "Above budget";
}

export function shortReason(
  rationale: Unknownable<string>,
  body: string,
): string | null {
  const source = isKnown(rationale) ? rationale : body;
  if (!source.trim()) return null;
  const sentence = source.trim().split(/(?<=[.!?])\s+/)[0] ?? source.trim();
  return sentence.length > 140 ? `${sentence.slice(0, 137)}…` : sentence;
}

export function householdSummary(household: HouseholdProfile | null): string {
  if (!household) return "Household details not added yet.";
  const bits: string[] = [];
  if (isKnown(household.occupantCount)) {
    bits.push(
      `${household.occupantCount} ${household.occupantCount === 1 ? "person" : "people"}`,
    );
  }
  if (household.hasPowerDependentMedicalDevice === true) {
    bits.push("power-dependent medical device");
  }
  if (household.hasMobilityNeeds === true) {
    if (Array.isArray(household.mobilityAids) && household.mobilityAids.length > 0) {
      bits.push(
        household.mobilityAids
          .map((aid) =>
            aid === "wheelchair"
              ? "wheelchair"
              : aid === "crutches_or_walker"
                ? "crutches/walker"
                : aid === "transfer_help"
                  ? "transfer help"
                  : "elevator-dependent",
          )
          .join(", "),
      );
    } else {
      bits.push("mobility needs");
    }
  }
  if (isKnown(household.petCount) && household.petCount > 0) {
    bits.push(
      `${household.petCount} ${household.petCount === 1 ? "pet" : "pets"}`,
    );
  }
  if (isKnown(household.budgetClass)) {
    const label = BUDGET_OPTIONS.find(
      (option) => option.value === household.budgetClass,
    )?.label;
    if (label) bits.push(label);
  }
  return bits.length > 0 ? bits.join(" · ") : "Household details not added yet.";
}

export const SEVERITY_RANK: Record<HazardSeverity, number> = {
  emergency: 4,
  warning: 3,
  watch: 2,
  advisory: 1,
  unknown: 0,
};
