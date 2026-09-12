import { UNKNOWN, emptyGeocodedLocation } from "@/types";
import type {
  ActiveHazard,
  HazardKind,
  HazardSeverity,
  HazardState,
  HazardUrgency,
  HomeProfile,
  HouseholdProfile,
} from "@/types";

const OBSERVED_AT = "2026-09-12T12:00:00.000Z";

function hazard(input: {
  id: string;
  kind: HazardKind;
  headline: string;
  severity: HazardSeverity;
  urgency?: HazardUrgency;
  instruction?: string;
  nwsEventId?: string;
}): ActiveHazard {
  return {
    id: input.id,
    kind: input.kind,
    headline: input.headline,
    severity: input.severity,
    urgency: input.urgency ?? "expected",
    onsetAt: OBSERVED_AT,
    endsAt: UNKNOWN,
    nwsEventId: input.nwsEventId ?? input.id,
    instruction: input.instruction ?? UNKNOWN,
    provenance: "external_source",
  };
}

/** Judging / quiet-weather fallback — confirmed all-clear, not an unchecked empty list. */
export const TAMPA_QUIET_WEATHER: HazardState = {
  observedAt: OBSERVED_AT,
  locationLabel: "Tampa, FL (Hillsborough)",
  hazards: [],
  allClear: true,
  provenance: "external_source",
};

export const TAMPA_HURRICANE_WATCH: HazardState = {
  observedAt: OBSERVED_AT,
  locationLabel: "Tampa, FL (Hillsborough)",
  hazards: [
    hazard({
      id: "nws-tbw-hur-watch",
      kind: "hurricane",
      headline: "Hurricane Watch issued for Hillsborough County",
      severity: "watch",
      urgency: "future",
      instruction:
        "Prepare to take action. Review your evacuation zone and gather supplies.",
      nwsEventId: "https://api.weather.gov/alerts/urn:oid:demo.tampa.hurricane.watch",
    }),
  ],
  allClear: false,
  provenance: "external_source",
};

export const TAMPA_EVACUATION_WARNING: HazardState = {
  observedAt: OBSERVED_AT,
  locationLabel: "Tampa, FL (Hillsborough)",
  hazards: [
    hazard({
      id: "nws-tbw-hur-warning",
      kind: "hurricane",
      headline: "Hurricane Warning and Evacuation Order for coastal Hillsborough",
      severity: "warning",
      urgency: "immediate",
      instruction:
        "Evacuate Zone A now. Do not remain in manufactured housing or surge-prone areas.",
      nwsEventId: "https://api.weather.gov/alerts/urn:oid:demo.tampa.hurricane.warning",
    }),
  ],
  allClear: false,
  provenance: "external_source",
};

export const TAMPA_FLOOD_WARNING: HazardState = {
  observedAt: OBSERVED_AT,
  locationLabel: "Tampa, FL (Hillsborough)",
  hazards: [
    hazard({
      id: "nws-tbw-flood-warning",
      kind: "flash_flood",
      headline: "Flash Flood Warning for Hillsborough County",
      severity: "warning",
      urgency: "immediate",
      instruction: "Move to higher ground. Do not drive through flood waters.",
      nwsEventId: "https://api.weather.gov/alerts/urn:oid:demo.tampa.flash.flood",
    }),
  ],
  allClear: false,
  provenance: "external_source",
};

export const TAMPA_DEMO_HOME: HomeProfile = {
  id: "fixture-tampa-home",
  createdAt: OBSERVED_AT,
  updatedAt: OBSERVED_AT,
  addressLine: "4202 E Fowler Ave",
  city: "Tampa",
  state: "FL",
  postalCode: "33620",
  location: {
    ...emptyGeocodedLocation(),
    latitude: 28.0587,
    longitude: -82.4139,
    county: "Hillsborough",
    nwsForecastOffice: "TBW",
    nwsForecastZone: "FLZ050",
    nwsCountyZone: "FLC057",
    provenance: "external_source",
  },
  addressProvenance: "user_reported",
  dwellingType: "single_family",
  stories: 1,
  yearBuilt: 1998,
  construction: "wood_frame",
  floodZone: UNKNOWN,
  elevationFeet: UNKNOWN,
  hasBasement: false,
  hasSafeInteriorRoom: UNKNOWN,
  hasHurricaneShutters: false,
  hasBackupPower: false,
  backupPowerType: UNKNOWN,
  hasWellWater: false,
  hasSeptic: false,
  roofAgeYears: UNKNOWN,
  notes: "Tampa demo household for quiet-weather judging.",
  attributesProvenance: "user_reported",
};

export const TAMPA_DEMO_HOUSEHOLD: HouseholdProfile = {
  id: "fixture-tampa-household",
  createdAt: OBSERVED_AT,
  updatedAt: OBSERVED_AT,
  occupantCount: 3,
  infantsCount: 0,
  childrenCount: 1,
  adultsCount: 2,
  seniorsCount: 0,
  hasPregnancy: false,
  hasMobilityNeeds: false,
  mobilityAids: UNKNOWN,
  hasSensoryOrCognitiveNeeds: false,
  hasPowerDependentMedicalDevice: false,
  hasPrescriptionMedications: true,
  petCount: 1,
  petTypes: ["dog"],
  vehicleCount: 1,
  canSelfEvacuate: true,
  preferredLanguage: "en",
  budgetClass: "low",
  notes: "One school-age child, one dog, low budget class.",
  provenance: "user_reported",
};

export type DemoScenario = "quiet" | "watch" | "warning" | "evac" | "flood";

export function hazardFixtureFor(scenario: DemoScenario): HazardState {
  switch (scenario) {
    case "watch":
      return TAMPA_HURRICANE_WATCH;
    case "warning":
    case "evac":
      return TAMPA_EVACUATION_WARNING;
    case "flood":
      return TAMPA_FLOOD_WARNING;
    case "quiet":
    default:
      return TAMPA_QUIET_WEATHER;
  }
}

export function tampaDemoInput(scenario: DemoScenario = "quiet") {
  return {
    home: TAMPA_DEMO_HOME,
    household: TAMPA_DEMO_HOUSEHOLD,
    hazards: hazardFixtureFor(scenario),
    hazardSource: "fixture" as const,
  };
}
