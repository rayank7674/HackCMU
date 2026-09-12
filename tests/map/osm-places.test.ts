import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyOsmTags,
  capPlacesForMap,
  overpassPlacesQuery,
  parseNominatimPlaces,
  parseOverpassPlaces,
  PLACE_OFFERS,
  PLACE_PER_KIND_CAP,
} from "@/lib/map/places";
import { GET as getMapPlaces } from "@/app/api/map-places/route";
import { fetchOsmPlaces } from "@/lib/integrations/osm";
import { TAMPA_DEMO_CENTER } from "@/lib/map/location";
import { FORBIDDEN_MAP_LABELS } from "@/lib/map/resources";

describe("OSM place classification", () => {
  it("maps grocery, pharmacy, and shelter-style tags and skips picnic shelters", () => {
    expect(classifyOsmTags({ shop: "supermarket" })).toBe("grocery");
    expect(classifyOsmTags({ amenity: "pharmacy" })).toBe("pharmacy");
    expect(classifyOsmTags({ amenity: "hospital" })).toBe("hospital");
    expect(classifyOsmTags({ amenity: "clinic" })).toBe("clinic");
    expect(classifyOsmTags({ social_facility: "food_bank" })).toBe("food_bank");
    expect(classifyOsmTags({ emergency: "assembly_point" })).toBe(
      "assembly_point",
    );
    expect(classifyOsmTags({ social_facility: "shelter" })).toBe("shelter");
    expect(classifyOsmTags({ amenity: "shelter" })).toBeNull();
  });

  it("says what you can get at grocery, pharmacy, and hospital pins", () => {
    expect(PLACE_OFFERS.grocery.headline.toLowerCase()).toMatch(/food/);
    expect(PLACE_OFFERS.grocery.headline.toLowerCase()).toMatch(/utilit/);
    expect(PLACE_OFFERS.grocery.items.join(" ").toLowerCase()).toMatch(/water/);
    expect(PLACE_OFFERS.pharmacy.items.join(" ").toLowerCase()).toMatch(
      /medicine|prescription/,
    );
    expect(PLACE_OFFERS.hospital.headline.toLowerCase()).toMatch(/care|hospital/);
  });

  it("parses Overpass elements without inventing names or rankings", () => {
    const pins = parseOverpassPlaces({
      elements: [
        {
          type: "node",
          id: 1,
          lat: 27.95,
          lon: -82.46,
          tags: { amenity: "pharmacy", name: "Bay Pharmacy" },
        },
        {
          type: "way",
          id: 2,
          center: { lat: 27.951, lon: -82.459 },
          tags: { shop: "supermarket" },
        },
        {
          type: "node",
          id: 3,
          lat: 27.952,
          lon: -82.458,
          tags: { amenity: "shelter", name: "Picnic pavilion" },
        },
      ],
    });
    expect(pins).toHaveLength(2);
    expect(pins[0]?.title).toBe("Bay Pharmacy");
    expect(pins[0]?.kind).toBe("pharmacy");
    expect(pins[0]?.source).toBe("OpenStreetMap contributors");
    expect(pins[0]?.href).toBe("https://www.openstreetmap.org/node/1");
    expect(pins[1]?.title).toBe("Grocery / food / utilities");
    const blob = pins.map((pin) => `${pin.title} ${pin.description}`).join(" ");
    for (const word of FORBIDDEN_MAP_LABELS) {
      expect(blob.toLowerCase()).not.toContain(word);
    }
  });

  it("caps each kind so one supermarket cluster cannot drown pharmacies", () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      id: `osm:node:${index}`,
      title: `Store ${index}`,
      kind: "grocery" as const,
      latitude: TAMPA_DEMO_CENTER.latitude + index * 0.001,
      longitude: TAMPA_DEMO_CENTER.longitude,
      source: "OpenStreetMap contributors" as const,
      description: "Grocery",
      href: `https://www.openstreetmap.org/node/${index}`,
      osmType: "node" as const,
      osmId: index,
    }));
    const capped = capPlacesForMap(
      [
        ...many,
        {
          id: "osm:node:99",
          title: "Night Pharmacy",
          kind: "pharmacy",
          latitude: TAMPA_DEMO_CENTER.latitude,
          longitude: TAMPA_DEMO_CENTER.longitude + 0.002,
          source: "OpenStreetMap contributors",
          description: "Pharmacy",
          href: "https://www.openstreetmap.org/node/99",
          osmType: "node",
          osmId: 99,
        },
      ],
      TAMPA_DEMO_CENTER,
    );
    expect(capped.filter((pin) => pin.kind === "grocery")).toHaveLength(
      PLACE_PER_KIND_CAP,
    );
    expect(capped.some((pin) => pin.kind === "pharmacy")).toBe(true);
  });

  it("asks Overpass for pharmacy, grocery, and assembly points — not picnic amenity=shelter", () => {
    const query = overpassPlacesQuery(TAMPA_DEMO_CENTER, 3.5);
    expect(query).toContain('amenity"="pharmacy');
    expect(query).toContain("supermarket");
    expect(query).toContain("assembly_point");
    expect(query).not.toContain('amenity"="shelter');
  });

  it("parses Nominatim (OSM search) hospitals and groceries", () => {
    const pins = parseNominatimPlaces([
      {
        osm_type: "node",
        osm_id: 99,
        lat: "27.95",
        lon: "-82.46",
        category: "amenity",
        type: "hospital",
        name: "Tampa General",
      },
      {
        osm_type: "way",
        osm_id: 100,
        lat: 27.96,
        lon: -82.45,
        class: "shop",
        type: "supermarket",
        display_name: "Publix, Downtown, Tampa",
      },
    ]);
    expect(pins.map((pin) => pin.kind)).toEqual(["hospital", "grocery"]);
    expect(pins[0]?.title).toBe("Tampa General");
    expect(pins[1]?.href).toContain("openstreetmap.org/way/100");
  });
});

describe("GET /api/map-places", () => {
  it("rejects a missing location without inventing shops", async () => {
    const response = await getMapPlaces(
      new Request("http://localhost/api/map-places"),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.pins).toEqual([]);
    expect(body.service).toBe("osm");
  });
});

describe("fetchOsmPlaces OSM fallbacks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses another Overpass mirror when the first OpenStreetMap endpoint fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        if (href.includes("overpass-api.de")) {
          return {
            ok: false,
            status: 504,
            json: async () => ({}),
          };
        }
        if (href.includes("overpass")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              elements: [
                {
                  type: "node",
                  id: 7,
                  lat: 27.95,
                  lon: -82.46,
                  tags: { amenity: "hospital", name: "Bay Hospital" },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 500, json: async () => ({}) };
      }),
    );

    const result = await fetchOsmPlaces({
      latitude: 27.9506,
      longitude: -82.4572,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pins[0]?.kind).toBe("hospital");
    expect(result.pins[0]?.title).toBe("Bay Hospital");
  });

  it("falls back to OSM Nominatim search when Overpass returns no elements", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        if (href.includes("overpass")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ elements: [] }),
          };
        }
        if (href.includes("nominatim") && href.includes("hospital")) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                osm_type: "node",
                osm_id: 11,
                lat: "27.95",
                lon: "-82.46",
                category: "amenity",
                type: "hospital",
                name: "Tampa General Hospital",
              },
            ],
          };
        }
        return { ok: true, status: 200, json: async () => [] };
      }),
    );

    const result = await fetchOsmPlaces({
      latitude: 27.9506,
      longitude: -82.4572,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pins.some((pin) => pin.kind === "hospital")).toBe(true);
  });
});
