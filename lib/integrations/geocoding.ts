import {
  UNKNOWN,
  canUseProfileStorage,
  createEmptyHomeProfile,
  emptyGeocodedLocation,
  isKnown,
  loadProfile,
  saveHomeProfile,
  type GeocodedLocation,
  type HomeProfile,
  type PersistedProfile,
  type Unknownable,
} from "@/lib/stormready";
import { fetchJson, isRecord, readNumber, readString } from "./http";
import {
  unavailable,
  type IntegrationUnavailable,
} from "./result";

const CENSUS_GEOCODER_BASE = "https://geocoding.geo.census.gov/geocoder";
const CENSUS_BENCHMARK = "Public_AR_Current";
const CENSUS_VINTAGE = "Current_Current";
const TIGERWEB_ZCTA_QUERY =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query";

const ZIP_RE = /^(\d{5})(?:-\d{4})?$/;

export type GeocodeQuery = {
  /** Single-line address, e.g. "100 N Ashley Dr, Tampa, FL 33602". */
  address?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

export type NormalizedAddress = {
  matchedAddress: Unknownable<string>;
  addressLine: Unknownable<string>;
  city: Unknownable<string>;
  state: Unknownable<string>;
  postalCode: Unknownable<string>;
};

/** How the coordinates were obtained. ZCTA is a ZIP centroid, not a rooftop. */
export type GeocodeMatchKind = "address" | "zcta";

export type GeocodeOk = {
  ok: true;
  status: "ok";
  location: GeocodedLocation;
  normalizedAddress: NormalizedAddress;
  matchKind: GeocodeMatchKind;
  query: GeocodeQuery;
};

export type GeocodeResult = GeocodeOk | IntegrationUnavailable;

/**
 * Geocode a US address or ZIP via the Census Bureau (no API key).
 * On failure returns unavailable — never invents coordinates.
 */
export async function geocode(input: GeocodeQuery): Promise<GeocodeResult> {
  const query = normalizeQuery(input);
  if (!query) {
    return unavailable(
      "geocode",
      "invalid_input",
      "Provide an address, city/state, or a 5-digit US ZIP code.",
    );
  }

  const street = knownString(query.addressLine);
  const zip = knownString(query.postalCode) ?? extractZip(query.address);
  const looksLikeStreet = Boolean(
    street || (query.address && /^\d/.test(query.address.trim())),
  );

  if (looksLikeStreet) {
    const structured = await geocodeStructured(query);
    if (structured) return structured;

    const oneline = buildOneline(query);
    if (oneline) {
      const fromLine = await geocodeOneline(oneline, query);
      if (fromLine) return fromLine;
    }

    return unavailable(
      "geocode",
      "no_match",
      "The Census Geocoder did not match that address. No coordinates were stored.",
    );
  }

  const oneline = buildOneline(query);
  const zipOnly = !street && !knownString(query.city) && !knownString(query.state) && zip !== null;
  if (oneline && !zipOnly) {
    const fromLine = await geocodeOneline(oneline, query);
    if (fromLine) return fromLine;
  }

  // ZIP / city+state+ZIP without a street: Census ZCTA internal point only.
  // Never snap a failed street match to a ZIP centroid.
  if (zip) {
    const zcta = await geocodeZipZcta(zip, query);
    if (zcta) return zcta;
    return unavailable(
      "geocode",
      "no_match",
      `No Census ZIP Code Tabulation Area was found for ${zip}. No coordinates were stored.`,
    );
  }

  return unavailable(
    "geocode",
    "no_match",
    "The Census Geocoder did not match that location. No coordinates were stored.",
  );
}

/**
 * Copy geocode success onto a home profile. Known fields from Census win;
 * still-unknown adapter fields leave existing profile values untouched.
 */
export function applyGeocodeToHomeProfile(
  home: HomeProfile,
  result: GeocodeOk,
): HomeProfile {
  return {
    ...home,
    addressLine: preferKnown(
      result.normalizedAddress.addressLine,
      home.addressLine,
    ),
    city: preferKnown(result.normalizedAddress.city, home.city),
    state: preferKnown(result.normalizedAddress.state, home.state),
    postalCode: preferKnown(
      result.normalizedAddress.postalCode,
      home.postalCode,
    ),
    addressProvenance:
      result.matchKind === "address" ? "external_source" : home.addressProvenance,
    location: {
      ...home.location,
      latitude: preferKnown(result.location.latitude, home.location.latitude),
      longitude: preferKnown(
        result.location.longitude,
        home.location.longitude,
      ),
      county: preferKnown(result.location.county, home.location.county),
      provenance: "external_source",
    },
  };
}

/**
 * Browser-only persist. Updates an existing home profile; if none exists,
 * creates an empty one so the anonymous flow can store the geocode.
 * Returns null during SSR / when storage is unavailable.
 */
export function persistGeocodeToProfile(
  result: GeocodeOk,
): PersistedProfile | null {
  if (!canUseProfileStorage()) return null;
  const current = loadProfile();
  const home = current.home ?? createEmptyHomeProfile();
  return saveHomeProfile(applyGeocodeToHomeProfile(home, result));
}

function normalizeQuery(input: GeocodeQuery): GeocodeQuery | null {
  const address = clean(input.address);
  const addressLine = clean(input.addressLine);
  const city = clean(input.city);
  const state = clean(input.state);
  let postalCode = clean(input.postalCode);

  if (!postalCode) {
    postalCode = extractZip(address);
  }

  if (postalCode) {
    const zipMatch = postalCode.match(ZIP_RE);
    postalCode = zipMatch ? zipMatch[1] : null;
  }

  const query: GeocodeQuery = {};
  if (address) query.address = address;
  if (addressLine) query.addressLine = addressLine;
  if (city) query.city = city;
  if (state) query.state = state;
  if (postalCode) query.postalCode = postalCode;

  return Object.keys(query).length > 0 ? query : null;
}

function buildOneline(query: GeocodeQuery): string | null {
  if (query.address) return query.address;
  const parts = [query.addressLine, query.city, query.state, query.postalCode]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part !== "");
  return parts.length > 0 ? parts.join(", ") : null;
}

