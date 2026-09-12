import { describe, expect, it } from "vitest";
import { createEmptyHomeProfile, createEmptyHouseholdProfile } from "@/lib/stormready";
import { buildHouseholdGraph } from "@/lib/stress/graph";
import { simulate } from "@/lib/stress/propagate";
import { BASELINE_SCENARIO, presetById } from "@/lib/stress/presets";

function home(
  overrides: Partial<ReturnType<typeof createEmptyHomeProfile>> = {},
) {
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

describe("simulate", () => {
  it("is labeled modeled and not a forecast", () => {
    const result = simulate(
      buildHouseholdGraph(home(), household()),
      BASELINE_SCENARIO,
    );
    expect(result.modeled).toBe(true);
    expect(result.forecast).toBe(false);
    expect(result.assumptions.join(" ")).toMatch(/not a forecast/i);
  });

  it("keeps household access high at baseline", () => {
    const result = simulate(
      buildHouseholdGraph(home({ hasBackupPower: true }), household()),
      BASELINE_SCENARIO,
    );
    expect(result.disruptionLevel).toBe("none");
    expect(result.householdAccess).toBeGreaterThanOrEqual(80);
  });

  it("propagates grid loss into charging when backup is confirmed absent", () => {
    const result = simulate(
      buildHouseholdGraph(home({ hasBackupPower: false }), household()),
      presetById("power-12h")!,
    );
    const charging = result.nodes.find((node) => node.id === "charging");
    const comms = result.nodes.find((node) => node.id === "communication");
    expect(charging?.level).not.toBe("none");
    expect(comms?.level).not.toBe("none");
    expect(result.cascadePath.length).toBeGreaterThan(0);
  });

  it("does not fail communication from grid loss when backup power is unknown", () => {
    const result = simulate(
      buildHouseholdGraph(home({ hasBackupPower: "unknown" }), household()),
      presetById("power-12h")!,
    );
    const comms = result.nodes.find((node) => node.id === "communication");
    expect(comms?.level).toBe("none");
  });

  it("disrupts elevator then mobility in a tall apartment", () => {
    const result = simulate(
      buildHouseholdGraph(
        home({
          dwellingType: "apartment",
          stories: 8,
          hasBackupPower: true,
        }),
        household(),
      ),
      presetById("power-12h")!,
    );
    const elevator = result.nodes.find((node) => node.id === "elevator");
    const mobility = result.nodes.find((node) => node.id === "mobility");
    expect(elevator?.level).not.toBe("none");
    expect(mobility?.level).not.toBe("none");
    expect(result.cascadePath).toEqual(
      expect.arrayContaining(["elevator", "mobility"]),
    );
  });

  it("starts a power outage at the modeled feeder when present", () => {
    const graph = buildHouseholdGraph(home({ hasBackupPower: true }), household(), {
      includeLocalFeeder: true,
    });
    const result = simulate(graph, presetById("power-12h")!);
    const feeder = result.nodes.find((node) => node.id === "local_feeder");
    const power = result.nodes.find((node) => node.id === "power");
    expect(feeder?.capacity).toBe(0);
    expect(power?.capacity).toBe(0);
    expect(result.assumptions.join(" ")).toMatch(/not a real utility map/i);
  });

  it("does not claim a feeder on a non-power water scenario", () => {
    const graph = buildHouseholdGraph(home(), household(), { includeLocalFeeder: false });
    const result = simulate(graph, presetById("water")!);
    expect(result.nodes.some((node) => node.id === "local_feeder")).toBe(false);
    expect(result.assumptions.join(" ")).not.toMatch(/not a real utility map/i);
  });

  it("is deterministic", () => {
    const graph = buildHouseholdGraph(home(), household());
    const scenario = presetById("wind-power")!;
    const a = simulate(graph, scenario);
    const b = simulate(graph, scenario);
    expect(a).toEqual(b);
  });
});
