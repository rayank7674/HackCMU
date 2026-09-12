/**
 * Public StormReady types. Import from `@/types` or `@/lib/stormready`.
 * Legacy rooms/sessions types live in `components/layout/legacy-rooms.ts`
 * and are not part of this contract.
 */
export type {
  ActiveHazard,
  BackupPowerType,
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
