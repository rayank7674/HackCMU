import { describe, expect, it } from "vitest";
import { optimizePreparednessPlan, recommend } from "@/lib/stormready";
import {
  allClearHazards,
  makeHazard,
  makeHazards,
  makeHome,
  makeHousehold,
} from "../rules/helpers";
import type { PreparednessAction } from "@/lib/optimization";

function action(
  overrides: Partial<PreparednessAction> & Pick<PreparednessAction, "id">,
): PreparednessAction {
  const units = overrides.estimatedCostUnits ?? overrides.estimatedCostDollars ?? 0;
  const { estimatedCostUnits: _u, estimatedCostDollars: _d, ...rest } = overrides;
  return {
    ruleId: overrides.id,
    title: overrides.id,
    body: "body",
    rationale: "rationale",
    priority: "medium",
    category: "supplies",
    hazardKinds: ["hurricane"],
    horizon: "now",
    official: false,
    hardConstraint: false,
    costClass: "zero",
    estimatedTimeMinutes: 15,
    estimatedCostRange: { min: 0, max: units },
    costEstimateSource: "planning_assumption",
    costEstimateConfidence: "low",
    utility: 0.5,
    urgency: 0.5,
    hazardRelevance: 0.5,
    householdFit: 0.5,
    requiresTransportation: false,
    generatorAcquisition: false,
    transportReadiness: false,
    constraintEffects: [],
    ...rest,
    estimatedCostUnits: units,
    estimatedCostDollars: units,
    id: overrides.id,
  };
}

describe("Chief of Staff knapsack constraints", () => {
  it("forces official / evacuate / warning actions into the selected set", () => {
    const result = optimizePreparednessPlan(
      [
        action({
          id: "official.warning",
          official: true,
          hardConstraint: true,
          category: "evacuate",
          priority: "critical",
          utility: 0.1,
          estimatedCostUnits: 3,
        }),
        action({
          id: "pricey.disc",
          utility: 0.99,
          estimatedCostUnits: 1,
          costClass: "low",
        }),
      ],
      { budgetUnits: 0, availableTimeMinutes: 15, transport: "none" },
      { hasBackupPower: false },
    );
    expect(result.selectedIds[0]).toBe("official.warning");
    expect(result.hardConstraintIds).toContain("official.warning");
    expect(result.selectedIds).not.toContain("pricey.disc");
  });

  it("zero budget class keeps official and only no-cost discretionary", () => {
    const result = recommend({
      home: makeHome({
        roofAgeYears: 30,
        hasHurricaneShutters: false,
        hasBackupPower: false,
      }),
      household: makeHousehold({ budgetClass: "zero" }),
      hazards: makeHazards([
        makeHazard({
          kind: "hurricane",
          severity: "warning",
          headline: "Hurricane Warning",
          instruction: "Evacuate coastal zones.",
        }),
      ]),
    });
    expect(result.recommendations[0]?.official).toBe(true);
    const discretionary = result.recommendations.filter((rec) => !rec.official);
    expect(discretionary.every((rec) => rec.costClass === "zero")).toBe(true);
    expect(result.optimization?.constraintsUsed.budgetUnits).toBe(0);
  });

  it("does not treat an unknown roof as fine", () => {
    const result = recommend({
      home: makeHome({ roofAgeYears: "unknown", yearBuilt: 2019 }),
      household: makeHousehold(),
      hazards: makeHazards([
        makeHazard({
          kind: "hurricane",
          severity: "watch",
          headline: "Hurricane Watch",
        }),
      ]),
    });
    expect(result.matchedRuleIds).toContain("hurricane.unknown_roof");
    expect(result.matchedRuleIds).not.toContain("hurricane.old_roof");
  });

  it("knapsack never drops a hard constraint to make room for discretionary utility", () => {
    const result = optimizePreparednessPlan(
      [
        action({
          id: "hard.evac",
          hardConstraint: true,
          official: true,
          category: "evacuate",
          priority: "critical",
          utility: 0.01,
          estimatedCostUnits: 0,
        }),
        ...Array.from({ length: 8 }, (_, i) =>
          action({
            id: `disc.${i}`,
            utility: 0.99 - i * 0.01,
            estimatedCostUnits: 0,
          }),
        ),
      ],
      { budgetUnits: 3, availableTimeMinutes: null, transport: "car" },
      { hasBackupPower: false },
    );
    expect(result.selectedIds[0]).toBe("hard.evac");
    expect(result.selected.length).toBeLessThanOrEqual(5);
    expect(result.selected.every((item) => item.id !== undefined)).toBe(true);
    expect(result.hardCount).toBeGreaterThanOrEqual(1);
  });

  it("all-clear quiet plan still returns a 3–5 selected set", () => {
    const result = recommend({
      home: makeHome(),
      household: makeHousehold({ budgetClass: "low" }),
      hazards: allClearHazards(),
    });
    expect(result.status).toBe("ok");
    expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(result.recommendations.length).toBeLessThanOrEqual(5);
    expect(result.optimization?.rejected.length).toBeGreaterThan(0);
  });
});