async function geocodeStructured(
  query: GeocodeQuery,
): Promise<GeocodeOk | IntegrationUnavailable | null> {
  const street = knownString(query.addressLine);
  if (!street) return null;

  const params = new URLSearchParams({
    street,
    benchmark: CENSUS_BENCHMARK,
    vintage: CENSUS_VINTAGE,
    format: "json",
  });
  const city = knownString(query.city);
  const state = knownString(query.state);
  const zip = knownString(query.postalCode);
  if (city) params.set("city", city);
  if (state) params.set("state", state);
  if (zip) params.set("zip", zip);

  if (!zip && !(city && state)) {
    return null;
  }

  const fetched = await fetchJson(
    `${CENSUS_GEOCODER_BASE}/geographies/address?${params.toString()}`,
  );
  if (!fetched.ok) {
    return mapFetchFailure("geocode", fetched);
  }
  return parseAddressMatches(fetched.data, query, "address");
}

async function geocodeOneline(
  address: string,
  query: GeocodeQuery,
): Promise<GeocodeOk | IntegrationUnavailable | null> {
  const params = new URLSearchParams({
    address,
    benchmark: CENSUS_BENCHMARK,
    vintage: CENSUS_VINTAGE,
    format: "json",
  });
  const fetched = await fetchJson(
    `${CENSUS_GEOCODER_BASE}/geographies/onelineaddress?${params.toString()}`,
  );
  if (!fetched.ok) {
    return mapFetchFailure("geocode", fetched);
  }
  return parseAddressMatches(fetched.data, query, "address");
}

/**
 * ZIP-only (or city/state/ZIP without a street) fallback using Census ZCTA
 * internal points. Returns null for a confirmed empty match, unavailable for
 * transport errors, success only when Census returns finite coordinates.
 */
async function geocodeZipZcta(
  zip: string,
  query: GeocodeQuery,
): Promise<GeocodeOk | IntegrationUnavailable | null> {
  const params = new URLSearchParams({
    where: `ZCTA5='${zip}'`,
    outFields: "ZCTA5,INTPTLAT,INTPTLON,NAME",
    returnGeometry: "false",
    f: "json",
  });
  const fetched = await fetchJson(`${TIGERWEB_ZCTA_QUERY}?${params.toString()}`);
  if (!fetched.ok) {
    return mapFetchFailure("geocode", fetched);
  }
  if (!isRecord(fetched.data)) return null;

  const features = fetched.data.features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const first = features[0];
  const attrs = isRecord(first) && isRecord(first.attributes) ? first.attributes : null;
  if (!attrs) return null;

  const latitude = readNumber(attrs.INTPTLAT);
  const longitude = readNumber(attrs.INTPTLON);
  if (latitude === null || longitude === null) return null;

  const county = await lookupCounty(longitude, latitude);

  return {
    ok: true,
    status: "ok",
    matchKind: "zcta",
    query,
    normalizedAddress: {
      matchedAddress: UNKNOWN,
      addressLine: UNKNOWN,
      city: UNKNOWN,
      state: UNKNOWN,
      postalCode: zip,
    },
    location: {
      ...emptyGeocodedLocation(),
      latitude,
      longitude,
      county,
      provenance: "external_source",
    },
  };
}

