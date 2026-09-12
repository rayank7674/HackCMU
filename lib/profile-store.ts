import {
  UNKNOWN,
  emptyGeocodedLocation,
  type BackupPowerType,
  type BudgetClass,
  type ConstructionType,
  type DwellingType,
  type GeocodedLocation,
  type HomeProfile,
  type HouseholdProfile,
  type MobilityAid,
  type PetType,
  type Provenance,
  type Unknownable,
} from "../types";

/**
 * Anonymous localStorage profile store (no auth).
 *
 * Account strategy: this module is the anonymous local store only. Cloud
 * save/restore lives in lib/supabase/persist.ts and /api/save-plan. Do not
 * write profiles to the network from this module.
 *
 * Unknown semantics: load/save never turn `"unknown"` into `false`, `0`,
 * `""`, or `[]`. Missing or blank keys become `"unknown"` so unanswered
 * questions stay unanswered. Confirmed negatives (`false`, `0`) are kept.
 */

export const PROFILE_STORE_VERSION = 1 as const;
export const PROFILE_STORAGE_KEY = "stormready:profile:v1";

export type PersistedProfile = {
  version: typeof PROFILE_STORE_VERSION;
  home: HomeProfile | null;
  household: HouseholdProfile | null;
  updatedAt: string | null;
};

export function emptyPersistedProfile(): PersistedProfile {
  return {
    version: PROFILE_STORE_VERSION,
    home: null,
    household: null,
    updatedAt: null,
  };
}

export function createEmptyHomeProfile(
  overrides: Partial<HomeProfile> = {},
): HomeProfile {
  const now = nowIso();
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    addressLine: UNKNOWN,
    city: UNKNOWN,
    state: UNKNOWN,
    postalCode: UNKNOWN,
    location: emptyGeocodedLocation(),
    addressProvenance: "user_reported",
    dwellingType: UNKNOWN,
    stories: UNKNOWN,
    yearBuilt: UNKNOWN,
    construction: UNKNOWN,
    floodZone: UNKNOWN,
    elevationFeet: UNKNOWN,
    hasBasement: UNKNOWN,
    hasSafeInteriorRoom: UNKNOWN,
    hasHurricaneShutters: UNKNOWN,
    hasBackupPower: UNKNOWN,
    backupPowerType: UNKNOWN,
    hasWellWater: UNKNOWN,
    hasSeptic: UNKNOWN,
    roofAgeYears: UNKNOWN,
    notes: UNKNOWN,
    attributesProvenance: "user_reported",
    ...overrides,
  };
}

export function createEmptyHouseholdProfile(
  overrides: Partial<HouseholdProfile> = {},
): HouseholdProfile {
  const now = nowIso();
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    occupantCount: UNKNOWN,
    infantsCount: UNKNOWN,
    childrenCount: UNKNOWN,
    adultsCount: UNKNOWN,
    seniorsCount: UNKNOWN,
    hasPregnancy: UNKNOWN,
    hasMobilityNeeds: UNKNOWN,
    mobilityAids: UNKNOWN,
    hasSensoryOrCognitiveNeeds: UNKNOWN,
    hasPowerDependentMedicalDevice: UNKNOWN,
    hasPrescriptionMedications: UNKNOWN,
    petCount: UNKNOWN,
    petTypes: UNKNOWN,
    vehicleCount: UNKNOWN,
    canSelfEvacuate: UNKNOWN,
    preferredLanguage: UNKNOWN,
    budgetClass: UNKNOWN,
    notes: UNKNOWN,
    provenance: "user_reported",
    ...overrides,
  };
}

/** SSR-safe: false during prerender / Node. */
export function canUseProfileStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function loadProfile(): PersistedProfile {
  if (!canUseProfileStorage()) {
    return emptyPersistedProfile();
  }

  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return emptyPersistedProfile();
    return parsePersistedProfile(JSON.parse(raw));
  } catch {
    return emptyPersistedProfile();
  }
}

export function saveHomeProfile(home: HomeProfile): PersistedProfile {
  const current = loadProfile();
  return persist({
    ...current,
    home: normalizeHomeProfile({ ...home, updatedAt: nowIso() }),
    updatedAt: nowIso(),
  });
}

export function saveHouseholdProfile(
  household: HouseholdProfile,
): PersistedProfile {
  const current = loadProfile();
  return persist({
    ...current,
    household: normalizeHouseholdProfile({
      ...household,
      updatedAt: nowIso(),
    }),
    updatedAt: nowIso(),
  });
}

export function saveProfile(input: {
  home?: HomeProfile | null;
  household?: HouseholdProfile | null;
}): PersistedProfile {
  const current = loadProfile();
  const next: PersistedProfile = {
    version: PROFILE_STORE_VERSION,
    home:
      input.home === undefined
        ? current.home
        : input.home === null
          ? null
          : normalizeHomeProfile({ ...input.home, updatedAt: nowIso() }),
    household:
      input.household === undefined
        ? current.household
        : input.household === null
          ? null
          : normalizeHouseholdProfile({
              ...input.household,
              updatedAt: nowIso(),
            }),
    updatedAt: nowIso(),
  };
  return persist(next);
}

