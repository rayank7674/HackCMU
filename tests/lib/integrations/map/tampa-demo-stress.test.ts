import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_OVERLAY_CLAIMS,
  MODELED_DEPENDENCIES_DISCLAIMER,
  OVERLAY_SIMULATED_NOTE,
  layoutStressOverlay,
  offsetFromAnchor,
  overlayHasContent,
  overlayPointsAsLatLon,
} from "@/lib/integrations/geo/stress-overlay";
import {
  TAMPA_DEMO_OVERLAY_LABEL,
  buildTampaDemoStressOverlay,
  simulateTampaDemoStress,
  tampaDemoStressScenario,
} from "@/lib/integrations/map/tampa-demo-stress";
import { TAMPA_DEMO_CENTER } from "@/lib/map/location";
import { BASELINE_SCENARIO } from "@/lib/stress";

const ANCHOR = { latitude: 27.9506, longitude: -82.4572 };

function overlayCopy(overlay: ReturnType<typeof layoutStressOverlay>): string {
  return [
    overlay.disclaimer,
    overlay.simulatedNote,
    overlay.scenarioLabel,
    ...overlay.points.map((point) => point.label),
    TAMPA_DEMO_OVERLAY_LABEL,
    MODELED_DEPENDENCIES_DISCLAIMER,
    OVERLAY_SIMULATED_NOTE,
  ]
    .join(" ")
    .toLowerCase();
}

describe("modeled stress geo overlay", () => {
  it("does not treat a missing stress result as an overlay", () => {
    expect(overlayHasContent(undefined)).toBe(false);
    expect(overlayHasContent(null)).toBe(false);
    expect(overlayPointsAsLatLon(null)).toEqual([]);
  });

  it("lays out nodes as schematic offsets, not as the exact anchor except home", () => {
    const { result, graph } = simulateTampaDemoStress();
    const overlay = layoutStressOverlay({
      result,
      anchor: ANCHOR,
      edges: graph.edges,
    });
    const home = overlay.points.find((point) => point.id === "home");
    const power = overlay.points.find((point) => point.id === "power");

    expect(home?.latitude).toBe(ANCHOR.latitude);
    expect(home?.longitude).toBe(ANCHOR.longitude);
    expect(home?.schematic).toBe(true);
    expect(power).toBeDefined();
    expect(power?.latitude).not.toBe(ANCHOR.latitude);
    expect(power?.longitude).not.toBe(ANCHOR.longitude);
    expect(overlay.officialInfrastructure).toBe(false);
    expect(overlay.forecast).toBe(false);
    expect(overlay.modeled).toBe(true);
    expect(overlay.disclaimer).toBe(MODELED_DEPENDENCIES_DISCLAIMER);
    expect(overlay.links.some((link) => link.kind === "modeled_edge")).toBe(
      true,
    );
  });

  it("is deterministic for the same result and anchor", () => {
    const { result, graph } = simulateTampaDemoStress();
    const a = layoutStressOverlay({ result, anchor: ANCHOR, edges: graph.edges });
    const b = layoutStressOverlay({ result, anchor: ANCHOR, edges: graph.edges });
    expect(a.points).toEqual(b.points);
    expect(a.links).toEqual(b.links);
  });

  it("offsets by heading without claiming a utility site", () => {
    const moved = offsetFromAnchor(TAMPA_DEMO_CENTER, 45, 520);
    expect(moved.latitude).not.toBe(TAMPA_DEMO_CENTER.latitude);
    expect(moved.longitude).not.toBe(TAMPA_DEMO_CENTER.longitude);
  });
});

describe("Tampa demo stress overlay", () => {
  it("calls the stress engine for a simulated, not-live-NWS scenario", () => {
    const scenario = tampaDemoStressScenario();
    expect(scenario.id).toBe("tampa-demo");
    expect(scenario.label.toLowerCase()).toMatch(/not live nws/);

    const { result } = simulateTampaDemoStress();
    expect(result.modeled).toBe(true);
    expect(result.forecast).toBe(false);
    expect(result.scenario.id).toBe("tampa-demo");
    expect(overlayHasContent(result)).toBe(true);

    const demo = buildTampaDemoStressOverlay(ANCHOR);
    expect(demo.label).toBe(TAMPA_DEMO_OVERLAY_LABEL);
    expect(demo.overlay.scenarioLabel).toBe(result.scenario.label);
    expect(demo.overlay.points.length).toBe(result.nodes.length);

    const copy = overlayCopy(demo.overlay);
    expect(copy).toContain("modeled dependencies — not official infrastructure.");
    expect(copy).toContain("simulated");
    expect(copy).toContain("not live nws");
    for (const claim of FORBIDDEN_OVERLAY_CLAIMS) {
      expect(copy).not.toContain(claim);
    }
  });

  it("does not use the baseline as the Tampa demo overlay", () => {
    expect(tampaDemoStressScenario().id).not.toBe(BASELINE_SCENARIO.id);
  });
});
