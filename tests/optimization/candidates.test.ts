import { describe, expect, it } from "vitest";
import {
  isGeneratorAcquisition,
  isHardConstraint,
  toPreparednessAction,
  toPreparednessActions,
} from "@/lib/optimization";
import type { RuleMatch } from "@/lib/rules/types";
import {
  allClearHazards,
  makeHazard,
  makeHazards,
  makeHome,
  makeHousehold,
} from "../rules/helpers";

function match(overrides: Partial<RuleMatch> & Pick<RuleMatch, "ruleId" | "title">): RuleMatch {
  return {
    body: "body",
    rationale: "rationale",
    priority: "medium",
    category: "supplies",
    hazardKinds: ["hurricane"],
    horizon: "now",
    official: false,
    costClass: "zero",
    ...overrides,
  };
}

describe("candidate conversion", () => {
  it("sets hardConstraint for official or evacuate, keeping official separate", () => {
    const official = match({
      ruleId: "hurricane.official_warning",
      title: "Follow warning",
      official: true,
      category: "shelter",
    });
    const evac = match({
      ruleId: "hurricane.manufactured_wind",
      title: "Leave manufactured home",
      official: false,
      category: "evacuate",
    });
    const kit = match({
      ruleId: "hurricane.watch_kit",
      title: "Finish a kit",
      official: false,
      category: "supplies",
    });

    expect(isHardConstraint(official)).toBe(true);
    expect(isHardConstraint(evac)).toBe(true);
    expect(isHardConstraint(kit)).toBe(false);

    const ctx = {
      home: makeHome(),
      household: makeHousehold(),
      hazards: makeHazards([
        makeHazard({ kind: "hurricane", severity: "warning", headline: "Hurricane Warning" }),
      ]),
    };
    const officialAction = toPreparednessAction(official, ctx);
    expect(officialAction.official).toBe(true);
    expect(officialAction.hardConstraint).toBe(true);
    const evacAction = toPreparednessAction(evac, ctx);
    expect(evacAction.official).toBe(false);
    expect(evacAction.hardConstraint).toBe(true);
  });

  it("scores utility as 0.4 urgency + 0.3 hazard relevance + 0.3 household fit", () => {
    const ctx = {
      home: makeHome({ roofAgeYears: "unknown" }),
      household: makeHousehold(),
      hazards: makeHazards([
        makeHazard({ kind: "hurricane", severity: "watch", headline: "Hurricane Watch" }),
      ]),
    };
    const action = toPreparednessAction(
      match({
        ruleId: "hurricane.unknown_roof",
        title: "Unknown roof age",
        priority: "high",
        category: "shelter",
        horizon: "now",
      }),
      ctx,
    );
    const expected =
      0.4 * action.urgency + 0.3 * action.hazardRelevance + 0.3 * action.householdFit;
    expect(action.utility).toBeCloseTo(expected, 5);
    expect(action.utility).toBeGreaterThanOrEqual(0);
    expect(action.utility).toBeLessThanOrEqual(1);
  });

  it("does not treat unknown roof as an old roof", () => {
    const ctxUnknown = {
      home: makeHome({ roofAgeYears: "unknown" }),
      household: makeHousehold(),
      hazards: makeHazards([
        makeHazard({ kind: "hurricane", severity: "watch", headline: "Watch" }),
      ]),
    };
    const oldRule = match({
      ruleId: "hurricane.old_roof",
      title: "Aging roof",
      category: "shelter",
    });
    const unknownRule = match({
      ruleId: "hurricane.unknown_roof",
      title: "Unknown roof",
      category: "shelter",
    });
    const oldOnUnknown = toPreparednessAction(oldRule, ctxUnknown);
    const unknownOnUnknown = toPreparednessAction(unknownRule, ctxUnknown);
    expect(unknownOnUnknown.householdFit).toBeGreaterThan(oldOnUnknown.householdFit);

    const ctxOld = {
      ...ctxUnknown,
      home: makeHome({ roofAgeYears: 22 }),
    };
    expect(toPreparednessAction(oldRule, ctxOld).householdFit).toBeGreaterThan(
      toPreparednessAction(oldRule, ctxUnknown).householdFit,
    );
  });

  it("does not treat unknown generator as none", () => {
    const buy = match({
      ruleId: "power.buy_generator",
      title: "Buy a portable generator",
      body: "Purchase a generator if the budget class allows.",
      category: "power",
      costClass: "flexible",
    });
    expect(isGeneratorAcquisition(buy)).toBe(true);

    const skip = match({
      ruleId: "household.power_outage_unknown",
      title: "No-cost outage plan",
      body: "Skip buying a generator unless the budget class is flexible.",
      category: "power",
    });
    expect(isGeneratorAcquisition(skip)).toBe(false);

    const hazards = makeHazards([
      makeHazard({ kind: "hurricane", severity: "watch", headline: "Watch" }),
    ]);
    const unknownPower = toPreparednessAction(buy, {
      home: makeHome({ hasBackupPower: "unknown" }),
      household: makeHousehold(),
      hazards,
    });
    const nonePower = toPreparednessAction(buy, {
      home: makeHome({ hasBackupPower: false }),
      household: makeHousehold(),
      hazards,
    });
    const hasPower = toPreparednessAction(buy, {
      home: makeHome({ hasBackupPower: true }),
      household: makeHousehold(),
      hazards,
    });
    expect(nonePower.householdFit).toBeGreaterThan(unknownPower.householdFit);
    expect(unknownPower.householdFit).toBeGreaterThan(hasPower.householdFit);
  });

  it("converts a rule list deterministically", () => {
    const ctx = {
      home: makeHome(),
      household: makeHousehold(),
      hazards: allClearHazards(),
    };
    const matches = [
      match({ ruleId: "b.rule", title: "B" }),
      match({ ruleId: "a.rule", title: "A" }),
    ];
    const first = toPreparednessActions(matches, ctx).map((a) => a.id);
    const second = toPreparednessActions(matches, ctx).map((a) => a.id);
    expect(first).toEqual(["a.rule", "b.rule"]);
    expect(second).toEqual(first);
  });
});
