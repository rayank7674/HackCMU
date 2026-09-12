import { distanceKm, type LatLon } from "./location";

/**
 * Community-mapped access points from OpenStreetMap.
 * Not hours, not open/closed, not official shelter status, not a ranking.
 */
export const OSM_SOURCE = "OpenStreetMap contributors";

export const OSM_PLACE_DISCLAIMER =
  "Places are from OpenStreetMap. Open/closed on a pin is posted hours for right now — not a model. Confirm before you travel.";

export const PLACE_SEARCH_RADIUS_KM = 3.5;
export const PLACE_SEARCH_RADIUS_MAX_KM = 8;
export const PLACE_PER_KIND_CAP = 8;
export const PLACE_TOTAL_CAP = 40;

export type MapPlaceKind =
  | "grocery"
  | "pharmacy"
  | "food_bank"
  | "hospital"
  | "clinic"
  | "shelter"
  | "assembly_point";

export const MAP_PLACE_KIND_LABEL: Record<MapPlaceKind, string> = {
  grocery: "Grocery / food / utilities",
  pharmacy: "Pharmacy",
  food_bank: "Food pantry",
  hospital: "Hospital",
  clinic: "Clinic",
  shelter: "Shelter (mapped)",
  assembly_point: "Assembly point",
};

/** One-letter marker so type stays readable when the ring shows open/closed. */
export const MAP_PLACE_KIND_LETTER: Record<MapPlaceKind, string> = {
  grocery: "G",
  pharmacy: "P",
  food_bank: "F",
  hospital: "H",
  clinic: "C",
  shelter: "S",
  assembly_point: "A",
};

export const MAP_PLACE_KIND_COLOR: Record<MapPlaceKind, string> = {
  grocery: "#2f6f4e",
  pharmacy: "#2c6aa8",
  food_bank: "#4a7c59",
  hospital: "#9b3d3d",
  clinic: "#c4733a",
  shelter: "#5b4f86",
  assembly_point: "#6b4f5b",
};

/** What a household can typically get at this kind of OSM place. */
export const PLACE_OFFERS: Record<
  MapPlaceKind,
  { headline: string; items: string[] }
> = {
  grocery: {
    headline: "Food and household utilities",
    items: [
      "Groceries, drinking water, and ice",
      "Batteries, chargers, and basic household goods",
    ],
  },
  pharmacy: {
    headline: "Medicine and first aid",
    items: [
      "Prescription pickup if the counter is staffed",
      "Over-the-counter medicine, first-aid, and toiletries",
    ],
  },
  food_bank: {
    headline: "Food assistance",
    items: [
      "Grocery boxes or hot meals if they are distributing",
      "Confirm hours on the linked page before you go",
    ],
  },
  hospital: {
    headline: "Emergency and hospital care",
    items: [
      "ER and inpatient care",
      "Not a substitute for calling 911",
    ],
  },
  clinic: {
    headline: "Clinic / doctor visit",
    items: [
      "Urgent or routine care, vaccines, and prescriptions they stock",
      "Usually not a trauma ER",
    ],
  },
  shelter: {
    headline: "Overnight shelter (if officially open)",
    items: [
      "A mapped shelter tag — not the county’s live open/closed board",
      "Confirm with local emergency management before you travel",
    ],
  },
  assembly_point: {
    headline: "Meeting / assembly point",
    items: [
      "A mapped place to gather, not a store",
      "No supplies are implied",
    ],
  },
};

export type MapPlacePin = {
  id: string;
  title: string;
  kind: MapPlaceKind;
  latitude: number;
  longitude: number;
  source: typeof OSM_SOURCE;
  description: string;
  href: string;
  osmType: "node" | "way" | "relation";
  osmId: number;
};

export type OverpassTags = Record<string, string>;

export type OverpassElement = {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: unknown;
};

export function clampPlaceRadiusKm(value: number | null): number {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return PLACE_SEARCH_RADIUS_KM;
  }
  return Math.min(PLACE_SEARCH_RADIUS_MAX_KM, Math.max(1, value));
}

