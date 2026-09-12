import { describe, expect, it } from "vitest";
import {
  allClearHazards,
  makeHazard,
  makeHazards,
  makeHome,
  makeHousehold,
} from "../rules/helpers";
import { buildHouseholdGraph } from "@/lib/stress/graph";
import { simulate } from "@/lib/stress/propagate";
import { presetById } from "@/lib/stress/presets";
import {
  compareCounterfactual,
  counterfactualBackupPower,
  fortifyFromStress,
} from "@/lib/stress/fortify";

describe("fortify and counterfactual", () => {
  it("reuses the knapsack and keeps official actions first", () => {
    const home = makeHome({ hasBackupPower: false });
    const household = makeHousehold({ budgetClass: "low" });
    const hazards = makeHazards([
      makeHazard({
        kind: "hurricane",
        severity: "warning",
        headline: "Hurricane Warning",
        instruction: "Evacuate now.",
      }),
    ]);
    const result = simulate(
      buildHouseholdGraph(home, household),
      presetById("power-12h")!,
    );
    const plan = fortifyFromStress(result, home, household, hazards, {
      budgetUnits: 0,
    });
    expect(plan.solver).toBe("knapsack_dp");
    expect(plan.selected[0]?.hardConstraint).toBe(true);
    expect(plan.selected[0]?.official).toBe(true);
    const discretionary = plan.selected.filter((item) => !item.hardConstraint);
    expect(discretionary.every((item) => item.costClass === "zero")).toBe(true);
  });

  it("respects a zero cost-class budget for discretionary fortify actions", () => {
    const home = makeHome({ hasBackupPower: false });
    const household = makeHousehold({ budgetClass: "zero" });
    const result = simulate(
      buildHouseholdGraph(home, household),
      presetById("wind-power")!,
    );
    const plan = fortifyFromStress(
      result,
      home,
      household,
      allClearHazards(),
      { budgetUnits: 0 },
    );
    const discretionary = plan.selected.filter((item) => !item.hardConstraint);
    expect(discretionary.every((item) => item.costClass === "zero")).toBe(true);
  });

  it("backup power counterfactual improves modeled communication access", () => {
    const home = makeHome({ hasBackupPower: false });
    const household = makeHousehold();
    const scenario = presetById("power-12h")!;
    const compared = compareCounterfactual({
      home,
      household,
      scenario,
      variantHome: counterfactualBackupPower(home),
    });
    expect(compared.householdAccessDelta).toBeGreaterThan(0);
    const commsWithout = compared.without.nodes.find(
      (node) => node.id === "communication",
    );
    const commsWith = compared.withChange.nodes.find(
      (node) => node.id === "communication",
    );
    expect(commsWithout?.level).not.toBe("none");
    expect(commsWith?.level).toBe("none");
  });

  it("does not treat unknown backup as a confirmed generator in counterfactual baseline", () => {
    const home = makeHome({ hasBackupPower: "unknown" });
    const household = makeHousehold();
    const without = simulate(
      buildHouseholdGraph(home, household),
      presetById("power-12h")!,
    );
    expect(without.nodes.some((node) => node.id === "charging")).toBe(false);
  });
});
