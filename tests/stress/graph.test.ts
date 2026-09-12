import { describe, expect, it } from "vitest";
import { createEmptyHomeProfile, createEmptyHouseholdProfile } from "@/lib/stormready";
import { TAMPA_DEMO_HOME, TAMPA_DEMO_HOUSEHOLD } from "@/lib/fixtures/tampa-demo";
import {
  buildHouseholdGraph,
  scenarioIncludesLocalFeeder,
} from "@/lib/stress/graph";
import { presetById } from "@/lib/stress/presets";

function home(overrides: Partial<ReturnType<typeof createEmptyHomeProfile>> = {}) {
  return createEmptyHomeProfile({
    dwellingType: "single_family",
    stories: 1,
    hasBackupPower: false,
    ...overrides,
  });
}

function household(
  overrides: Partial<ReturnType<typeof createEmptyHouseholdProfile>> = {},
) {
  return createEmptyHouseholdProfile({
    vehicleCount: 1,
    canSelfEvacuate: true,
    ...overrides,
  });
}

describe("buildHouseholdGraph", () => {
  it("labels the graph as modeled, not official infrastructure", () => {
    const graph = buildHouseholdGraph(home(), household());
    expect(graph.assumptions.some((line) => /not official/i.test(line))).toBe(
      true,
    );
    expect(graph.edges.every((edge) => edge.source !== "official")).toBe(true);
  });

  it("does not add a charging failure path when backup power is unknown", () => {
    const graph = buildHouseholdGraph(
      home({ hasBackupPower: "unknown" }),
      household(),
    );
    expect(graph.nodes.some((node) => node.id === "charging")).toBe(false);
    expect(
      graph.assumptions.some((line) => /unknown is not treated as no generator/i.test(line)),
    ).toBe(true);
  });

  it("adds charging when the user reported no backup power", () => {
    const graph = buildHouseholdGraph(
      home({ hasBackupPower: false }),
      household(),
    );
    expect(graph.nodes.some((node) => node.id === "charging")).toBe(true);
    expect(
      graph.edges.some((edge) => edge.from === "power" && edge.to === "charging"),
    ).toBe(true);
  });

  it("does not add elevator unless apartment stories are known and >= 5", () => {
    const unknown = buildHouseholdGraph(
      home({ dwellingType: "apartment", stories: "unknown" }),
      household(),
    );
    expect(unknown.nodes.some((node) => node.id === "elevator")).toBe(false);

    const low = buildHouseholdGraph(
      home({ dwellingType: "apartment", stories: 3 }),
      household(),
    );
    expect(low.nodes.some((node) => node.id === "elevator")).toBe(false);

    const high = buildHouseholdGraph(
      home({ dwellingType: "apartment", stories: 8 }),
      household(),
    );
    expect(high.nodes.some((node) => node.id === "elevator")).toBe(true);
  });

  it("does not treat unknown vehicles as no car", () => {
    const graph = buildHouseholdGraph(
      home(),
      household({ vehicleCount: "unknown", canSelfEvacuate: "unknown" }),
    );
    const transport = graph.nodes.find((node) => node.id === "transport");
    expect(transport?.ownCapacity).toBe(100);
  });

  it("lowers modeled transport when the user reported zero vehicles", () => {
    const graph = buildHouseholdGraph(home(), household({ vehicleCount: 0 }));
    const transport = graph.nodes.find((node) => node.id === "transport");
    expect(transport?.ownCapacity).toBe(40);
    expect(transport?.source).toBe("user_reported");
  });

  it("builds a Tampa demo graph with modeled road and power nodes", () => {
    const graph = buildHouseholdGraph(TAMPA_DEMO_HOME, TAMPA_DEMO_HOUSEHOLD);
    expect(graph.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["power", "road", "transport", "mobility"]),
    );
  });

  it("includes a roof node when roof age is old or unknown", () => {
    const unknownRoof = buildHouseholdGraph(
      home({ roofAgeYears: "unknown" }),
      household(),
    );
    const oldRoof = buildHouseholdGraph(home({ roofAgeYears: 22 }), household());
    const unknown = unknownRoof.nodes.find((node) => node.id === "roof");
    const old = oldRoof.nodes.find((node) => node.id === "roof");
    expect(unknown).toBeDefined();
    expect(old).toBeDefined();
    expect(unknown?.ownCapacity).toBeLessThan(90);
    expect(old?.ownCapacity).toBeLessThan(unknown?.ownCapacity ?? 100);
    expect(unknownRoof.assumptions.join(" ")).toMatch(/unknown is not treated as a new roof/i);
  });

  it("adds a modeled local feeder only on the power-outage path", () => {
    const power = buildHouseholdGraph(home(), household(), { includeLocalFeeder: true });
    const water = buildHouseholdGraph(home(), household(), { includeLocalFeeder: false });
    expect(power.nodes.some((node) => node.id === "local_feeder")).toBe(true);
    expect(power.edges.some((edge) => edge.from === "local_feeder" && edge.to === "power")).toBe(
      true,
    );
    expect(power.assumptions.join(" ")).toMatch(/not a real utility map/i);
    expect(water.nodes.some((node) => node.id === "local_feeder")).toBe(false);
    expect(scenarioIncludesLocalFeeder(presetById("power-12h")!)).toBe(true);
    expect(scenarioIncludesLocalFeeder(presetById("water")!)).toBe(false);
    expect(scenarioIncludesLocalFeeder(presetById("flood-road")!)).toBe(false);
  });
});
