import {
  UNKNOWN,
  canUseProfileStorage,
  isKnown,
  loadProfile,
  saveHomeProfile,
  type ActiveHazard,
  type GeocodedLocation,
  type HazardKind,
  type HazardSeverity,
  type HazardState,
  type HazardUrgency,
  type HomeProfile,
  type PersistedProfile,
  type Unknownable,
} from "@/lib/stormready";
import { fetchJson, isRecord, readNumber, readString } from "./http";
import { unavailable, type IntegrationUnavailable } from "./result";

const NWS_API_BASE = "https://api.weather.gov";
const NWS_USER_AGENT = "FaultLine/1.0 (hackcmu; household-preparedness)";
const NWS_ACCEPT = "application/geo+json, application/ld+json, application/json";

export type NwsLocationFields = Pick<
  GeocodedLocation,
  "county" | "nwsForecastOffice" | "nwsForecastZone" | "nwsCountyZone"
> & {
  locationLabel: Unknownable<string>;
};

export type NwsForecastPeriod = {
  name: string;
  detailedForecast: string;
  shortForecast: Unknownable<string>;
};

export type NwsForecastOk = {
  status: "ok";
  updatedAt: Unknownable<string>;
  periods: NwsForecastPeriod[];
};

export type NwsForecastResult = NwsForecastOk | IntegrationUnavailable;

export type NwsAlertsQuery = {
  latitude: number;
  longitude: number;
};

export type NwsAlertsOk = {
  ok: true;
  status: "ok";
  hazards: HazardState;
  forecast: NwsForecastResult;
  nwsLocation: NwsLocationFields;
};

export type NwsAlertsResult = NwsAlertsOk | IntegrationUnavailable;

/**
 * Resolve NWS /points, then active alerts + forecast for a coordinate.
 * Alerts fail closed: a points or alerts failure is unavailable and never
 * an all-clear. Forecast may be unavailable independently.
 */
export async function fetchNwsAlerts(
  query: NwsAlertsQuery,
): Promise<NwsAlertsResult> {
  const coords = validateCoords(query);
  if (!coords) {
    return unavailable(
      "nws",
      "invalid_input",
      "Latitude and longitude must be finite numbers (lat -90..90, lon -180..180).",
    );
  }

  const point = await fetchPoints(coords.latitude, coords.longitude);
  if (!point.ok) return point;

  const [alertsResult, forecastResult] = await Promise.all([
    fetchActiveAlerts(coords.latitude, coords.longitude),
    fetchForecast(point.forecastUrl),
  ]);

  if (!alertsResult.ok) {
    return alertsResult.error;
  }

  const hazards = hazardStateFromAlerts(
    alertsResult.features,
    point.nwsLocation.locationLabel,
  );

  return {
    ok: true,
    status: "ok",
    hazards,
    forecast: forecastResult,
    nwsLocation: point.nwsLocation,
  };
}

export function applyNwsLocationToHomeProfile(
  home: HomeProfile,
  nwsLocation: NwsLocationFields,
): HomeProfile {
  return {
    ...home,
    location: {
      ...home.location,
      county: preferKnown(nwsLocation.county, home.location.county),
      nwsForecastOffice: preferKnown(
        nwsLocation.nwsForecastOffice,
        home.location.nwsForecastOffice,
      ),
      nwsForecastZone: preferKnown(
        nwsLocation.nwsForecastZone,
        home.location.nwsForecastZone,
      ),
      nwsCountyZone: preferKnown(
        nwsLocation.nwsCountyZone,
        home.location.nwsCountyZone,
      ),
    },
  };
}

/** Browser-only. No-op unless a home profile is already stored. */
export function persistNwsLocationToProfile(
  nwsLocation: NwsLocationFields,
): PersistedProfile | null {
  if (!canUseProfileStorage()) return null;
  const current = loadProfile();
  if (!current.home) return null;
  return saveHomeProfile(applyNwsLocationToHomeProfile(current.home, nwsLocation));
}

