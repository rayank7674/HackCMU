import { fetchJson, isRecord, readNumber, readString } from "@/lib/integrations/http";
import { distanceKm, type LatLon } from "@/lib/map/location";
import {
  parseGooglePeriods,
  type HoursPeriod,
  type PinHoursMatch,
} from "@/lib/map/google-hours";
import type { MapPlaceKind, MapPlacePin } from "@/lib/map/places";

const PLACES_NEARBY = "https://places.googleapis.com/v1/places:searchNearby";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.types",
  "places.businessStatus",
  "places.regularOpeningHours",
].join(",");

const TYPE_GROUPS: string[][] = [
  ["supermarket", "grocery_store", "convenience_store"],
  ["pharmacy"],
  ["hospital", "doctor"],
];

export type GooglePlaceHours = {
  googlePlaceId: string;
  googleName: string;
  kind: MapPlaceKind;
  latitude: number;
  longitude: number;
  businessStatus: string | null;
  periods: HoursPeriod[];
  weekdayDescriptions: string[];
};

export type { PinHoursMatch };

export function googlePlacesApiKey(): string {
  return (
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  );
}

export function isGooglePlacesConfigured(): boolean {
  return googlePlacesApiKey().length > 0;
}

export function classifyGoogleTypes(types: string[]): MapPlaceKind | null {
  const set = new Set(types);
  if (set.has("hospital")) return "hospital";
  if (set.has("pharmacy")) return "pharmacy";
  if (set.has("supermarket") || set.has("grocery_store") || set.has("convenience_store")) {
    return "grocery";
  }
  if (set.has("doctor")) return "clinic";
  return null;
}

export async function fetchGooglePlacesNearby(center: LatLon, radiusM: number): Promise<{
  configured: boolean;
  places: GooglePlaceHours[];
  error: string | null;
}> {
  const key = googlePlacesApiKey();
  if (!key) {
    return { configured: false, places: [], error: null };
  }

  const batches = await Promise.all(
    TYPE_GROUPS.map((includedTypes) =>
      searchNearby(key, center, radiusM, includedTypes),
    ),
  );
  const failed = batches.find((batch) => batch.error);
  const places = dedupePlaces(batches.flatMap((batch) => batch.places));
  if (places.length === 0 && failed) {
    return { configured: true, places: [], error: failed.error };
  }
  return { configured: true, places, error: null };
}

async function searchNearby(
  key: string,
  center: LatLon,
  radiusM: number,
  includedTypes: string[],
): Promise<{ places: GooglePlaceHours[]; error: string | null }> {
  const fetched = await fetchJson(PLACES_NEARBY, {
    method: "POST",
    timeoutMs: 12_000,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: center.latitude, longitude: center.longitude },
          radius: Math.min(50_000, Math.max(100, radiusM)),
        },
      },
    }),
  });
  if (!fetched.ok || !isRecord(fetched.data)) {
    return {
      places: [],
      error: fetched.ok ? "Google Places returned an unreadable body." : fetched.error,
    };
  }
  const list = Array.isArray(fetched.data.places) ? fetched.data.places : [];
  const places: GooglePlaceHours[] = [];
  for (const item of list) {
    const parsed = parsePlace(item);
    if (parsed) places.push(parsed);
  }
  return { places, error: null };
}

function parsePlace(value: unknown): GooglePlaceHours | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const display = isRecord(value.displayName) ? readString(value.displayName.text) : null;
  const location = isRecord(value.location) ? value.location : null;
  const latitude = location ? readNumber(location.latitude) : null;
  const longitude = location ? readNumber(location.longitude) : null;
  const types = Array.isArray(value.types)
    ? value.types.filter((item): item is string => typeof item === "string")
    : [];
  const kind = classifyGoogleTypes(types);
  if (!id || !display || latitude == null || longitude == null || !kind) return null;
  const hours = isRecord(value.regularOpeningHours) ? value.regularOpeningHours : {};
  const weekdayDescriptions = Array.isArray(hours.weekdayDescriptions)
    ? hours.weekdayDescriptions.filter((item): item is string => typeof item === "string")
    : [];
  return {
    googlePlaceId: id.startsWith("places/") ? id : `places/${id}`,
    googleName: display,
    kind,
    latitude,
    longitude,
    businessStatus: readString(value.businessStatus),
    periods: parseGooglePeriods(hours),
    weekdayDescriptions,
  };
}

function dedupePlaces(places: GooglePlaceHours[]): GooglePlaceHours[] {
  const seen = new Set<string>();
  const out: GooglePlaceHours[] = [];
  for (const place of places) {
    if (seen.has(place.googlePlaceId)) continue;
    seen.add(place.googlePlaceId);
    out.push(place);
  }
  return out;
}

export function matchPinsToGoogleHours(
  pins: Pick<MapPlacePin, "id" | "kind" | "latitude" | "longitude">[],
  googlePlaces: GooglePlaceHours[],
  maxKm = 0.2,
): PinHoursMatch[] {
  const used = new Set<string>();
  const matches: PinHoursMatch[] = [];
  for (const pin of pins) {
    let best: GooglePlaceHours | null = null;
    let bestKm = maxKm;
    for (const place of googlePlaces) {
      if (place.kind !== pin.kind) continue;
      if (used.has(place.googlePlaceId)) continue;
      const km = distanceKm(
        { latitude: pin.latitude, longitude: pin.longitude },
        { latitude: place.latitude, longitude: place.longitude },
      );
      if (km <= bestKm) {
        best = place;
        bestKm = km;
      }
    }
    if (!best) continue;
    used.add(best.googlePlaceId);
    matches.push({
      pinId: pin.id,
      googlePlaceId: best.googlePlaceId,
      googleName: best.googleName,
      periods: best.periods,
      weekdayDescriptions: best.weekdayDescriptions,
      businessStatus: best.businessStatus,
    });
  }
  return matches;
}
