import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthIdentity } from "@/lib/auth/identity";
import {
  hydrateHomeProfile,
  hydrateHouseholdProfile,
  saveProfile,
} from "@/lib/profile-store";
import type { PersistedProfile } from "@/lib/profile-store";
import {
  UNKNOWN,
  type HazardState,
  type HomeProfile,
  type HouseholdProfile,
  type Provenance,
  type Recommendation,
  type StormReadySnapshot,
} from "@/types";
import type {
  Database,
  GeneratedRecommendationRow,
  HomeProfileRow,
  HouseholdProfileRow,
  Json,
} from "./database.types";

export type StormReadyPersistClient = SupabaseClient<Database>;

export type PersistFailure = {
  ok: false;
  error: string;
  message: string;
};

export type SaveSnapshotResult = {
  ok: true;
  userId: string;
  snapshot: StormReadySnapshot;
};

export type LoadSnapshotResult = {
  ok: true;
  snapshot: StormReadySnapshot | null;
};

const PROVENANCE: readonly Provenance[] = [
  "user_reported",
  "external_source",
  "unknown",
];

export function toUnknownableText(value: unknown): string {
  if (value === UNKNOWN || value === undefined || value === null) {
    return UNKNOWN;
  }
  if (typeof value === "string") {
    return value.trim() === "" ? UNKNOWN : value;
  }
  return UNKNOWN;
}

export function toUnknownableJson(value: unknown): Json {
  if (value === UNKNOWN || value === undefined || value === null) {
    return UNKNOWN;
  }
  return value as Json;
}

export function homeProfileToRow(
  userId: string,
  home: HomeProfile,
): HomeProfileRow {
  return {
    user_id: userId,
    id: home.id,
    created_at: home.createdAt,
    updated_at: home.updatedAt,
    address_line: toUnknownableText(home.addressLine),
    city: toUnknownableText(home.city),
    state: toUnknownableText(home.state),
    postal_code: toUnknownableText(home.postalCode),
    location: toUnknownableJson(home.location),
    address_provenance: home.addressProvenance,
    dwelling_type: toUnknownableText(home.dwellingType),
    stories: toUnknownableJson(home.stories),
    year_built: toUnknownableJson(home.yearBuilt),
    construction: toUnknownableText(home.construction),
    flood_zone: toUnknownableText(home.floodZone),
    elevation_feet: toUnknownableJson(home.elevationFeet),
    has_basement: toUnknownableJson(home.hasBasement),
    has_safe_interior_room: toUnknownableJson(home.hasSafeInteriorRoom),
    has_hurricane_shutters: toUnknownableJson(home.hasHurricaneShutters),
    has_backup_power: toUnknownableJson(home.hasBackupPower),
    backup_power_type: toUnknownableText(home.backupPowerType),
    has_well_water: toUnknownableJson(home.hasWellWater),
    has_septic: toUnknownableJson(home.hasSeptic),
    roof_age_years: toUnknownableJson(home.roofAgeYears),
    notes: toUnknownableText(home.notes),
    attributes_provenance: home.attributesProvenance,
  };
}

export function householdProfileToRow(
  userId: string,
  household: HouseholdProfile,
): HouseholdProfileRow {
  return {
    user_id: userId,
    id: household.id,
    created_at: household.createdAt,
    updated_at: household.updatedAt,
    occupant_count: toUnknownableJson(household.occupantCount),
    infants_count: toUnknownableJson(household.infantsCount),
    children_count: toUnknownableJson(household.childrenCount),
    adults_count: toUnknownableJson(household.adultsCount),
    seniors_count: toUnknownableJson(household.seniorsCount),
    has_pregnancy: toUnknownableJson(household.hasPregnancy),
    has_mobility_needs: toUnknownableJson(household.hasMobilityNeeds),
    has_sensory_or_cognitive_needs: toUnknownableJson(
      household.hasSensoryOrCognitiveNeeds,
    ),
    has_power_dependent_medical_device: toUnknownableJson(
      household.hasPowerDependentMedicalDevice,
    ),
    has_prescription_medications: toUnknownableJson(
      household.hasPrescriptionMedications,
    ),
    pet_count: toUnknownableJson(household.petCount),
    pet_types: toUnknownableJson(household.petTypes),
    vehicle_count: toUnknownableJson(household.vehicleCount),
    can_self_evacuate: toUnknownableJson(household.canSelfEvacuate),
    preferred_language: toUnknownableText(household.preferredLanguage),
    budget_class: toUnknownableText(household.budgetClass),
    notes: toUnknownableText(household.notes),
    provenance: household.provenance,
  };
}

