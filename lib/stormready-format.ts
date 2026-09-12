import {
  UNKNOWN,
  isKnown,
  type BackupPowerType,
  type ConstructionType,
  type DwellingType,
  type HazardSeverity,
  type HomeProfile,
  type HouseholdProfile,
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

export type ImmediateBudget =
  | "prefer_free"
  | "under_50"
  | "50_to_200"
  | "200_plus";

export const BUDGET_OPTIONS: { value: ImmediateBudget; label: string }[] = [
  { value: "prefer_free", label: "Prefer $0 / free options" },
  { value: "under_50", label: "Under $50" },
  { value: "50_to_200", label: "$50–200" },
  { value: "200_plus", label: "$200 or more" },
];

const BUDGET_PREFIX = "Immediate budget: ";

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

export function formatHorizon(
  timeframe: Unknownable<RecommendationTimeframe>,
  horizon?: Unknownable<string>,
): string | null {
  if (horizon && isKnown(horizon)) return horizon;
  if (!isKnown(timeframe)) return null;
  switch (timeframe) {
    case "now":
      return "Now";
    case "before_event":
      return "Before the event";
    case "during_event":
      return "During the event";
    case "after_event":
      return "After the event";
    default:
      return null;
  }
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
    bits.push("mobility needs");
  }
  if (isKnown(household.petCount) && household.petCount > 0) {
    bits.push(
      `${household.petCount} ${household.petCount === 1 ? "pet" : "pets"}`,
    );
  }
  const budget = readBudgetFromNotes(household.notes);
  if (isKnown(budget)) {
    const label = BUDGET_OPTIONS.find((option) => option.value === budget)?.label;
    if (label) bits.push(label);
  }
  return bits.length > 0 ? bits.join(" · ") : "Household details not added yet.";
}

export function readBudgetFromNotes(
  notes: Unknownable<string>,
): Unknownable<ImmediateBudget> {
  if (!isKnown(notes)) return UNKNOWN;
  const match = notes
    .split("\n")
    .find((line) => line.startsWith(BUDGET_PREFIX));
  if (!match) return UNKNOWN;
  const label = match.slice(BUDGET_PREFIX.length).trim();
  const found = BUDGET_OPTIONS.find((option) => option.label === label);
  return found?.value ?? UNKNOWN;
}

export function writeBudgetToNotes(
  notes: Unknownable<string>,
  budget: Unknownable<ImmediateBudget>,
): Unknownable<string> {
  const existing = isKnown(notes)
    ? notes
        .split("\n")
        .filter((line) => !line.startsWith(BUDGET_PREFIX))
        .join("\n")
        .trim()
    : "";
  if (!isKnown(budget)) {
    return existing === "" ? UNKNOWN : existing;
  }
  const label = BUDGET_OPTIONS.find((option) => option.value === budget)?.label;
  if (!label) return existing === "" ? UNKNOWN : existing;
  const line = `${BUDGET_PREFIX}${label}`;
  return existing === "" ? line : `${existing}\n${line}`;
}

export const SEVERITY_RANK: Record<HazardSeverity, number> = {
  emergency: 4,
  warning: 3,
  watch: 2,
  advisory: 1,
  unknown: 0,
};
