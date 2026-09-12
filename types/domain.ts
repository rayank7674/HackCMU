/**
 * StormReady domain contract.
 *
 * This file is the source of truth for profile, hazard, and recommendation
 * shapes. Adapters (geocode, NWS), the rules engine, and UI should import
 * these types instead of declaring parallel models.
 *
 * Unknown semantics
 * -----------------
 * `"unknown"` means "not confirmed" — not "no", not "none", not "absent".
 * Never coerce `unknown` to `false`, `0`, `""`, `[]`, or `null` in a way
 * that a later reader would treat as a confirmed negative. A household
 * with `hasBackupPower: "unknown"` must not be scored as if they have no
 * generator. An empty `hazards` list is only an all-clear when
 * `allClear === true`.
 */

/** How a field or record was obtained. */
export type Provenance = "user_reported" | "external_source" | "unknown";

export const UNKNOWN = "unknown" as const;
export type Unknown = typeof UNKNOWN;

/**
 * A value that may still be unanswered. Prefer this over optional/`null`
 * for facts the rules engine must not treat as confirmed-absent.
 */
export type Unknownable<T> = T | Unknown;

export function isUnknown(value: unknown): value is Unknown {
  return value === UNKNOWN;
}

export function isKnown<T>(value: Unknownable<T>): value is T {
  return value !== UNKNOWN;
}

export type DwellingType =
  | "single_family"
  | "townhouse"
  | "apartment"
  | "mobile_home"
  | "manufactured_home"
  | "other";

export type ConstructionType =
  | "wood_frame"
  | "masonry"
  | "concrete"
  | "steel"
  | "other";

export type BackupPowerType =
  | "portable_generator"
  | "standby_generator"
  | "battery"
  | "solar_battery"
  | "other";

export type PetType = "dog" | "cat" | "bird" | "fish" | "other";

/** Mobility aids / constraints collected when hasMobilityNeeds is yes. */
export type MobilityAid =
  | "wheelchair"
  | "crutches_or_walker"
  | "transfer_help"
  | "elevator";

/**
 * Household spending capacity for preparedness. Classes only — never invent
 * dollar amounts. `"unknown"` is not "flexible"; prefer no-cost / low-cost.
 */
export type BudgetClass = "zero" | "low" | "moderate" | "flexible";

/**
 * Geocode / NWS location fields written back onto the home profile.
 * All start as `"unknown"` until an adapter fills them. Persist on
 * HomeProfile rather than inventing a second location type.
 */
export type GeocodedLocation = {
  latitude: Unknownable<number>;
  longitude: Unknownable<number>;
  county: Unknownable<string>;
  /** NWS forecast office id, e.g. "TBW". */
  nwsForecastOffice: Unknownable<string>;
  nwsForecastZone: Unknownable<string>;
  nwsCountyZone: Unknownable<string>;
  provenance: Provenance;
};

/** Physical residence the household is planning for. */
export type HomeProfile = {
  id: string;
  createdAt: string;
  updatedAt: string;

  /** Free-text address as entered by the user (not yet geocoded). */
  addressLine: Unknownable<string>;
  city: Unknownable<string>;
  state: Unknownable<string>;
  postalCode: Unknownable<string>;
  location: GeocodedLocation;
  /** Provenance for the user-entered address fields. */
  addressProvenance: Provenance;

  dwellingType: Unknownable<DwellingType>;
  stories: Unknownable<number>;
  yearBuilt: Unknownable<number>;
  construction: Unknownable<ConstructionType>;
  /** FEMA/NWS flood zone code when known; `"unknown"` if never looked up. */
  floodZone: Unknownable<string>;
  elevationFeet: Unknownable<number>;
  hasBasement: Unknownable<boolean>;
  hasSafeInteriorRoom: Unknownable<boolean>;
  hasHurricaneShutters: Unknownable<boolean>;
  /**
   * Whether the home has any backup power. `"unknown"` is not `false` —
   * do not assume they lack a generator.
   */
  hasBackupPower: Unknownable<boolean>;
  backupPowerType: Unknownable<BackupPowerType>;
  hasWellWater: Unknownable<boolean>;
  hasSeptic: Unknownable<boolean>;
  /**
   * Age of the current roof in years. `"unknown"` is not "new" or "fine" —
   * the rules engine must treat an unknown roof as a vulnerability to check.
   */
  roofAgeYears: Unknownable<number>;
  notes: Unknownable<string>;
  attributesProvenance: Provenance;
};