export function homeRowToProfile(row: HomeProfileRow): HomeProfile | null {
  return hydrateHomeProfile({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    location: row.location,
    addressProvenance: row.address_provenance,
    dwellingType: row.dwelling_type,
    stories: row.stories,
    yearBuilt: row.year_built,
    construction: row.construction,
    floodZone: row.flood_zone,
    elevationFeet: row.elevation_feet,
    hasBasement: row.has_basement,
    hasSafeInteriorRoom: row.has_safe_interior_room,
    hasHurricaneShutters: row.has_hurricane_shutters,
    hasBackupPower: row.has_backup_power,
    backupPowerType: row.backup_power_type,
    hasWellWater: row.has_well_water,
    hasSeptic: row.has_septic,
    roofAgeYears: row.roof_age_years,
    notes: row.notes,
    attributesProvenance: row.attributes_provenance,
  });
}

export function householdRowToProfile(
  row: HouseholdProfileRow,
): HouseholdProfile | null {
  return hydrateHouseholdProfile({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    occupantCount: row.occupant_count,
    infantsCount: row.infants_count,
    childrenCount: row.children_count,
    adultsCount: row.adults_count,
    seniorsCount: row.seniors_count,
    hasPregnancy: row.has_pregnancy,
    hasMobilityNeeds: row.has_mobility_needs,
    hasSensoryOrCognitiveNeeds: row.has_sensory_or_cognitive_needs,
    hasPowerDependentMedicalDevice: row.has_power_dependent_medical_device,
    hasPrescriptionMedications: row.has_prescription_medications,
    petCount: row.pet_count,
    petTypes: row.pet_types,
    vehicleCount: row.vehicle_count,
    canSelfEvacuate: row.can_self_evacuate,
    preferredLanguage: row.preferred_language,
    budgetClass: row.budget_class,
    notes: row.notes,
    provenance: row.provenance,
  });
}

export function snapshotFromRows(input: {
  home: HomeProfileRow | null;
  household: HouseholdProfileRow | null;
  generated: GeneratedRecommendationRow | null;
}): StormReadySnapshot {
  return {
    home: input.home ? homeRowToProfile(input.home) : null,
    household: input.household ? householdRowToProfile(input.household) : null,
    hazards: hydrateHazardState(input.generated?.hazards ?? null),
    recommendations: hydrateRecommendations(input.generated?.recommendations),
  };
}

export function hydrateRecommendations(value: unknown): Recommendation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(hydrateRecommendation)
    .filter((item): item is Recommendation => item !== null);
}

export function hydrateRecommendation(value: unknown): Recommendation | null {
  if (!isRecord(value)) return null;
  const title =
    typeof value.title === "string" && value.title.trim() !== ""
      ? value.title.trim()
      : null;
  if (!title) return null;
  return {
    id:
      typeof value.id === "string" && value.id.trim() !== ""
        ? value.id
        : `rec_${title}`,
    title,
    body: typeof value.body === "string" ? value.body : "",
    priority: readPriority(value.priority),
    category: readCategory(value.category),
    hazardKinds: Array.isArray(value.hazardKinds)
      ? value.hazardKinds.map((item) => readHazardKind(item))
      : [],
    ruleId: toUnknownableText(value.ruleId),
    rationale: toUnknownableText(value.rationale),
    timeframe: readTimeframe(value.timeframe),
    provenance: readProvenance(value.provenance),
  };
}