async function lookupCounty(
  longitude: number,
  latitude: number,
): Promise<Unknownable<string>> {
  const params = new URLSearchParams({
    x: String(longitude),
    y: String(latitude),
    benchmark: CENSUS_BENCHMARK,
    vintage: CENSUS_VINTAGE,
    format: "json",
  });
  const fetched = await fetchJson(
    `${CENSUS_GEOCODER_BASE}/geographies/coordinates?${params.toString()}`,
  );
  if (!fetched.ok || !isRecord(fetched.data)) return UNKNOWN;
  return countyFromGeographies(geographiesFrom(fetched.data));
}

function parseAddressMatches(
  data: unknown,
  query: GeocodeQuery,
  matchKind: GeocodeMatchKind,
): GeocodeOk | null {
  if (!isRecord(data) || !isRecord(data.result)) return null;
  const matches = data.result.addressMatches;
  if (!Array.isArray(matches) || matches.length === 0) return null;

  const match = matches.find((item) => isRecord(item));
  if (!isRecord(match)) return null;

  const coordinates = isRecord(match.coordinates) ? match.coordinates : null;
  const longitude = coordinates ? readNumber(coordinates.x) : null;
  const latitude = coordinates ? readNumber(coordinates.y) : null;
  if (latitude === null || longitude === null) return null;

  const components = isRecord(match.addressComponents)
    ? match.addressComponents
    : {};
  const matchedAddress = readString(match.matchedAddress) ?? UNKNOWN;
  const street = streetFromComponents(components);
  const city = readString(components.city)?.toUpperCase() ?? UNKNOWN;
  const state = readString(components.state)?.toUpperCase() ?? UNKNOWN;
  const postalCode = readString(components.zip) ?? UNKNOWN;
  const county = countyFromGeographies(geographiesFrom(match));

  return {
    ok: true,
    status: "ok",
    matchKind,
    query,
    normalizedAddress: {
      matchedAddress,
      addressLine: street !== UNKNOWN ? street : matchedAddress,
      city,
      state,
      postalCode,
    },
    location: {
      ...emptyGeocodedLocation(),
      latitude,
      longitude,
      county,
      provenance: "external_source",
    },
  };
}

function streetFromComponents(
  components: Record<string, unknown>,
): Unknownable<string> {
  const parts = [
    readString(components.fromAddress),
    readString(components.preDirection),
    readString(components.streetName),
    readString(components.suffixType),
    readString(components.suffixDirection),
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" ") : UNKNOWN;
}

function geographiesFrom(source: Record<string, unknown>): unknown {
  if (isRecord(source.geographies)) return source.geographies;
  if (isRecord(source.result) && isRecord(source.result.geographies)) {
    return source.result.geographies;
  }
  return null;
}

function countyFromGeographies(geographies: unknown): Unknownable<string> {
  if (!isRecord(geographies)) return UNKNOWN;
  const counties = geographies.Counties;
  if (!Array.isArray(counties) || counties.length === 0) return UNKNOWN;
  const first = counties[0];
  if (!isRecord(first)) return UNKNOWN;
  return readString(first.NAME) ?? readString(first.BASENAME) ?? UNKNOWN;
}

function mapFetchFailure(
  service: "geocode",
  fetched: { timedOut: boolean; error: string },
): IntegrationUnavailable {
  if (fetched.timedOut) {
    return unavailable(
      service,
      "upstream_unavailable",
      "The Census Geocoder timed out. No coordinates were stored.",
    );
  }
  return unavailable(
    service,
    "upstream_error",
    `The Census Geocoder is unavailable (${fetched.error}). No coordinates were stored.`,
  );
}

function preferKnown<T>(
  incoming: Unknownable<T>,
  existing: Unknownable<T>,
): Unknownable<T> {
  return isKnown(incoming) ? incoming : existing;
}

function knownString(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function clean(value: string | undefined): string | null {
  return knownString(value);
}

function extractZip(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const exact = trimmed.match(ZIP_RE);
  if (exact) return exact[1];
  // "Tampa, FL 33602" / "Washington, DC 20500" — not a 5-digit run inside garbage.
  const trailing = trimmed.match(
    /,\s*(?:[A-Za-z.]{2,}\s+)?(\d{5})(?:-\d{4})?\s*$/,
  );
  return trailing ? trailing[1] : null;
}

export function emptyNormalizedAddress(): NormalizedAddress {
  return {
    matchedAddress: UNKNOWN,
    addressLine: UNKNOWN,
    city: UNKNOWN,
    state: UNKNOWN,
    postalCode: UNKNOWN,
  };
}