/** People, pets, and access needs that change the plan. */
export type HouseholdProfile = {
  id: string;
  createdAt: string;
  updatedAt: string;

  /**
   * Confirmed occupant counts. `0` means none; `"unknown"` means the
   * question was skipped. Do not treat unknown as zero.
   */
  occupantCount: Unknownable<number>;
  infantsCount: Unknownable<number>;
  childrenCount: Unknownable<number>;
  adultsCount: Unknownable<number>;
  seniorsCount: Unknownable<number>;

  hasPregnancy: Unknownable<boolean>;
  hasMobilityNeeds: Unknownable<boolean>;
  /**
   * Follow-ups when hasMobilityNeeds is true. `"unknown"` means the follow-up
   * was skipped; `[]` means none of the listed aids apply.
   */
  mobilityAids: Unknownable<MobilityAid[]>;
  hasSensoryOrCognitiveNeeds: Unknownable<boolean>;
  hasPowerDependentMedicalDevice: Unknownable<boolean>;
  hasPrescriptionMedications: Unknownable<boolean>;

  petCount: Unknownable<number>;
  petTypes: Unknownable<PetType[]>;

  vehicleCount: Unknownable<number>;
  canSelfEvacuate: Unknownable<boolean>;
  preferredLanguage: Unknownable<string>;
  /** Spending class for ranking. `"unknown"` is not treated as flexible. */
  budgetClass: Unknownable<BudgetClass>;
  notes: Unknownable<string>;
  provenance: Provenance;
};

export type HazardKind =
  | "hurricane"
  | "tropical_storm"
  | "storm_surge"
  | "flood"
  | "flash_flood"
  | "tornado"
  | "severe_thunderstorm"
  | "extreme_heat"
  | "extreme_cold"
  | "winter_storm"
  | "wind"
  | "wildfire"
  | "rip_current"
  | "other";

export type HazardSeverity =
  | "advisory"
  | "watch"
  | "warning"
  | "emergency"
  | "unknown";

export type HazardUrgency = "immediate" | "expected" | "future" | "past";

/** A single NWS (or user-reported) active product. */
export type ActiveHazard = {
  id: string;
  kind: HazardKind;
  headline: string;
  severity: HazardSeverity;
  urgency: Unknownable<HazardUrgency>;
  onsetAt: Unknownable<string>;
  endsAt: Unknownable<string>;
  nwsEventId: Unknownable<string>;
  instruction: Unknownable<string>;
  provenance: Provenance;
};

/**
 * Current hazard picture for the home's location.
 * Not persisted by the Phase 1 profile store — adapters/rules own that.
 */
export type HazardState = {
  observedAt: string;
  locationLabel: Unknownable<string>;
  hazards: ActiveHazard[];
  /**
   * `true` only after an adapter confirmed there are no active products.
   * `"unknown"` means we have not checked (an empty `hazards` array is
   * then *not* an all-clear). `false` means at least one hazard is active.
   */
  allClear: Unknownable<boolean>;
  provenance: Provenance;
};

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export type RecommendationCategory =
  | "evacuate"
  | "shelter"
  | "supplies"
  | "medical"
  | "pets"
  | "power"
  | "water"
  | "communication"
  | "documents"
  | "other";

/**
 * When the household should act. The Phase 1 engine surfaces
 * `now` | `before_next_event` | `long_term`. The other values remain
 * valid for later phases.
 */
export type RecommendationTimeframe =
  | "now"
  | "before_event"
  | "before_next_event"
  | "during_event"
  | "after_event"
  | "long_term";

/** Horizons the Phase 1 engine is allowed to surface. */
export type RecommendationHorizon =
  | "now"
  | "before_next_event"
  | "long_term";

/**
 * Deterministic rule output. Not persisted by the Phase 1 profile store.
 */
export type Recommendation = {
  id: string;
  title: string;
  body: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  hazardKinds: HazardKind[];
  ruleId: Unknownable<string>;
  rationale: Unknownable<string>;
  timeframe: Unknownable<RecommendationTimeframe>;
  provenance: Provenance;
};

/**
 * Convenience composition for rules/UI. Not a storage document —
 * home + household live in localStorage; hazards + recs are derived.
 */
export type StormReadySnapshot = {
  home: HomeProfile | null;
  household: HouseholdProfile | null;
  hazards: HazardState | null;
  recommendations: Recommendation[];
};

export function emptyGeocodedLocation(): GeocodedLocation {
  return {
    latitude: UNKNOWN,
    longitude: UNKNOWN,
    county: UNKNOWN,
    nwsForecastOffice: UNKNOWN,
    nwsForecastZone: UNKNOWN,
    nwsCountyZone: UNKNOWN,
    provenance: UNKNOWN,
  };
}
