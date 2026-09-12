import {
  UNKNOWN,
  createEmptyHomeProfile,
  createEmptyHouseholdProfile,
} from "@/lib/stormready";
import type {
  ActiveHazard,
  HazardKind,
  HazardSeverity,
  HazardState,
  HazardUrgency,
  HomeProfile,
  HouseholdProfile,
} from "@/types";

export function makeHazard(input: {
  id?: string;
  kind: HazardKind;
  headline?: string;
  severity: HazardSeverity;
  urgency?: HazardUrgency;
  instruction?: string;
}): ActiveHazard {
  return {
    id: input.id ?? `hazard-${input.kind}-${input.severity}`,
    kind: input.kind,
    headline: input.headline ?? `${input.kind} ${input.severity}`,
    severity: input.severity,
    urgency: input.urgency ?? "expected",
    onsetAt: "2026-09-12T12:00:00.000Z",
    endsAt: UNKNOWN,
    nwsEventId: input.id ?? UNKNOWN,
    instruction: input.instruction ?? UNKNOWN,
    provenance: "external_source",
  };
}

export function makeHazards(
  hazards: ActiveHazard[],
  allClear: HazardState["allClear"] = hazards.length === 0,
): HazardState {
  return {
    observedAt: "2026-09-12T12:00:00.000Z",
    locationLabel: "Test location",
    hazards,
    allClear,
    provenance: "external_source",
  };
}

export function allClearHazards(): HazardState {
  return makeHazards([], true);
}

export function makeHome(overrides: Partial<HomeProfile> = {}): HomeProfile {
  return createEmptyHomeProfile({
    state: "FL",
    city: "Tampa",
    dwellingType: "single_family",
    ...overrides,
  });
}

export function makeHousehold(
  overrides: Partial<HouseholdProfile> = {},
): HouseholdProfile {
  return createEmptyHouseholdProfile(overrides);
}