export function clearProfile(): PersistedProfile {
  const empty = emptyPersistedProfile();
  if (canUseProfileStorage()) {
    try {
      window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    } catch {
      // Private mode / disabled storage — treat as cleared.
    }
  }
  return empty;
}

export function hasStoredProfile(): boolean {
  const profile = loadProfile();
  return profile.home !== null || profile.household !== null;
}

/** Restore a cloud snapshot without treating it as a fresh local edit. */
export function restoreProfile(input: {
  home?: HomeProfile | null;
  household?: HouseholdProfile | null;
  updatedAt?: string | null;
}): PersistedProfile {
  return persist({
    version: PROFILE_STORE_VERSION,
    home: input.home ? normalizeHomeProfile(input.home) : null,
    household: input.household
      ? normalizeHouseholdProfile(input.household)
      : null,
    updatedAt: input.updatedAt ?? nowIso(),
  });
}

function persist(profile: PersistedProfile): PersistedProfile {
  const normalized: PersistedProfile = {
    version: PROFILE_STORE_VERSION,
    home: profile.home ? normalizeHomeProfile(profile.home) : null,
    household: profile.household
      ? normalizeHouseholdProfile(profile.household)
      : null,
    updatedAt: profile.updatedAt ?? nowIso(),
  };

  if (!canUseProfileStorage()) {
    return normalized;
  }

  try {
    window.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  } catch {
    // Quota or privacy errors must not throw into UI / RSC.
  }

  return normalized;
}

function parsePersistedProfile(value: unknown): PersistedProfile {
  if (!isRecord(value) || value.version !== PROFILE_STORE_VERSION) {
    return emptyPersistedProfile();
  }

  return {
    version: PROFILE_STORE_VERSION,
    home: isRecord(value.home) ? normalizeHomeProfile(value.home) : null,
    household: isRecord(value.household)
      ? normalizeHouseholdProfile(value.household)
      : null,
    updatedAt: readIso(value.updatedAt),
  };
}

export function hydrateHomeProfile(value: unknown): HomeProfile | null {
  return isRecord(value) ? normalizeHomeProfile(value) : null;
}

export function hydrateHouseholdProfile(value: unknown): HouseholdProfile | null {
  return isRecord(value) ? normalizeHouseholdProfile(value) : null;
}

export function normalizeHomeProfile(value: Record<string, unknown> | HomeProfile): HomeProfile {
  const now = nowIso();
  const locationSource = isRecord(value.location) ? value.location : {};

  return {
    id: readId(value.id),
    createdAt: readIso(value.createdAt) ?? now,
    updatedAt: readIso(value.updatedAt) ?? now,
    addressLine: readUnknownableString(value.addressLine),
    city: readUnknownableString(value.city),
    state: readUnknownableString(value.state),
    postalCode: readUnknownableString(value.postalCode),
    location: normalizeLocation(locationSource),
    addressProvenance: readProvenance(value.addressProvenance),
    dwellingType: readLiteral(value.dwellingType, DWELLING_TYPES),
    stories: readUnknownableNumber(value.stories),
    yearBuilt: readUnknownableNumber(value.yearBuilt),
    construction: readLiteral(value.construction, CONSTRUCTION_TYPES),
    floodZone: readUnknownableString(value.floodZone),
    elevationFeet: readUnknownableNumber(value.elevationFeet),
    hasBasement: readUnknownableBoolean(value.hasBasement),
    hasSafeInteriorRoom: readUnknownableBoolean(value.hasSafeInteriorRoom),
    hasHurricaneShutters: readUnknownableBoolean(value.hasHurricaneShutters),
    hasBackupPower: readUnknownableBoolean(value.hasBackupPower),
    backupPowerType: readLiteral(value.backupPowerType, BACKUP_POWER_TYPES),
    hasWellWater: readUnknownableBoolean(value.hasWellWater),
    hasSeptic: readUnknownableBoolean(value.hasSeptic),
    roofAgeYears: readUnknownableNumber(value.roofAgeYears),
    notes: readUnknownableString(value.notes),
    attributesProvenance: readProvenance(value.attributesProvenance),
  };
}

