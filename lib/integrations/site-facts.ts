import { UNKNOWN, isKnown, type HomeProfile, type Unknownable } from "@/lib/stormready";
import { fetchJson, isRecord, readNumber, readString } from "./http";
import { unavailable, type IntegrationUnavailable } from "./result";

const FEMA_NFHL =
  "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query";
const USGS_EPQS = "https://epqs.nationalmap.gov/v1/json";

export type SiteFactsOk = {
  ok: true;
  status: "ok";
  floodZone: Unknownable<string>;
  elevationFeet: Unknownable<number>;
  notes: string[];
};

export type SiteFactsResult = SiteFactsOk | IntegrationUnavailable;

function validCoords(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

export async function lookupFloodZone(
  latitude: number,
  longitude: number,
): Promise<Unknownable<string>> {
  const params = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "FLD_ZONE,ZONE_SUBTY",
    returnGeometry: "false",
    f: "json",
  });
  const fetched = await fetchJson(`${FEMA_NFHL}?${params.toString()}`);
  if (!fetched.ok || !isRecord(fetched.data)) return UNKNOWN;
  const features = fetched.data.features;
  if (!Array.isArray(features) || features.length === 0) return UNKNOWN;
  const first = features[0];
  const attrs = isRecord(first) && isRecord(first.attributes) ? first.attributes : null;
  if (!attrs) return UNKNOWN;
  const zone = readString(attrs.FLD_ZONE);
  return zone ?? UNKNOWN;
}

export async function lookupElevationFeet(
  latitude: number,
  longitude: number,
): Promise<Unknownable<number>> {
  const params = new URLSearchParams({
    x: String(longitude),
    y: String(latitude),
    wkid: "4326",
    units: "Feet",
  });
  const fetched = await fetchJson(`${USGS_EPQS}?${params.toString()}`);
  if (!fetched.ok || !isRecord(fetched.data)) return UNKNOWN;
  const elevation = readNumber(fetched.data.value);
  if (elevation === null || !Number.isFinite(elevation) || Math.abs(elevation) >= 30_000) {
    return UNKNOWN;
  }
  return elevation;
}

export async function lookupSiteFacts(
  latitude: number,
  longitude: number,
): Promise<SiteFactsResult> {
  if (!validCoords(latitude, longitude)) {
    return unavailable(
      "geocode",
      "invalid_input",
      "Latitude and longitude must be finite numbers. No flood zone or elevation was stored.",
    );
  }

  const notes: string[] = [];
  const [floodZone, elevationFeet] = await Promise.all([
    lookupFloodZone(latitude, longitude),
    lookupElevationFeet(latitude, longitude),
  ]);

  if (!isKnown(floodZone)) {
    notes.push(
      "FEMA flood zone was not returned for this point. Unknown is not 'outside a flood zone'.",
    );
  }
  if (!isKnown(elevationFeet)) {
    notes.push("USGS elevation was not returned for this point. Elevation stays unknown.");
  }

  return {
    ok: true,
    status: "ok",
    floodZone,
    elevationFeet,
    notes,
  };
}

export function applySiteFactsToHome(
  home: HomeProfile,
  facts: SiteFactsOk,
): HomeProfile {
  return {
    ...home,
    floodZone: isKnown(facts.floodZone) ? facts.floodZone : home.floodZone,
    elevationFeet: isKnown(facts.elevationFeet)
      ? facts.elevationFeet
      : home.elevationFeet,
  };
}
