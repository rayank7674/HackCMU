import { describe, expect, it } from "vitest";
import { cascadeSteps, provenanceLabel } from "@/lib/stress/cascade";
import { buildHouseholdGraph } from "@/lib/stress/graph";
import { simulate } from "@/lib/stress/propagate";
import { presetById } from "@/lib/stress/presets";
import { makeHome, makeHousehold } from "../rules/helpers";
import { DISCLAIMER } from "@/lib/stress/propagate";

describe("cascade labeling", () => {
  it("labels cascade nodes and keeps modeled provenance", () => {
    const result = simulate(
      buildHouseholdGraph(
        makeHome({ hasBackupPower: false }),
        makeHousehold({ vehicleCount: 1, canSelfEvacuate: true }),
      ),
      presetById("power-12h")!,
    );
    const steps = cascadeSteps(result);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((step) => step.label && step.label !== "")).toBe(true);
    expect(steps.some((step) => /rule\./i.test(step.label))).toBe(false);
    expect(result.forecast).toBe(false);
    expect(DISCLAIMER.toLowerCase()).toMatch(/not a forecast/);
    expect(DISCLAIMER.toLowerCase()).toMatch(/not a forecast, safety score/);
    expect(provenanceLabel("modeled")).toBe("Modeled");
    expect(provenanceLabel("user_reported")).toBe("User reported");
  });
});