export function mapNwsEventToKind(event: string): HazardKind {
  const value = event.toLowerCase();
  if (value.includes("rip current")) return "rip_current";
  if (value.includes("storm surge")) return "storm_surge";
  if (value.includes("flash flood")) return "flash_flood";
  if (value.includes("flood")) return "flood";
  if (value.includes("tornado")) return "tornado";
  if (value.includes("hurricane force")) return "wind";
  if (value.includes("hurricane") || value.includes("typhoon")) return "hurricane";
  if (value.includes("tropical storm") || value.includes("tropical depression")) {
    return "tropical_storm";
  }
  // Official NWS fire-weather products only - do not invent a wildfire alert.
  if (
    value.includes("red flag") ||
    value.includes("fire weather") ||
    value.includes("wildfire") ||
    value.includes("extreme fire danger") ||
    value.includes("fire warning")
  ) {
    return "wildfire";
  }
  if (value.includes("thunderstorm")) return "severe_thunderstorm";
  if (value.includes("heat")) return "extreme_heat";
  if (
    value.includes("wind chill") ||
    value.includes("extreme cold") ||
    value.includes("cold weather") ||
    value.includes("freeze") ||
    value.includes("frost")
  ) {
    return "extreme_cold";
  }
  if (
    value.includes("winter") ||
    value.includes("blizzard") ||
    value.includes("ice storm") ||
    value.includes("snow") ||
    value.includes("sleet")
  ) {
    return "winter_storm";
  }
  if (value.includes("wind") || value.includes("gale")) return "wind";
  return "other";
}

export function mapNwsSeverity(
  event: string,
  severity: string | null,
): HazardSeverity {
  const value = event.toLowerCase();
  if (value.includes("emergency")) return "emergency";
  if (value.includes("warning")) return "warning";
  if (value.includes("watch")) return "watch";
  if (value.includes("advisory")) return "advisory";

  switch ((severity ?? "").toLowerCase()) {
    case "extreme":
      return "emergency";
    case "severe":
      return "warning";
    case "moderate":
      return "watch";
    case "minor":
      return "advisory";
    default:
      return "unknown";
  }
}

export function mapNwsUrgency(value: string | null): Unknownable<HazardUrgency> {
  switch ((value ?? "").toLowerCase()) {
    case "immediate":
      return "immediate";
    case "expected":
      return "expected";
    case "future":
      return "future";
    case "past":
      return "past";
    default:
      return UNKNOWN;
  }
}

type PointsOk = {
  ok: true;
  forecastUrl: Unknownable<string>;
  nwsLocation: NwsLocationFields;
};

async function fetchPoints(
  latitude: number,
  longitude: number,
): Promise<PointsOk | IntegrationUnavailable> {
  const point = formatPoint(latitude, longitude);
  const fetched = await nwsFetch(`${NWS_API_BASE}/points/${point}`);
  if (!fetched.ok) {
    return nwsFetchFailure(
      fetched,
      "National Weather Service location lookup failed. Alerts were not generated.",
    );
  }

  const properties = propertiesOf(fetched.data);
  if (!properties) {
    return unavailable(
      "nws",
      "upstream_error",
      "National Weather Service returned an unreadable /points payload. Alerts were not generated.",
    );
  }

  const relative = isRecord(properties.relativeLocation)
    ? properties.relativeLocation
    : null;
  const relativeProps =
    relative && isRecord(relative.properties) ? relative.properties : relative;
  const city = relativeProps ? readString(relativeProps.city) : null;
  const state = relativeProps ? readString(relativeProps.state) : null;
  const locationLabel =
    city && state ? `${city}, ${state}` : (city ?? state ?? UNKNOWN);

  return {
    ok: true,
    forecastUrl: readString(properties.forecast) ?? UNKNOWN,
    nwsLocation: {
      county: UNKNOWN,
      nwsForecastOffice:
        readString(properties.cwa) ?? readString(properties.gridId) ?? UNKNOWN,
      nwsForecastZone: zoneIdFromUrl(readString(properties.forecastZone)),
      nwsCountyZone: zoneIdFromUrl(readString(properties.county)),
      locationLabel,
    },
  };
}

async function fetchActiveAlerts(
  latitude: number,
  longitude: number,
): Promise<
  | { ok: true; features: unknown[] }
  | { ok: false; error: IntegrationUnavailable }
> {
  const point = formatPoint(latitude, longitude);
  const fetched = await nwsFetch(
    `${NWS_API_BASE}/alerts/active?point=${point}`,
  );
  if (!fetched.ok) {
    return {
      ok: false,
      error: nwsFetchFailure(
        fetched,
        "National Weather Service alerts are unavailable. No hazard list was generated.",
      ),
    };
  }

  if (!isRecord(fetched.data)) {
    return {
      ok: false,
      error: unavailable(
        "nws",
        "upstream_error",
        "National Weather Service returned an unreadable alerts payload. No hazard list was generated.",
      ),
    };
  }

  const features = fetched.data.features;
  if (!Array.isArray(features)) {
    return {
      ok: false,
      error: unavailable(
        "nws",
        "upstream_error",
        "National Weather Service alerts payload was missing features. No hazard list was generated.",
      ),
    };
  }

  return { ok: true, features };
}