export function bboxAround(center: LatLon, radiusKm: number): {
  south: number;
  west: number;
  north: number;
  east: number;
} {
  const dLat = radiusKm / 111.32;
  const cosLat = Math.cos((center.latitude * Math.PI) / 180);
  const dLon = radiusKm / (111.32 * Math.max(0.2, Math.abs(cosLat)));
  return {
    south: center.latitude - dLat,
    west: center.longitude - dLon,
    north: center.latitude + dLat,
    east: center.longitude + dLon,
  };
}

export function overpassPlacesQuery(center: LatLon, radiusKm: number): string {
  const box = bboxAround(center, radiusKm);
  const bbox = `${box.south},${box.west},${box.north},${box.east}`;
  // Nodes + ways with centers. Timeout stays short so we can fail over.
  return `[out:json][timeout:12];
(
  nwr["shop"~"^(supermarket|grocery|convenience|greengrocer)$"](${bbox});
  nwr["amenity"="marketplace"](${bbox});
  nwr["amenity"="pharmacy"](${bbox});
  nwr["amenity"~"^(hospital|clinic|doctors)$"](${bbox});
  nwr["amenity"="food_bank"](${bbox});
  nwr["social_facility"="food_bank"](${bbox});
  nwr["emergency"="assembly_point"](${bbox});
  nwr["social_facility"="shelter"](${bbox});
);
out center tags;`;
}

export const NOMINATIM_NEARBY_QUERIES = [
  "supermarket",
  "pharmacy",
  "hospital",
  "clinic",
] as const;

export function nominatimViewbox(center: LatLon, radiusKm: number): string {
  const box = bboxAround(center, radiusKm);
  return `${box.west},${box.north},${box.east},${box.south}`;
}

export function classifyOsmTags(tags: OverpassTags): MapPlaceKind | null {
  const amenity = tags.amenity ?? "";
  const shop = tags.shop ?? "";
  const social = tags.social_facility ?? "";
  const emergency = tags.emergency ?? "";

  if (social === "food_bank" || amenity === "food_bank") return "food_bank";
  if (amenity === "pharmacy") return "pharmacy";
  if (amenity === "hospital") return "hospital";
  if (amenity === "clinic" || amenity === "doctors") return "clinic";
  if (emergency === "assembly_point") return "assembly_point";
  if (social === "shelter") return "shelter";
  if (
    shop === "supermarket" ||
    shop === "grocery" ||
    shop === "convenience" ||
    shop === "greengrocer" ||
    amenity === "marketplace"
  ) {
    return "grocery";
  }
  return null;
}

function readTags(value: unknown): OverpassTags | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const tags: OverpassTags = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry.trim() !== "") {
      tags[key] = entry.trim();
    }
  }
  return tags;
}

