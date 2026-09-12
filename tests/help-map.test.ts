import { describe, expect, it } from "vitest";
import {
  FINANCIAL_ASSISTANCE_INTRO,
  FINANCIAL_LINKS,
  FORBIDDEN_HELP_PROMISES,
  HOW_STORMREADY_WORKS,
  LOCAL_HELP_EXAMPLE_NOTE,
  LOCAL_HELP_LINKS,
  PREPAREDNESS_LINKS,
  REGIONAL_EXAMPLE_LINKS,
  SAFETY_DISCLAIMER,
} from "@/lib/help/content";
import { emptyGeocodedLocation } from "@/lib/stormready";
import {
  APPROXIMATE_OFFSET_METERS,
  TAMPA_DEMO_CENTER,
  approximateHomeLocation,
  distanceKm,
  isNearTampa,
  knownCoordinates,
  pointsForBounds,
  resolveMapView,
} from "@/lib/map/location";
import {
  FORBIDDEN_MAP_LABELS,
  MAP_LOCATOR_LINKS,
  TAMPA_RESOURCE_PINS,
  getMapTileLayer,
  pinsForView,
} from "@/lib/map/resources";

function allHelpLinks() {
  return [
    ...PREPAREDNESS_LINKS,
    ...LOCAL_HELP_LINKS,
    ...REGIONAL_EXAMPLE_LINKS,
    ...FINANCIAL_LINKS,
  ];
}

describe("Help official resources", () => {
  it("labels every outbound link with a source", () => {
    for (const link of allHelpLinks()) {
      expect(link.source.trim().length).toBeGreaterThan(3);
      expect(link.href).toMatch(/^https:\/\//);
    }
  });

  it("uses may-be-eligible wording and never promises eligibility", () => {
    expect(FINANCIAL_ASSISTANCE_INTRO.toLowerCase()).toContain("may be eligible");
    const corpus = [
      FINANCIAL_ASSISTANCE_INTRO,
      ...FINANCIAL_LINKS.map((link) => `${link.title} ${link.description}`),
    ]
      .join(" ")
      .toLowerCase();

    for (const phrase of FORBIDDEN_HELP_PROMISES) {
      expect(corpus).not.toContain(phrase);
    }
  });

  it("describes the current product including optional Save My Plan", () => {
    const how = HOW_STORMREADY_WORKS.join(" ");
    expect(how).toMatch(/No account is required/);
    expect(how).toMatch(/Save My Plan/);
    expect(how).toMatch(/Map tab/);
    expect(how).not.toMatch(/later save flow|Phase 1 placeholder/i);
  });

  it("labels Tampa / Florida local links as examples", () => {
    expect(LOCAL_HELP_EXAMPLE_NOTE.toLowerCase()).toContain("example");
    const tampa = REGIONAL_EXAMPLE_LINKS.filter((link) =>
      /florida|hillsborough|tampa/i.test(`${link.title} ${link.source}`),
    );
    expect(tampa.length).toBeGreaterThan(0);
    for (const link of tampa) {
      expect(link.source.toLowerCase()).toMatch(/example/);
    }
  });

  it("binds Help to the saved address instead of a static Tampa list", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const view = readFileSync(
      resolve(process.cwd(), "components/help/help-view.tsx"),
      "utf8",
    );
    expect(view).toContain("resolveLocalHelp");
    expect(view).toContain("Local numbers");
    expect(view).toContain("formatLocation");
    expect(view).not.toContain("Hillsborough County Emergency Management");
  });

  it("says StormReady is not a substitute for official orders", () => {
    expect(SAFETY_DISCLAIMER).toMatch(/not a substitute for official orders/i);
    expect(SAFETY_DISCLAIMER).toMatch(/evacuate/i);
  });
});

describe("Map location and tiles", () => {
  it("treats unknown geocode as no coordinates", () => {
    expect(knownCoordinates(emptyGeocodedLocation())).toBeNull();
    expect(knownCoordinates(null)).toBeNull();
  });

  it("offsets a known home location instead of pinning the exact point", () => {
    const exact = { latitude: 28.0587, longitude: -82.4139 };
    const approx = approximateHomeLocation(exact.latitude, exact.longitude);
    const meters = distanceKm(exact, approx) * 1000;

    expect(approx.latitude).not.toBe(exact.latitude);
    expect(approx.longitude).not.toBe(exact.longitude);
    expect(meters).toBeGreaterThan(APPROXIMATE_OFFSET_METERS * 0.5);
    expect(meters).toBeLessThan(APPROXIMATE_OFFSET_METERS * 1.6);
    expect(approximateHomeLocation(exact.latitude, exact.longitude)).toEqual(
      approx,
    );
  });

  it("centers on Tampa when no location and hides demo pins far away", () => {
    const empty = resolveMapView(emptyGeocodedLocation());
    expect(empty.hasHomeLocation).toBe(false);
    expect(empty.center).toEqual(TAMPA_DEMO_CENTER);
    expect(empty.showTampaExamplePins).toBe(true);
    expect(isNearTampa({ latitude: 28.0587, longitude: -82.4139 })).toBe(true);

    const distant = resolveMapView({
      ...emptyGeocodedLocation(),
      latitude: 40.7128,
      longitude: -74.006,
      provenance: "external_source",
    });
    expect(distant.hasHomeLocation).toBe(true);
    expect(distant.showTampaExamplePins).toBe(false);
    expect(distant.approximateHome).not.toBeNull();
    expect(pinsForView(distant.showTampaExamplePins)).toEqual([]);
    expect(pointsForBounds(null, TAMPA_RESOURCE_PINS)).toHaveLength(
      TAMPA_RESOURCE_PINS.length,
    );
    expect(pointsForBounds(empty.center, TAMPA_RESOURCE_PINS)).toHaveLength(
      TAMPA_RESOURCE_PINS.length + 1,
    );
  });

  it("defaults to OpenStreetMap tiles without a Mapbox token", () => {
    const osm = getMapTileLayer({});
    expect(osm.provider).toBe("osm");
    expect(osm.url).toContain("tile.openstreetmap.org");

    const mapbox = getMapTileLayer({
      NEXT_PUBLIC_MAPBOX_TOKEN: "pk.test",
    });
    expect(mapbox.provider).toBe("mapbox");
    expect(mapbox.url).toContain("api.mapbox.com");
    expect(mapbox.url).toContain("pk.test");
  });

  it("keeps resource pins honest: sourced, example-only, never verified or best", () => {
    expect(TAMPA_RESOURCE_PINS.length).toBeGreaterThan(0);
    for (const pin of TAMPA_RESOURCE_PINS) {
      expect(pin.example).toBe(true);
      expect(pin.source.trim().length).toBeGreaterThan(3);
      const blob = `${pin.title} ${pin.description} ${pin.source}`.toLowerCase();
      for (const word of FORBIDDEN_MAP_LABELS) {
        expect(blob).not.toContain(word);
      }
    }
    for (const link of MAP_LOCATOR_LINKS) {
      expect(link.source.trim().length).toBeGreaterThan(3);
      expect(link.href).toMatch(/^https:\/\//);
    }
  });
});
