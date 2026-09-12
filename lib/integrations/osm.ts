import { fetchJson } from "./http";
import { unavailable, type IntegrationUnavailable } from "./result";
import {
  NOMINATIM_NEARBY_QUERIES,
  capPlacesForMap,
  clampPlaceRadiusKm,
  nominatimViewbox,
  overpassPlacesQuery,
  parseNominatimPlaces,
  parseOverpassPlaces,
  type MapPlacePin,
} from "@/lib/map/places";
import type { LatLon } from "@/lib/map/location";

/** Public OSM Overpass mirrors. The main instance is often busy or slow. */
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
] as const;

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
const OSM_USER_AGENT = "FaultLine/1.0 (hackcmu; household-preparedness)";
const OVERPASS_TIMEOUT_MS = 12_000;
const NOMINATIM_TIMEOUT_MS = 10_000;

export type OsmPlacesOk = {
  ok: true;
  status: "ok";
  service: "osm";
  pins: MapPlacePin[];
  center: LatLon;
  radiusKm: number;
};

export type OsmPlacesResult = OsmPlacesOk | IntegrationUnavailable;

function osmHeaders(): HeadersInit {
  return {
    "User-Agent": OSM_USER_AGENT,
    Accept: "application/json",
  };
}

export async function fetchOsmPlaces(input: {
  latitude: number;
  longitude: number;
  radiusKm?: number | null;
}): Promise<OsmPlacesResult> {
  const latitude = input.latitude;
  const longitude = input.longitude;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return unavailable(
      "osm",
      "invalid_input",
      "Latitude and longitude must be finite numbers (lat -90..90, lon -180..180).",
    );
  }

  const center = { latitude, longitude };
  const radiusKm = clampPlaceRadiusKm(input.radiusKm ?? null);
  const overpass = await fetchOverpassPlaces(center, radiusKm);
  let pins = overpass.pins;
  if (pins.length === 0) {
    const fromSearch = await fetchNominatimPlaces(center, radiusKm);
    if (fromSearch.length > 0) pins = fromSearch;
  }

  if (pins.length === 0 && !overpass.reached) {
    return unavailable(
      "osm",
      "upstream_unavailable",
      "OpenStreetMap did not return nearby places. Access points were not invented.",
    );
  }

  return {
    ok: true,
    status: "ok",
    service: "osm",
    pins: capPlacesForMap(pins, center),
    center,
    radiusKm,
  };
}

async function fetchOverpassPlaces(
  center: LatLon,
  radiusKm: number,
): Promise<{ reached: boolean; pins: MapPlacePin[] }> {
  const query = overpassPlacesQuery(center, radiusKm);
  const body = new URLSearchParams({ data: query }).toString();

  const results = await Promise.all(
    OVERPASS_ENDPOINTS.map((url) =>
      fetchJson(url, {
        method: "POST",
        timeoutMs: OVERPASS_TIMEOUT_MS,
        headers: {
          ...osmHeaders(),
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body,
      }),
    ),
  );
  for (const fetched of results) {
    if (!fetched.ok) continue;
    return { reached: true, pins: parseOverpassPlaces(fetched.data) };
  }
  return { reached: false, pins: [] };
}

async function fetchNominatimPlaces(
  center: LatLon,
  radiusKm: number,
): Promise<MapPlacePin[]> {
  const viewbox = nominatimViewbox(center, radiusKm);
  const batches = await Promise.all(
    NOMINATIM_NEARBY_QUERIES.map(async (q) => {
      const url =
        `${NOMINATIM_SEARCH}?format=jsonv2&limit=20&bounded=1` +
        `&viewbox=${encodeURIComponent(viewbox)}&q=${encodeURIComponent(q)}`;
      const fetched = await fetchJson(url, {
        headers: osmHeaders(),
        timeoutMs: NOMINATIM_TIMEOUT_MS,
      });
      if (!fetched.ok) return [];
      return parseNominatimPlaces(fetched.data);
    }),
  );
  return batches.flat();
}
