/**
 * StormReady public API — types + anonymous profile store.
 *
 * Downstream agents (geocode/NWS adapters, rules, UI) should import from
 * this module so the domain contract stays in one place:
 *
 *   import { loadProfile, saveHomeProfile, type HomeProfile } from "@/lib/stormready";
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
  loadProfile,
  saveHomeProfile,
  saveHouseholdProfile,
  saveProfile,
} from "./profile-store";

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
