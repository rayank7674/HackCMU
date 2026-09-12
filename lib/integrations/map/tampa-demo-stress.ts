/**
 * Demo overlay from the Tampa household fixture.
 * Uses lib/stress simulate + buildHouseholdGraph. Labeled simulated, not live NWS.
 */

import { TAMPA_DEMO_HOME, TAMPA_DEMO_HOUSEHOLD } from "@/lib/fixtures/tampa-demo";
import {
  buildHouseholdGraph,
  presetById,
  simulate,
  type DependencyGraph,
  type StressResult,
} from "@/lib/stress";
import type { LatLon } from "@/lib/map/location";
import {
  layoutStressOverlay,
  type StressOverlayModel,
} from "@/lib/integrations/geo/stress-overlay";

export const TAMPA_DEMO_OVERLAY_LABEL =
  "Tampa fixture overlay — simulated, not live NWS.";

export type TampaDemoStressOverlay = {
  result: StressResult;
  graph: DependencyGraph;
  overlay: StressOverlayModel;
  label: typeof TAMPA_DEMO_OVERLAY_LABEL;
};

export function tampaDemoStressScenario() {
  const scenario = presetById("tampa-demo");
  if (!scenario) {
    throw new Error("Missing tampa-demo stress preset.");
  }
  return scenario;
}

/** Engine call only — does not redefine propagation math. */
export function simulateTampaDemoStress(): {
  result: StressResult;
  graph: DependencyGraph;
} {
  const graph = buildHouseholdGraph(TAMPA_DEMO_HOME, TAMPA_DEMO_HOUSEHOLD);
  const result = simulate(graph, tampaDemoStressScenario());
  return { graph, result };
}

export function buildTampaDemoStressOverlay(
  anchor: LatLon,
): TampaDemoStressOverlay {
  const { graph, result } = simulateTampaDemoStress();
  return {
    result,
    graph,
    overlay: layoutStressOverlay({
      result,
      anchor,
      edges: graph.edges,
    }),
    label: TAMPA_DEMO_OVERLAY_LABEL,
  };
}
