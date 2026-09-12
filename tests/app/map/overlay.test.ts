import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

describe("map page has no Milton overlay", () => {
  it("renders MapView with posted hours and no replay toggle", () => {
    const page = read("app/map/page.tsx");
    const mapView = read("components/map/map-view.tsx");
    expect(page).toContain("MapView");
    expect(page).not.toContain("MapStressShell");
    expect(mapView).toContain("fetchPlaceHours");
    expect(mapView).toContain("hoursByPinId={hoursByPinId}");
    expect(mapView).not.toContain("MapStressLegend");
    expect(mapView).not.toContain("scorePlacesUnderHour");
    expect(mapView).not.toContain("Replay Hurricane Milton");
    expect(mapView).not.toContain("pinsForView");
    expect(mapView).not.toContain("TAMPA_RESOURCE_PINS");
  });
});
