import { describe, expect, it } from "vitest";
import {
  diffOptimizationResults,
  titleForOptimizationId,
  type OptimizationConstraints,
  type OptimizationResult,
  type PreparednessAction,
} from "@/lib/optimization";

function action(
  overrides: Partial<PreparednessAction> & Pick<PreparednessAction, "id" | "title">,
): PreparednessAction {
  const units = overrides.estimatedCostUnits ?? 0;
  return {
    ruleId: overrides.ruleId ?? overrides.id,
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
    estimatedCostRange: { min: 0, max: 0 },
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
    estimatedCostUnits: units,
    estimatedCostDollars: units,
    ...overrides,
    id: overrides.id,
  };
}

const constraints = (
  extra: Partial<OptimizationConstraints> = {},
): OptimizationConstraints => ({
  budgetUnits: 3,
  budgetDollars: 3,
  availableTimeMinutes: null,
  transport: "car",
  ...extra,
});

function resultFrom(selected: PreparednessAction[], used = constraints()): OptimizationResult {
  return {
    solver: "knapsack_dp",
    objective: "maximize_preparedness_utility",
    selected,
    selectedIds: selected.map((item) => item.id),
    rejected: [],
    candidates: selected.map((item) => ({
      id: item.id,
      ruleId: item.ruleId,
      title: item.title,
      category: item.category,
      hardConstraint: item.hardConstraint,
      official: item.official,
      selected: true,
      utility: item.utility,
      estimatedCostUnits: item.estimatedCostUnits,
      estimatedCostDollars: item.estimatedCostDollars,
      estimatedTimeMinutes: item.estimatedTimeMinutes,
    })),
    hardConstraintIds: selected.filter((item) => item.hardConstraint).map((item) => item.id),
    constraintsUsed: used,
    planningCostUnits: selected.reduce((sum, item) => sum + item.estimatedCostUnits, 0),
    planningCostDollars: selected.reduce((sum, item) => sum + item.estimatedCostUnits, 0),
    planningMinutes: selected.reduce((sum, item) => sum + item.estimatedTimeMinutes, 0),
    hardCount: selected.filter((item) => item.hardConstraint).length,
    discretionaryCount: selected.filter((item) => !item.hardConstraint).length,
    notes: [],
    shortfall: null,
  };
}

describe("optimization diff titles and rank", () => {
  it("resolves titles from selected rather than dumping rule ids", () => {
    const kit = action({
      id: "kit",
      ruleId: "supplies.go_bag",
      title: "Pack a go-bag",
    });
    const radio = action({
      id: "radio",
      ruleId: "comms.radio",
      title: "Get a hand-crank radio",
    });
    const before = resultFrom([kit]);
    const after = resultFrom([kit, radio], constraints({ budgetUnits: 2, budgetDollars: 2 }));
    const diff = diffOptimizationResults(before, after);
    expect(diff.addedIds).toEqual(["radio"]);
    expect(diff.addedTitles).toEqual(["Get a hand-crank radio"]);
    expect(diff.summary).toContain("Get a hand-crank radio");
    expect(diff.summary).not.toContain("comms.radio");
    expect(titleForOptimizationId(after, "radio")).toBe("Get a hand-crank radio");
  });

  it("marks promoted and demoted ids when the same set is reordered", () => {
    const first = action({ id: "a", title: "Charge devices" });
    const second = action({ id: "b", title: "Fill bathtub" });
    const before = resultFrom([first, second]);
    const after = resultFrom([second, first]);
    const diff = diffOptimizationResults(before, after);
    expect(diff.promotedIds).toEqual(["b"]);
    expect(diff.demotedIds).toEqual(["a"]);
    expect(diff.promotedTitles).toEqual(["Fill bathtub"]);
    expect(diff.demotedTitles).toEqual(["Charge devices"]);
    expect(diff.reordered).toBe(true);
    expect(diff.hardConstraintsUnchanged).toBe(true);
  });

  it("keeps official/hard unchanged when hard ids match", () => {
    const official = action({
      id: "evac",
      title: "Follow evacuation order",
      hardConstraint: true,
      official: true,
      category: "evacuate",
    });
    const extra = action({ id: "water", title: "Store water" });
    const before = resultFrom([official, extra]);
    const after = resultFrom([official]);
    const diff = diffOptimizationResults(before, after);
    expect(diff.hardConstraintsUnchanged).toBe(true);
    expect(diff.removedTitles).toEqual(["Store water"]);
  });
});
