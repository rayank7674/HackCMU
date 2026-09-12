/**
 * Public StormReady types. Import from `@/types` or `@/lib/stormready`.
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
} from "./domain";

export {
  UNKNOWN,
  emptyGeocodedLocation,
  isKnown,
  isUnknown,
} from "./domain";
