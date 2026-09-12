import { describe, expect, it } from "vitest";
import { createEmptyHomeProfile, createEmptyHouseholdProfile } from "@/lib/stormready";
import {
  findMinimumBreakdown,
  findWorstCase,
  perturbationCount,
} from "@/lib/stress/search";
import { rankDisruption } from "@/lib/stress/propagate";
import type { SearchBounds } from "@/lib/stress/types";

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

describe("bounded search", () => {
  it("finds a minimum breakdown that crosses major disruption", () => {
    const found = findMinimumBreakdown(home(), household());
    expect(found.status).toBe("found");
    if (found.status !== "found") return;
    expect(rankDisruption(found.result.disruptionLevel)).toBeGreaterThanOrEqual(2);
    expect(found.result.forecast).toBe(false);
    expect(found.perturbationCount).toBe(perturbationCount(found.scenario));
  });

  it("respects tight bounds and can report no_breakdown", () => {
    const bounds: SearchBounds = {
      power: [100],
      road: [100],
      transport: ["unchanged"],
    };
    const miss = findMinimumBreakdown(
      home({ hasBackupPower: true }),
      household({ vehicleCount: 2, canSelfEvacuate: true }),
      bounds,
    );
    expect(miss.status).toBe("no_breakdown");
  });

  it("returns identical minimums for identical inputs", () => {
    const a = findMinimumBreakdown(home(), household());
    const b = findMinimumBreakdown(home(), household());
    expect(a).toEqual(b);
  });

  it("worst case is at least as severe as the minimum breakdown", () => {
    const min = findMinimumBreakdown(home(), household());
    const worst = findWorstCase(home(), household());
    expect(worst.status).toBe("found");
    expect(rankDisruption(worst.result.disruptionLevel)).toBeGreaterThanOrEqual(
      min.status === "found" ? rankDisruption(min.result.disruptionLevel) : 0,
    );
    expect(worst.result.assumptions.join(" ")).toMatch(/not a forecast/i);
  });

  it("minimum prefers fewer perturbed axes than an unconstrained worst case", () => {
    const min = findMinimumBreakdown(home(), household());
    const worst = findWorstCase(home(), household());
    if (min.status !== "found") return;
    expect(min.perturbationCount).toBeLessThanOrEqual(worst.perturbationCount);
  });
});
