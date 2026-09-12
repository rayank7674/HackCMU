/**
 * StormReady public API — types + anonymous profile store.
 *
 * Downstream agents (geocode/NWS adapters, rules, UI) should import from
 * this module so the domain contract stays in one place:
 *
 *   import { loadProfile, saveHomeProfile, type HomeProfile } from "@/lib/stormready";
 *
 * Geocode / NWS adapters (do not redefine these types there):
 *   import { geocode, fetchNwsAlerts, applyGeocodeToHomeProfile } from "@/lib/integrations";
 *
 * Equivalent splits:
 *   import type { HomeProfile } from "@/types";
 *   import { loadProfile } from "@/lib/profile-store";
 */

export type {
  ActiveHazard,
  BackupPowerType,
  BudgetClass,
  ConstructionType,
  DwellingType,
  GeocodedLocation,
  HazardKind,
  HazardSeverity,
  HazardState,
  HazardUrgency,
  HomeProfile,
  HouseholdProfile,
  MobilityAid,
  PetType,
  Provenance,
  Recommendation,
  RecommendationCategory,
  RecommendationHorizon,
  RecommendationPriority,
  RecommendationTimeframe,
  StormReadySnapshot,
  Unknown,
  Unknownable,
} from "../types";

export {
  UNKNOWN,
  emptyGeocodedLocation,
  isKnown,
  isUnknown,
} from "../types";

export type { PersistedProfile } from "./profile-store";

export {
  PROFILE_STORAGE_KEY,
  PROFILE_STORE_VERSION,
  canUseProfileStorage,
  clearProfile,
  createEmptyHomeProfile,
  createEmptyHouseholdProfile,
  emptyPersistedProfile,
  hasStoredProfile,
  hydrateHomeProfile,
  hydrateHouseholdProfile,
  loadProfile,
  normalizeHomeProfile,
  normalizeHouseholdProfile,
  restoreProfile,
  saveHomeProfile,
  saveHouseholdProfile,
  saveProfile,
} from "./profile-store";

export {
  applySavedSnapshotToLocalStore,
  homeProfileToRow,
  householdProfileToRow,
  loadStormReadySnapshot,
  saveStormReadySnapshot,
  snapshotFromRows,
} from "./supabase/persist";

export {
  getSupabasePublicEnv,
  isSupabaseConfigured,
} from "./supabase/env";
export {
  createBrowserSupabaseClient,
  createSupabaseClient,
} from "./supabase/client";

export type { AuthIdentity } from "./auth/identity";
export {
  AUTH0_LOGIN_PATH,
  AUTH0_LOGOUT_PATH,
  DEV_BYPASS_SUB_HEADER,
  isAuth0Configured,
  resolveAuthIdentity,
} from "./auth/identity";

export {
  recommend,
  evaluateRules,
  explainHazardAvailability,
  RULE_COUNT,
  actionFitsBudget,
  budgetLabel,
  ENGINE_REASONS,
} from "./recommendations";

export type {
  EngineResult,
  EngineStatus,
  HazardSource,
  RankedRecommendation,
  RecommendationInput,
} from "./recommendations";

export {
  optimizePreparednessPlan,
  toPreparednessActions,
  diffOptimizationResults,
  resolveOptimizationConstraints,
  planningDollarsForHousehold,
  planningMinutesFor,
  costUnitsForHousehold,
} from "./optimization";

export type {
  OptimizationConstraints,
  OptimizationDiff,
  OptimizationResult,
  PreparednessAction,
  TransportMode,
} from "./optimization";

export {
  buildHouseholdGraph,
  simulate,
  findMinimumBreakdown,
  findWorstCase,
  fortifyFromStress,
  STRESS_PRESETS,
  BASELINE_SCENARIO,
} from "./stress";
export type {
  StressResult,
  StressScenario,
  DependencyGraph,
  DisruptionLevel,
} from "./stress";

export {
  TAMPA_DEMO_HOME,
  TAMPA_DEMO_HOUSEHOLD,
  TAMPA_QUIET_WEATHER,
  TAMPA_HURRICANE_WATCH,
  TAMPA_EVACUATION_WARNING,
  TAMPA_FLOOD_WARNING,
  hazardFixtureFor,
  tampaDemoInput,
} from "./fixtures/tampa-demo";
export type { DemoScenario } from "./fixtures/tampa-demo";
