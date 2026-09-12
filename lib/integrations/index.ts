export {
  applyConfirmedLocation,
  applyGeocodeToHomeProfile,
  emptyNormalizedAddress,
  geocode,
  persistGeocodeToProfile,
  reverseGeocode,
  validateCoordinates,
  type GeocodeMatchKind,
  type GeocodeOk,
  type GeocodeQuery,
  type GeocodeResult,
  type NormalizedAddress,
  type ReverseGeocodeQuery,
} from "./geocoding";

export {
  seasonFromHome,
  resolveSeasonContext,
  type SeasonContext,
  type SeasonKind,
} from "./season";

export {
  applySiteFactsToHome,
  lookupSiteFacts,
  type SiteFactsOk,
  type SiteFactsResult,
} from "./site-facts";

export {
  applyNwsLocationToHomeProfile,
  fetchNwsAlerts,
  mapNwsEventToKind,
  mapNwsSeverity,
  mapNwsUrgency,
  persistNwsLocationToProfile,
  type NwsAlertsOk,
  type NwsAlertsQuery,
  type NwsAlertsResult,
  type NwsForecastOk,
  type NwsForecastPeriod,
  type NwsForecastResult,
  type NwsLocationFields,
} from "./nws";

export {
  httpStatusForUnavailable,
  unavailable,
  unknownHazardState,
  type IntegrationService,
  type IntegrationUnavailable,
  type IntegrationUnavailableReason,
} from "./result";