function readCoord(
  lat: unknown,
  lon: unknown,
): { latitude: number; longitude: number } | null {
  const latitude = typeof lat === "number" ? lat : Number(lat);
  const longitude = typeof lon === "number" ? lon : Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function osmHref(type: MapPlacePin["osmType"], id: number): string {
  return `https://www.openstreetmap.org/${type}/${id}`;
}

function fallbackTitle(kind: MapPlaceKind): string {
  return MAP_PLACE_KIND_LABEL[kind];
}

function descriptionFor(kind: MapPlaceKind): string {
  switch (kind) {
    case "grocery":
      return "Grocery, food, or household utilities mapped in OpenStreetMap. Hours and stock are not confirmed here.";
    case "pharmacy":
      return "Pharmacy mapped in OpenStreetMap. Not a live open/closed status.";
    case "food_bank":
      return "Food pantry or food bank mapped in OpenStreetMap. Confirm hours on the linked page.";
    case "hospital":
      return "Hospital mapped in OpenStreetMap. Not an emergency-dispatch map.";
    case "clinic":
      return "Clinic or doctor's office mapped in OpenStreetMap.";
    case "shelter":
      return "A shelter tagged in OpenStreetMap. This is not an official open/closed emergency-shelter list.";
    case "assembly_point":
      return "Emergency assembly point mapped in OpenStreetMap. Confirm local instructions before you go.";
  }
}

export function parseOverpassPlace(
  element: OverpassElement,
): MapPlacePin | null {
  const type =
    element.type === "node" || element.type === "way" || element.type === "relation"
      ? element.type
      : null;
  const osmId = typeof element.id === "number" ? element.id : Number(element.id);
  if (!type || !Number.isFinite(osmId)) return null;

  const tags = readTags(element.tags);
  if (!tags) return null;
  const kind = classifyOsmTags(tags);
  if (!kind) return null;

  const coords =
    readCoord(element.lat, element.lon) ??
    readCoord(element.center?.lat, element.center?.lon);
  if (!coords) return null;

  const title = tags.name?.trim() || fallbackTitle(kind);

  return {
    id: `osm:${type}:${osmId}`,
    title,
    kind,
    latitude: coords.latitude,
    longitude: coords.longitude,
    source: OSM_SOURCE,
    description: descriptionFor(kind),
    href: osmHref(type, osmId),
    osmType: type,
    osmId,
  };
}

export function parseOverpassPlaces(data: unknown): MapPlacePin[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return [];
  }
  const elements = (data as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return [];

  const seen = new Set<string>();
  const pins: MapPlacePin[] = [];
  for (const element of elements) {
    if (typeof element !== "object" || element === null) continue;
    const pin = parseOverpassPlace(element as OverpassElement);
    if (!pin || seen.has(pin.id)) continue;
    seen.add(pin.id);
    pins.push(pin);
  }
  return pins;
}

export function classifyNominatimCategory(
  category: string,
  type: string,
): MapPlaceKind | null {
  if (category === "shop") return classifyOsmTags({ shop: type });
  if (category === "amenity") return classifyOsmTags({ amenity: type });
  if (category === "emergency") return classifyOsmTags({ emergency: type });
  if (category === "social_facility") {
    return classifyOsmTags({ social_facility: type });
  }
  return classifyOsmTags({ amenity: type, shop: type });
}

export function parseNominatimPlace(item: unknown): MapPlacePin | null {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return null;
  }
  const row = item as Record<string, unknown>;
  const osmTypeRaw = typeof row.osm_type === "string" ? row.osm_type : "";
  const osmType =
    osmTypeRaw === "node" || osmTypeRaw === "way" || osmTypeRaw === "relation"
      ? osmTypeRaw
      : osmTypeRaw === "N"
        ? "node"
        : osmTypeRaw === "W"
          ? "way"
          : osmTypeRaw === "R"
            ? "relation"
            : null;
  const osmId = typeof row.osm_id === "number" ? row.osm_id : Number(row.osm_id);
  if (!osmType || !Number.isFinite(osmId)) return null;

  const category =
    (typeof row.category === "string" && row.category) ||
    (typeof row.class === "string" && row.class) ||
    "";
  const type = typeof row.type === "string" ? row.type : "";
  const kind = classifyNominatimCategory(category, type);
  if (!kind) return null;

  const coords = readCoord(row.lat, row.lon);
  if (!coords) return null;

  const title =
    (typeof row.name === "string" && row.name.trim()) ||
    (typeof row.display_name === "string" && row.display_name.split(",")[0]?.trim()) ||
    fallbackTitle(kind);

  return {
    id: `osm:${osmType}:${osmId}`,
    title,
    kind,
    latitude: coords.latitude,
    longitude: coords.longitude,
    source: OSM_SOURCE,
    description: descriptionFor(kind),
    href: osmHref(osmType, osmId),
    osmType,
    osmId,
  };
}

export function parseNominatimPlaces(data: unknown): MapPlacePin[] {
  const list = Array.isArray(data) ? data : [];
  const seen = new Set<string>();
  const pins: MapPlacePin[] = [];
  for (const item of list) {
    const pin = parseNominatimPlace(item);
    if (!pin || seen.has(pin.id)) continue;
    seen.add(pin.id);
    pins.push(pin);
  }
  return pins;
}

export function capPlacesForMap(
  pins: MapPlacePin[],
  center: LatLon,
): MapPlacePin[] {
  const ranked = [...pins].sort(
    (a, b) =>
      distanceKm(center, { latitude: a.latitude, longitude: a.longitude }) -
      distanceKm(center, { latitude: b.latitude, longitude: b.longitude }),
  );

  const used = new Map<MapPlaceKind, number>();
  const selected: MapPlacePin[] = [];
  for (const pin of ranked) {
    const count = used.get(pin.kind) ?? 0;
    if (count >= PLACE_PER_KIND_CAP) continue;
    used.set(pin.kind, count + 1);
    selected.push(pin);
    if (selected.length >= PLACE_TOTAL_CAP) break;
  }
  return selected;
}