export function normalizeHouseholdProfile(
  value: Record<string, unknown> | HouseholdProfile,
): HouseholdProfile {
  const now = nowIso();
  return {
    id: readId(value.id),
    createdAt: readIso(value.createdAt) ?? now,
    updatedAt: readIso(value.updatedAt) ?? now,
    occupantCount: readUnknownableNumber(value.occupantCount),
    infantsCount: readUnknownableNumber(value.infantsCount),
    childrenCount: readUnknownableNumber(value.childrenCount),
    adultsCount: readUnknownableNumber(value.adultsCount),
    seniorsCount: readUnknownableNumber(value.seniorsCount),
    hasPregnancy: readUnknownableBoolean(value.hasPregnancy),
    hasMobilityNeeds: readUnknownableBoolean(value.hasMobilityNeeds),
    mobilityAids: readMobilityAids(value.mobilityAids),
    hasSensoryOrCognitiveNeeds: readUnknownableBoolean(
      value.hasSensoryOrCognitiveNeeds,
    ),
    hasPowerDependentMedicalDevice: readUnknownableBoolean(
      value.hasPowerDependentMedicalDevice,
    ),
    hasPrescriptionMedications: readUnknownableBoolean(
      value.hasPrescriptionMedications,
    ),
    petCount: readUnknownableNumber(value.petCount),
    petTypes: readPetTypes(value.petTypes),
    vehicleCount: readUnknownableNumber(value.vehicleCount),
    canSelfEvacuate: readUnknownableBoolean(value.canSelfEvacuate),
    preferredLanguage: readUnknownableString(value.preferredLanguage),
    budgetClass: readLiteral(value.budgetClass, BUDGET_CLASSES),
    notes: readUnknownableString(value.notes),
    provenance: readProvenance(value.provenance),
  };
}

function normalizeLocation(value: Record<string, unknown>): GeocodedLocation {
  return {
    latitude: readUnknownableNumber(value.latitude),
    longitude: readUnknownableNumber(value.longitude),
    county: readUnknownableString(value.county),
    nwsForecastOffice: readUnknownableString(value.nwsForecastOffice),
    nwsForecastZone: readUnknownableString(value.nwsForecastZone),
    nwsCountyZone: readUnknownableString(value.nwsCountyZone),
    provenance: readProvenance(value.provenance, UNKNOWN),
  };
}

const DWELLING_TYPES = [
  "single_family",
  "townhouse",
  "apartment",
  "mobile_home",
  "manufactured_home",
  "other",
] as const satisfies readonly DwellingType[];

const CONSTRUCTION_TYPES = [
  "wood_frame",
  "masonry",
  "concrete",
  "steel",
  "other",
] as const satisfies readonly ConstructionType[];

const BACKUP_POWER_TYPES = [
  "portable_generator",
  "standby_generator",
  "battery",
  "solar_battery",
  "other",
] as const satisfies readonly BackupPowerType[];

const PET_TYPES = [
  "dog",
  "cat",
  "bird",
  "fish",
  "other",
] as const satisfies readonly PetType[];

const MOBILITY_AIDS = [
  "wheelchair",
  "crutches_or_walker",
  "transfer_help",
  "elevator",
] as const satisfies readonly MobilityAid[];

const BUDGET_CLASSES = [
  "zero",
  "low",
  "moderate",
  "flexible",
] as const satisfies readonly BudgetClass[];

const PROVENANCE_VALUES = [
  "user_reported",
  "external_source",
  "unknown",
] as const satisfies readonly Provenance[];

function readUnknownableString(value: unknown): Unknownable<string> {
  if (value === UNKNOWN || value === undefined || value === null) {
    return UNKNOWN;
  }
  if (typeof value === "string") {
    return value.trim() === "" ? UNKNOWN : value;
  }
  return UNKNOWN;
}

function readUnknownableNumber(value: unknown): Unknownable<number> {
  if (value === UNKNOWN || value === undefined || value === null || value === "") {
    return UNKNOWN;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return UNKNOWN;
}

function readUnknownableBoolean(value: unknown): Unknownable<boolean> {
  if (value === true || value === false) return value;
  return UNKNOWN;
}

function readLiteral<T extends string>(
  value: unknown,
  allowed: readonly T[],
): Unknownable<T> {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return UNKNOWN;
}

function readPetTypes(value: unknown): Unknownable<PetType[]> {
  if (value === UNKNOWN || value === undefined || value === null) {
    return UNKNOWN;
  }
  if (!Array.isArray(value)) return UNKNOWN;
  const pets = value.filter((item): item is PetType =>
    PET_TYPES.includes(item as PetType),
  );
  // A parsed empty array means "confirmed no listed types" only when the
  // source actually stored []. Keep that distinct from unknown.
  return pets;
}

function readMobilityAids(value: unknown): Unknownable<MobilityAid[]> {
  if (value === UNKNOWN || value === undefined || value === null) {
    return UNKNOWN;
  }
  if (!Array.isArray(value)) return UNKNOWN;
  return value.filter((item): item is MobilityAid =>
    MOBILITY_AIDS.includes(item as MobilityAid),
  );
}

function readProvenance(
  value: unknown,
  fallback: Provenance = "user_reported",
): Provenance {
  if (
    typeof value === "string" &&
    (PROVENANCE_VALUES as readonly string[]).includes(value)
  ) {
    return value as Provenance;
  }
  return fallback;
}

function readId(value: unknown): string {
  return typeof value === "string" && value.trim() !== "" ? value : newId();
}

function readIso(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
