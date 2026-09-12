import { isKnown, type GeocodedLocation } from "@/lib/stormready";

/** Downtown Tampa — default demo center when no home coordinates exist. */
export const TAMPA_DEMO_CENTER = {
  latitude: 27.9506,
  longitude: -82.4572,
} as const;

/** Continental US fallback if Tampa pins are not appropriate. */
export const US_FALLBACK_CENTER = {
  latitude: 39.8283,
  longitude: -98.5795,
} as const;

/** Show Tampa-area example pins only when the view is near the demo. */
export const TAMPA_PIN_RADIUS_KM = 120;

/** Offset distance so the map never drops a precise address pin. */
export const APPROXIMATE_OFFSET_METERS = 320;

const METERS_PER_DEG_LAT = 111_320;

export type LatLon = {
  latitude: number;
  longitude: number;
};

export function knownCoordinates(
  location: GeocodedLocation | null | undefined,
): LatLon | null {
  if (!location) return null;
  if (!isKnown(location.latitude) || !isKnown(location.longitude)) return null;
  if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
    return null;
  }
  if (Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) {
    return null;
  }
  return { latitude: location.latitude, longitude: location.longitude };
}

/**
 * Deterministic offset (~300m) so the marker is approximate, not an
 * exact address dox. Same input always yields the same nearby point.
 */
export function approximateHomeLocation(latitude: number, longitude: number): LatLon {
  const angle =
    ((Math.abs(latitude * 1_000) + Math.abs(longitude * 1_000)) % 360) *
    (Math.PI / 180);
  const degLat = APPROXIMATE_OFFSET_METERS / METERS_PER_DEG_LAT;
  const cosLat = Math.cos(latitude * (Math.PI / 180));
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.max(0.2, Math.abs(cosLat));
  const degLon = APPROXIMATE_OFFSET_METERS / metersPerDegLon;

  return {
    latitude: latitude + degLat * Math.sin(angle),
    longitude: longitude + degLon * Math.cos(angle),
  };
}

export function distanceKm(a: LatLon, b: LatLon): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function isNearTampa(point: LatLon): boolean {
  return distanceKm(point, TAMPA_DEMO_CENTER) <= TAMPA_PIN_RADIUS_KM;
}

export type MapViewModel = {
  center: LatLon;
  zoom: number;
  hasHomeLocation: boolean;
  approximateHome: LatLon | null;
  showTampaExamplePins: boolean;
};

export function pointsForBounds(
  home: LatLon | null,
  pins: readonly LatLon[],
): LatLon[] {
  const points = pins.map((pin) => ({
    latitude: pin.latitude,
    longitude: pin.longitude,
  }));
  if (home) points.push(home);
  return points;
}

export function resolveMapView(location: GeocodedLocation | null | undefined): MapViewModel {
  const known = knownCoordinates(location);
  if (!known) {
    return {
      center: TAMPA_DEMO_CENTER,
      zoom: 11,
      hasHomeLocation: false,
      approximateHome: null,
      showTampaExamplePins: true,
    };
  }

  const approximateHome = approximateHomeLocation(known.latitude, known.longitude);
  const nearTampa = isNearTampa(known);

  return {
    center: approximateHome,
    zoom: nearTampa ? 11 : 10,
    hasHomeLocation: true,
    approximateHome,
    showTampaExamplePins: nearTampa,
  };
}