async function fetchForecast(
  forecastUrl: Unknownable<string>,
): Promise<NwsForecastResult> {
  if (!isKnown(forecastUrl)) {
    return unavailable(
      "nws",
      "upstream_unavailable",
      "National Weather Service did not provide a forecast URL for this point.",
    );
  }

  const fetched = await nwsFetch(forecastUrl);
  if (!fetched.ok) {
    return nwsFetchFailure(
      fetched,
      "National Weather Service forecast is unavailable.",
    );
  }

  const properties = propertiesOf(fetched.data);
  if (!properties || !Array.isArray(properties.periods)) {
    return unavailable(
      "nws",
      "upstream_error",
      "National Weather Service returned an unreadable forecast payload.",
    );
  }

  const periods: NwsForecastPeriod[] = [];
  for (const item of properties.periods) {
    if (!isRecord(item)) continue;
    const name = readString(item.name);
    const detailedForecast = readString(item.detailedForecast);
    // Official text only - skip a period rather than invent wording.
    if (!name || !detailedForecast) continue;
    periods.push({
      name,
      detailedForecast,
      shortForecast: readString(item.shortForecast) ?? UNKNOWN,
    });
  }

  return {
    status: "ok",
    updatedAt: readString(properties.updateTime) ?? readString(properties.generatedAt) ?? UNKNOWN,
    periods,
  };
}

function hazardStateFromAlerts(
  features: unknown[],
  locationLabel: Unknownable<string>,
): HazardState {
  const hazards: ActiveHazard[] = [];

  for (const feature of features) {
    const hazard = activeHazardFromFeature(feature);
    if (hazard) hazards.push(hazard);
  }

  return {
    observedAt: new Date().toISOString(),
    locationLabel,
    hazards,
    allClear: hazards.length === 0,
    provenance: "external_source",
  };
}

function activeHazardFromFeature(feature: unknown): ActiveHazard | null {
  if (!isRecord(feature)) return null;
  const properties = isRecord(feature.properties) ? feature.properties : feature;
  const event = readString(properties.event);
  const headline = readString(properties.headline) ?? event;
  // Never invent a headline. Official headline, else official event name.
  if (!headline) return null;

  const nwsEventId =
    readString(properties.id) ??
    readString(feature.id) ??
    UNKNOWN;

  return {
    id: isKnown(nwsEventId) ? nwsEventId : fallbackHazardId(properties),
    kind: mapNwsEventToKind(event ?? headline),
    headline,
    severity: mapNwsSeverity(event ?? headline, readString(properties.severity)),
    urgency: mapNwsUrgency(readString(properties.urgency)),
    onsetAt:
      readString(properties.onset) ??
      readString(properties.effective) ??
      UNKNOWN,
    endsAt:
      readString(properties.ends) ?? readString(properties.expires) ?? UNKNOWN,
    nwsEventId,
    instruction: readString(properties.instruction) ?? UNKNOWN,
    provenance: "external_source",
  };
}

function fallbackHazardId(properties: Record<string, unknown>): string {
  const event = readString(properties.event) ?? "nws";
  const onset = readString(properties.onset) ?? readString(properties.effective) ?? "";
  return `nws:${event}:${onset}`;
}

function nwsFetch(url: string) {
  return fetchJson(url, {
    headers: {
      "User-Agent": NWS_USER_AGENT,
      Accept: NWS_ACCEPT,
    },
  });
}

function nwsFetchFailure(
  fetched: { timedOut: boolean; error: string; status: number | null },
  message: string,
): IntegrationUnavailable {
  if (fetched.timedOut) {
    return unavailable("nws", "upstream_unavailable", `${message} (timed out)`);
  }
  if (fetched.status === 404) {
    return unavailable(
      "nws",
      "no_match",
      "National Weather Service has no grid for that point.",
    );
  }
  return unavailable("nws", "upstream_error", `${message} (${fetched.error})`);
}

function propertiesOf(data: unknown): Record<string, unknown> | null {
  if (!isRecord(data)) return null;
  return isRecord(data.properties) ? data.properties : null;
}

function zoneIdFromUrl(url: string | null): Unknownable<string> {
  if (!url) return UNKNOWN;
  const trimmed = url.replace(/\/+$/, "");
  const id = trimmed.split("/").pop();
  return id && id.length > 0 ? id : UNKNOWN;
}

function formatPoint(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

function validateCoords(
  query: NwsAlertsQuery,
): { latitude: number; longitude: number } | null {
  const latitude = readNumber(query.latitude);
  const longitude = readNumber(query.longitude);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function preferKnown<T>(
  incoming: Unknownable<T>,
  existing: Unknownable<T>,
): Unknownable<T> {
  return isKnown(incoming) ? incoming : existing;
}