export function hydrateHazardState(value: unknown): HazardState | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return null;
  const observedAt =
    typeof value.observedAt === "string" && value.observedAt.trim() !== ""
      ? value.observedAt
      : null;
  if (!observedAt) return null;
  const hazards = Array.isArray(value.hazards) ? value.hazards : null;
  if (hazards === null) return null;
  return {
    observedAt,
    locationLabel: toUnknownableText(value.locationLabel),
    hazards: hazards.filter(isRecord).map((hazard, index) => ({
      id:
        typeof hazard.id === "string" && hazard.id.trim() !== ""
          ? hazard.id
          : `hazard_${index}`,
      kind: readHazardKind(hazard.kind),
      headline:
        typeof hazard.headline === "string" && hazard.headline.trim() !== ""
          ? hazard.headline
          : "Untitled hazard",
      severity: readSeverity(hazard.severity),
      urgency: readUrgency(hazard.urgency),
      onsetAt: toUnknownableText(hazard.onsetAt),
      endsAt: toUnknownableText(hazard.endsAt),
      nwsEventId: toUnknownableText(hazard.nwsEventId),
      instruction: toUnknownableText(hazard.instruction),
      provenance: readProvenance(hazard.provenance, "external_source"),
    })),
    allClear:
      value.allClear === true || value.allClear === false
        ? value.allClear
        : UNKNOWN,
    provenance: readProvenance(value.provenance),
  };
}

/**
 * Upsert the Auth0 user, latest home/household profiles, and the latest
 * recommendation snapshot. Call only after identity is known.
 */
export async function saveStormReadySnapshot(
  client: StormReadyPersistClient,
  identity: AuthIdentity,
  snapshot: StormReadySnapshot,
): Promise<SaveSnapshotResult | PersistFailure> {
  const sub = identity.sub.trim();
  if (!sub) {
    return {
      ok: false,
      error: "invalid_identity",
      message: "Auth0 user sub is required to save a plan.",
    };
  }

  const now = new Date().toISOString();
  const { data: user, error: userError } = await client
    .from("users")
    .upsert(
      {
        auth0_sub: sub,
        email: identity.email?.trim() || null,
        updated_at: now,
      },
      { onConflict: "auth0_sub" },
    )
    .select("id")
    .single();

  if (userError || !user) {
    return fail("save_user_failed", userError?.message);
  }

  if (snapshot.home) {
    const { error } = await client
      .from("home_profiles")
      .upsert(homeProfileToRow(user.id, snapshot.home), {
        onConflict: "user_id",
      });
    if (error) return fail("save_home_failed", error.message);
  }

  if (snapshot.household) {
    const { error } = await client
      .from("household_profiles")
      .upsert(householdProfileToRow(user.id, snapshot.household), {
        onConflict: "user_id",
      });
    if (error) return fail("save_household_failed", error.message);
  }

  const recommendations = snapshot.recommendations ?? [];
  const snapshotId = `plan_${user.id}`;
  const { error: recError } = await client
    .from("generated_recommendations")
    .upsert(
      {
        user_id: user.id,
        id: snapshotId,
        created_at: now,
        updated_at: now,
        recommendations: recommendations as unknown as Json,
        hazards: snapshot.hazards
          ? (snapshot.hazards as unknown as Json)
          : null,
        source: "save_plan",
      },
      { onConflict: "user_id" },
    );
  if (recError) return fail("save_recommendations_failed", recError.message);

  if (recommendations.length > 0) {
    const { error: auditError } = await client.from("audit_logs").insert(
      recommendations.map((rec) => ({
        user_id: user.id,
        rule_id: toUnknownableText(rec.ruleId),
        source:
          rec.provenance === UNKNOWN ? "save_plan" : rec.provenance,
        recommendation_id: rec.id,
      })),
    );
    if (auditError) return fail("save_audit_failed", auditError.message);
  }

  return { ok: true, userId: user.id, snapshot };
}

