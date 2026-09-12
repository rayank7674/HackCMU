import { describe, expect, it } from "vitest";
import {
  ENGINE_REASONS,
  recommend,
  tampaDemoInput,
} from "@/lib/stormready";
import {
  allClearHazards,
  makeHazard,
  makeHazards,
  makeHome,
  makeHousehold,
} from "../rules/helpers";

describe("recommend() knapsack integration", () => {
  it("fails closed without optimization when hazards are missing", () => {
    const result = recommend({
      home: makeHome(),
      household: makeHousehold(),
      hazards: null,
    });
    expect(result.status).toBe("unavailable");
    expect(result.optimization).toBeNull();
    expect(result.recommendations).toEqual([]);
  });

  it("attaches knapsack metadata on a successful plan", () => {
    const result = recommend({
      home: makeHome(),
      household: makeHousehold({ budgetClass: "low" }),
      hazards: allClearHazards(),
    });
    expect(result.status).toBe("ok");
    expect(result.optimization).not.toBeNull();
    expect(result.optimization?.solver).toBe("knapsack_dp");
    expect(result.optimization?.objective).toBe("maximize_preparedness_utility");
    expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(result.recommendations.length).toBeLessThanOrEqual(5);
    expect(result.recommendations[0]?.id).toBe(result.optimization?.selectedIds[0]);
  });

  it("keeps official hurricane warning first", () => {
    const result = recommend({
      home: makeHome(),
      household: makeHousehold({ budgetClass: "zero" }),
      hazards: makeHazards([
        makeHazard({
          kind: "hurricane",
          severity: "warning",
          headline: "Hurricane Warning - Evacuation Order Zone A",
          instruction: "Evacuate now.",
        }),
      ]),
    });
    expect(result.recommendations[0]?.official).toBe(true);
    expect(result.recommendations[0]?.hardConstraint).toBe(true);
    const firstDisc = result.recommendations.find((rec) => !rec.official);
    if (firstDisc) {
      expect(result.recommendations.indexOf(firstDisc)).toBeGreaterThan(0);
    }
  });

  it("prefers zero-cost discretionary at $0 budget class", () => {
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
    const discretionary = result.recommendations.filter((rec) => !rec.official);
    expect(discretionary.every((rec) => rec.costClass === "zero")).toBe(true);
  });

  it("changes the plan when session budget constraints change", () => {
    const base = {
      home: makeHome({ hasBackupPower: false, roofAgeYears: 22 }),
      household: makeHousehold({ budgetClass: "flexible" }),
      hazards: allClearHazards(),
    };
    const at500 = recommend({
      ...base,
      constraints: { budgetDollars: 500, availableTimeMinutes: null, transport: "car" },
    });
    const at100 = recommend({
      ...base,
      constraints: { budgetDollars: 100, availableTimeMinutes: null, transport: "car" },
    });
    const at0 = recommend({
      ...base,
      constraints: { budgetDollars: 0, availableTimeMinutes: null, transport: "car" },
    });
    expect(at500.optimization?.constraintsUsed.budgetUnits).toBe(3);
    expect(at100.optimization?.constraintsUsed.budgetUnits).toBe(2);
    expect(at0.optimization?.constraintsUsed.budgetUnits).toBe(0);
    const ids500 = at500.recommendations.map((rec) => rec.id).join(",");
    const ids100 = at100.recommendations.map((rec) => rec.id).join(",");
    const ids0 = at0.recommendations.map((rec) => rec.id).join(",");
    expect(new Set([ids500, ids100, ids0]).size).toBeGreaterThan(1);
  });

  it("hurricane, wildfire, winter, and all-clear plans differ", () => {
    const home = makeHome({ state: "FL" });
    const household = makeHousehold({
      budgetClass: "low",
      canSelfEvacuate: true,
      hasMobilityNeeds: false,
      petCount: 0,
    });
    const hurricane = recommend({
      home,
      household,
      hazards: makeHazards([
        makeHazard({
          kind: "hurricane",
          severity: "warning",
          headline: "Hurricane Warning",
        }),
      ]),
    });
    const wildfire = recommend({
      home: makeHome({ state: "CA" }),
      household,
      hazards: makeHazards([
        makeHazard({
          kind: "wildfire",
          severity: "warning",
          headline: "Wildfire Warning - Evacuate",
          instruction: "Evacuate now.",
        }),
      ]),
    });
    const winter = recommend({
      home: makeHome({ state: "MN" }),
      household,
      hazards: makeHazards([
        makeHazard({
          kind: "winter_storm",
          severity: "warning",
          headline: "Winter Storm Warning",
        }),
      ]),
    });
    const quiet = recommend({
      home,
      household,
      hazards: allClearHazards(),
    });

    expect(hurricane.recommendations[0]?.ruleId).toBe("hurricane.official_warning");
    expect(wildfire.recommendations[0]?.ruleId).toBe("wildfire.official_evac");
    expect(winter.recommendations[0]?.ruleId).toBe("winter.official_warning");
    expect(quiet.reason).toBe(ENGINE_REASONS.allClear);
    expect(quiet.recommendations.every((rec) => rec.official === false)).toBe(true);

    const tops = [
      hurricane.recommendations[0]?.id,
      wildfire.recommendations[0]?.id,
      winter.recommendations[0]?.id,
      quiet.recommendations[0]?.id,
    ];
    expect(new Set(tops).size).toBe(4);
  });

  it("does not treat unknown roof as old in engine output", () => {
    const unknown = recommend({
      home: makeHome({ roofAgeYears: "unknown", yearBuilt: 2019 }),
      household: makeHousehold(),
      hazards: makeHazards([
        makeHazard({ kind: "hurricane", severity: "watch", headline: "Hurricane Watch" }),
      ]),
    });
    expect(unknown.matchedRuleIds).toContain("hurricane.unknown_roof");
    expect(unknown.matchedRuleIds).not.toContain("hurricane.old_roof");
  });

  it("does not treat unknown backup power as a confirmed generator", () => {
    const unknown = recommend({
      home: makeHome({ hasBackupPower: "unknown" }),
      household: makeHousehold({ budgetClass: "flexible" }),
      hazards: allClearHazards(),
    });
    expect(unknown.matchedRuleIds).toContain("household.power_outage_unknown");
    const known = recommend({
      home: makeHome({ hasBackupPower: true, backupPowerType: "portable_generator" }),
      household: makeHousehold({ budgetClass: "flexible" }),
      hazards: allClearHazards(),
    });
    expect(known.matchedRuleIds).not.toContain("household.power_outage_unknown");
  });

  it("returns identical output for identical Tampa demo input", () => {
    const a = recommend(tampaDemoInput("watch"));
    const b = recommend(tampaDemoInput("watch"));
    expect(a.recommendations.map((rec) => rec.id)).toEqual(
      b.recommendations.map((rec) => rec.id),
    );
    expect(a.optimization?.selectedIds).toEqual(b.optimization?.selectedIds);
    expect(a.matchedRuleIds).toEqual(b.matchedRuleIds);
  });

  it("passes session constraints through to the optimizer", () => {
    const result = recommend({
      ...tampaDemoInput("quiet"),
      constraints: {
        budgetDollars: 0,
        availableTimeMinutes: 15,
        transport: "none",
      },
    });
    expect(result.optimization?.constraintsUsed).toEqual({
      budgetUnits: 0,
      budgetDollars: 0,
      availableTimeMinutes: 15,
      transport: "none",
    });
    const paid = result.recommendations.filter(
      (rec) => rec.costClass && rec.costClass !== "zero" && !rec.hardConstraint,
    );
    expect(paid).toEqual([]);
  });
});
