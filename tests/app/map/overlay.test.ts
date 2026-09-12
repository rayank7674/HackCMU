import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MODELED_DEPENDENCIES_DISCLAIMER } from "@/lib/integrations/geo/stress-overlay";

const ROOT = path.resolve(__dirname, "../../..");

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

describe("map page stress overlay wiring", () => {
  it("keeps MapView overlay optional so a bare map has no modeled layer", () => {
    const mapView = read("components/map/map-view.tsx");
    expect(mapView).toMatch(/stressOverlay = null/);
    expect(mapView).toMatch(/stressOverlay=\{stressOverlay\}/);
    expect(mapView).toContain("MapStressLegend");
  });

  it("uses the Lane C shell so overlay starts off", () => {
    const page = read("app/map/page.tsx");
    const shell = read("components/stormready/map-stress-shell.tsx");
    expect(page).toContain("MapStressShell");
    expect(page).not.toMatch(/MapView \/>/);
    expect(shell).toContain("useState(false)");
    expect(shell).toContain("buildTampaDemoStressOverlay");
  });

  it("shows the non-authoritative legend copy", () => {
    const legend = read("components/stormready/map-stress-legend.tsx");
    expect(legend).toContain("MODELED_DEPENDENCIES_DISCLAIMER");
    expect(MODELED_DEPENDENCIES_DISCLAIMER).toBe(
      "Modeled dependencies — not official infrastructure.",
    );
    expect(legend.toLowerCase()).not.toContain("utility topology");
  });
});