/**
 * Load the latest saved snapshot for an Auth0 `sub`.
 */
export async function loadStormReadySnapshot(
  client: StormReadyPersistClient,
  identity: Pick<AuthIdentity, "sub">,
): Promise<LoadSnapshotResult | PersistFailure> {
  const sub = identity.sub.trim();
  if (!sub) {
    return {
      ok: false,
      error: "invalid_identity",
      message: "Auth0 user sub is required to load a plan.",
    };
  }

  const { data: user, error: userError } = await client
    .from("users")
    .select("id")
    .eq("auth0_sub", sub)
    .maybeSingle();

  if (userError) return fail("load_user_failed", userError.message);
  if (!user) return { ok: true, snapshot: null };

  const [home, household, generated] = await Promise.all([
    client.from("home_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    client
      .from("household_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    client
      .from("generated_recommendations")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (home.error) return fail("load_home_failed", home.error.message);
  if (household.error) {
    return fail("load_household_failed", household.error.message);
  }
  if (generated.error) {
    return fail("load_recommendations_failed", generated.error.message);
  }

  return {
    ok: true,
    snapshot: snapshotFromRows({
      home: home.data,
      household: household.data,
      generated: generated.data,
    }),
  };
}

/** Write a loaded cloud snapshot into the anonymous local store. */
export function applySavedSnapshotToLocalStore(
  snapshot: StormReadySnapshot,
): PersistedProfile {
  return saveProfile({
    home: snapshot.home,
    household: snapshot.household,
  });
}

function fail(error: string, detail?: string): PersistFailure {
  void detail;
  return {
    ok: false,
    error,
    message: "Could not save or load the plan.",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readProvenance(
  value: unknown,
  fallback: Provenance = "unknown",
): Provenance {
  if (typeof value === "string" && (PROVENANCE as readonly string[]).includes(value)) {
    return value as Provenance;
  }
  return fallback;
}

function readPriority(value: unknown): Recommendation["priority"] {
  if (
    value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low"
  ) {
    return value;
  }
  return "medium";
}

function readCategory(value: unknown): Recommendation["category"] {
  const allowed: Recommendation["category"][] = [
    "evacuate",
    "shelter",
    "supplies",
    "medical",
    "pets",
    "power",
    "water",
    "communication",
    "documents",
    "other",
  ];
  return typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as Recommendation["category"])
    : "other";
}

function readHazardKind(value: unknown): Recommendation["hazardKinds"][number] {
  const allowed: Recommendation["hazardKinds"] = [
    "hurricane",
    "tropical_storm",
    "storm_surge",
    "flood",
    "flash_flood",
    "tornado",
    "severe_thunderstorm",
    "extreme_heat",
    "extreme_cold",
    "winter_storm",
    "wind",
    "wildfire",
    "rip_current",
    "other",
  ];
  return typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as Recommendation["hazardKinds"][number])
    : "other";
}

function readTimeframe(value: unknown): Recommendation["timeframe"] {
  if (
    value === "now" ||
    value === "before_event" ||
    value === "before_next_event" ||
    value === "during_event" ||
    value === "after_event" ||
    value === "long_term"
  ) {
    return value;
  }
  return UNKNOWN;
}

function readSeverity(value: unknown): HazardState["hazards"][number]["severity"] {
  if (
    value === "advisory" ||
    value === "watch" ||
    value === "warning" ||
    value === "emergency" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function readUrgency(
  value: unknown,
): HazardState["hazards"][number]["urgency"] {
  if (
    value === "immediate" ||
    value === "expected" ||
    value === "future" ||
    value === "past"
  ) {
    return value;
  }
  return UNKNOWN;
}
