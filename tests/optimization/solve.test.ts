import { describe, expect, it } from "vitest";
import {
  diffOptimizationResults,
  optimizePreparednessPlan,
  type OptimizationConstraints,
  type PreparednessAction,
} from "@/lib/optimization";
import type { RecommendationCategory, RecommendationHorizon } from "@/types";

function action(
  overrides: Partial<PreparednessAction> & Pick<PreparednessAction, "id">,
): PreparednessAction {
  const id = overrides.id;
  const units = overrides.estimatedCostUnits ?? overrides.estimatedCostDollars ?? 0;
  const rest = { ...overrides };
  delete rest.estimatedCostUnits;
  delete rest.estimatedCostDollars;
  return {
    ruleId: overrides.ruleId ?? id,
    title: overrides.title ?? id,
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
    ...rest,
    estimatedCostUnits: units,
    estimatedCostDollars: units,
    id,
  };
}

const open: OptimizationConstraints = {
  budgetUnits: 3,
  budgetDollars: 3,
  availableTimeMinutes: null,
  transport: "car",
};

describe("knapsack_dp solver", () => {
  it("names the solver and objective as preparedness utility, never a safety %", () => {
    const result = optimizePreparednessPlan(
      [action({ id: "a", utility: 0.4 }), action({ id: "b", utility: 0.6 })],
      open,
      { hasBackupPower: false },
    );
    expect(result.solver).toBe("knapsack_dp");
    expect(result.objective).toBe("maximize_preparedness_utility");
    expect(result.objective).not.toMatch(/safety|survival/i);
    expect(result.notes.join(" ")).toMatch(/not a safety or survival/i);
    expect(new Set(result.selectedIds).size).toBe(result.selectedIds.length);
  });

  it("selects different discretionary sets at 0 vs 1 vs 3 cost units", () => {
    const candidates = [
      action({
        id: "free",
        estimatedCostUnits: 0,
        estimatedCostDollars: 0,
        costClass: "zero",
        utility: 0.4,
      }),
      action({
        id: "cheap",
        estimatedCostUnits: 1,
        estimatedCostDollars: 1,
        costClass: "low",
        utility: 0.55,
      }),
      action({
        id: "mid",
        estimatedCostUnits: 2,
        estimatedCostDollars: 2,
        costClass: "moderate",
        utility: 0.7,
      }),
      action({
        id: "gen",
        estimatedCostUnits: 3,
        estimatedCostDollars: 3,
        costClass: "flexible",
        utility: 0.95,
        generatorAcquisition: true,
      }),
    ];

    const at0 = optimizePreparednessPlan(
      candidates,
      { ...open, budgetUnits: 0 },
      { hasBackupPower: false },
    );
    const at1 = optimizePreparednessPlan(
      candidates,
      { ...open, budgetUnits: 1 },
      { hasBackupPower: false },
    );
    const at3 = optimizePreparednessPlan(
      candidates,
      { ...open, budgetUnits: 3 },
      { hasBackupPower: false },
    );

    expect(at0.selectedIds).toEqual(["free"]);
    expect(at0.selected.every((item) => item.estimatedCostUnits === 0)).toBe(
      true,
    );
    expect(at1.selectedIds).toContain("cheap");
    expect(at1.selectedIds).not.toContain("mid");
    expect(at1.selectedIds).not.toContain("gen");
    expect(at1.planningCostUnits).toBeLessThanOrEqual(1);
    expect(at3.selectedIds).toContain("mid");
    expect(at0.selectedIds).not.toEqual(at1.selectedIds);
    expect(at1.selectedIds).not.toEqual(at3.selectedIds);
  });

  it("does not add paid actions when budget is $0 even if under three", () => {
    const result = optimizePreparednessPlan(
      [
        action({ id: "free", estimatedCostDollars: 0, utility: 0.2 }),
        action({
          id: "paid",
          estimatedCostDollars: 1,
          costClass: "low",
          utility: 0.99,
        }),
      ],
      { ...open, budgetUnits: 0, budgetDollars: 0 },
      { hasBackupPower: false },
    );
    expect(result.selectedIds).toEqual(["free"]);
    expect(result.rejected.some((item) => item.id === "paid")).toBe(true);
  });

  it("excludes ~90 minute tasks when only 15 minutes remain after hard actions", () => {
    const result = optimizePreparednessPlan(
      [
        action({
          id: "official.evac",
          official: true,
          hardConstraint: true,
          category: "evacuate",
          priority: "critical",
          estimatedTimeMinutes: 15,
          estimatedCostDollars: 0,
          utility: 1,
        }),
        action({
          id: "long.prep",
          horizon: "before_next_event" as RecommendationHorizon,
          estimatedTimeMinutes: 90,
          estimatedCostDollars: 0,
          utility: 0.9,
        }),
        action({
          id: "quick",
          estimatedTimeMinutes: 10,
          estimatedCostDollars: 0,
          utility: 0.3,
        }),
      ],
      { budgetDollars: 500, availableTimeMinutes: 15, transport: "car" },
      { hasBackupPower: false },
    );
    expect(result.selectedIds).toContain("official.evac");
    expect(result.selectedIds).not.toContain("long.prep");
    expect(result.rejected.some((item) => item.id === "long.prep")).toBe(true);
  });

  it("selects official evacuation at $0 and 15 minutes", () => {
    const result = optimizePreparednessPlan(
      [
        action({
          id: "official.evac",
          official: true,
          hardConstraint: true,
          category: "evacuate",
          priority: "critical",
          estimatedCostDollars: 0,
          estimatedTimeMinutes: 15,
          utility: 1,
        }),
        action({
          id: "paid.kit",
          estimatedCostDollars: 1,
          estimatedTimeMinutes: 20,
          utility: 0.8,
        }),
      ],
      { budgetDollars: 0, availableTimeMinutes: 15, transport: "none" },
      { hasBackupPower: false },
    );
    expect(result.selectedIds[0]).toBe("official.evac");
    expect(result.hardConstraintIds).toContain("official.evac");
  });

  it("never lets discretionary outrank official evacuation in display order", () => {
    const result = optimizePreparednessPlan(
      [
        action({
          id: "disc.high",
          utility: 0.99,
          estimatedCostDollars: 0,
          priority: "high",
        }),
        action({
          id: "official.evac",
          official: true,
          hardConstraint: true,
          category: "evacuate",
          priority: "critical",
          estimatedCostDollars: 0,
          utility: 0.4,
        }),
      ],
      open,
      { hasBackupPower: false },
    );
    expect(result.selected[0]?.id).toBe("official.evac");
    expect(result.selected[0]?.hardConstraint).toBe(true);
    const discIndex = result.selectedIds.indexOf("disc.high");
    expect(discIndex).toBeGreaterThan(0);
  });

  it("boosts transport readiness when there is no car or limited transport", () => {
    const candidates = [
      action({
        id: "kit",
        utility: 0.62,
        estimatedCostDollars: 0,
      }),
      action({
        id: "transport.ready",
        transportReadiness: true,
        utility: 0.6,
        estimatedCostDollars: 0,
      }),
    ];
    const withCar = optimizePreparednessPlan(candidates, open, {
      hasBackupPower: false,
    });
    const noCar = optimizePreparednessPlan(
      candidates,
      { ...open, transport: "none" },
      { hasBackupPower: false },
    );
    const limited = optimizePreparednessPlan(
      candidates,
      { ...open, transport: "limited" },
      { hasBackupPower: false },
    );

    expect(withCar.selected.find((a) => a.id === "transport.ready")?.utility).toBe(
      0.6,
    );
    const boosted = noCar.selected.find((a) => a.id === "transport.ready");
    expect(boosted?.utility).toBeCloseTo(0.8);
    expect(boosted?.constraintEffects).toContain("boosted_transport_readiness");
    expect(limited.selected.find((a) => a.id === "transport.ready")?.utility).toBeCloseTo(
      0.8,
    );
  });

  it("excludes non-hard actions that require transportation when transport is none/limited", () => {
    const candidates = [
      action({
        id: "drive.supplies",
        requiresTransportation: true,
        hardConstraint: false,
        utility: 0.99,
        estimatedCostDollars: 0,
      }),
      action({
        id: "stay.home",
        utility: 0.2,
        estimatedCostDollars: 0,
      }),
      action({
        id: "official.evac",
        official: true,
        hardConstraint: true,
        requiresTransportation: true,
        category: "evacuate" as RecommendationCategory,
        priority: "critical",
        estimatedCostDollars: 0,
        utility: 1,
      }),
    ];
    const none = optimizePreparednessPlan(
      candidates,
      { ...open, transport: "none" },
      { hasBackupPower: false },
    );
    expect(none.selectedIds).toContain("official.evac");
    expect(none.selectedIds).not.toContain("drive.supplies");
    expect(
      none.rejected.some(
        (item) =>
          item.id === "drive.supplies" &&
          item.reasons.includes("excluded_transport"),
      ),
    ).toBe(true);
  });

  it("does not treat unknown transport as no car", () => {
    const result = optimizePreparednessPlan(
      [
        action({
          id: "drive.supplies",
          requiresTransportation: true,
          hardConstraint: false,
          utility: 0.9,
          estimatedCostDollars: 0,
        }),
      ],
      { ...open, transport: "unknown" },
      { hasBackupPower: false },
    );
    expect(result.selectedIds).toContain("drive.supplies");
  });

  it("skips generator acquisition only when hasBackupPower is true", () => {
    const candidates = [
      action({
        id: "buy.gen",
        generatorAcquisition: true,
        estimatedCostDollars: 3,
        costClass: "flexible",
        utility: 0.99,
      }),
      action({
        id: "free.plan",
        estimatedCostDollars: 0,
        utility: 0.2,
      }),
    ];
    const knownNone = optimizePreparednessPlan(candidates, open, {
      hasBackupPower: false,
    });
    const knownHas = optimizePreparednessPlan(candidates, open, {
      hasBackupPower: true,
    });
    expect(knownNone.selectedIds).toContain("buy.gen");
    expect(knownHas.selectedIds).not.toContain("buy.gen");
    expect(
      knownHas.rejected.some(
        (item) =>
          item.id === "buy.gen" && item.reasons.includes("skipped_backup_power"),
      ),
    ).toBe(true);
  });

  it("always selects hard actions even when they exceed leftover budget and time", () => {
    const result = optimizePreparednessPlan(
      [
        action({
          id: "hard.a",
          hardConstraint: true,
          official: true,
          priority: "critical",
          estimatedCostDollars: 3,
          estimatedTimeMinutes: 90,
          utility: 1,
        }),
        action({
          id: "hard.b",
          hardConstraint: true,
          official: true,
          priority: "critical",
          estimatedCostDollars: 3,
          estimatedTimeMinutes: 90,
          utility: 0.9,
          ruleId: "hard.b",
        }),
      ],
      { budgetDollars: 0, availableTimeMinutes: 15, transport: "car" },
      { hasBackupPower: false },
    );
    expect(result.selectedIds).toEqual(["hard.a", "hard.b"]);
    expect(result.hardCount).toBe(2);
  });

  it("is deterministic for identical inputs", () => {
    const candidates = [
      action({ id: "z", utility: 0.5, estimatedCostDollars: 1 }),
      action({ id: "a", utility: 0.5, estimatedCostDollars: 1 }),
      action({ id: "m", utility: 0.4, estimatedCostDollars: 0 }),
    ];
    const constraints = { budgetDollars: 100, availableTimeMinutes: 60, transport: "car" as const };
    const first = optimizePreparednessPlan(candidates, constraints, {
      hasBackupPower: false,
    });
    const second = optimizePreparednessPlan(candidates, constraints, {
      hasBackupPower: false,
    });
    expect(first.selectedIds).toEqual(second.selectedIds);
    expect(first.planningCostDollars).toBe(second.planningCostDollars);
    expect(first.planningMinutes).toBe(second.planningMinutes);
  });

  it("caps surfaced actions at 5 and prefers hard when clipping", () => {
    const candidates = [
      action({
        id: "h1",
        hardConstraint: true,
        official: true,
        priority: "critical",
        utility: 1,
      }),
      action({
        id: "h2",
        hardConstraint: true,
        official: true,
        priority: "critical",
        utility: 0.9,
      }),
      ...Array.from({ length: 8 }, (_, i) =>
        action({ id: `d${i}`, utility: 0.8 - i * 0.01, estimatedCostDollars: 0 }),
      ),
    ];
    const result = optimizePreparednessPlan(candidates, open, {
      hasBackupPower: false,
    });
    expect(result.selected.length).toBeLessThanOrEqual(5);
    expect(result.selected.length).toBeGreaterThanOrEqual(3);
    expect(result.selectedIds.slice(0, 2)).toEqual(["h1", "h2"]);
  });

  it("fills toward 3 only with actions that still fit remaining budget and time", () => {
    const result = optimizePreparednessPlan(
      [
        action({ id: "best", utility: 0.99, estimatedCostDollars: 0, estimatedTimeMinutes: 10 }),
        action({ id: "fit", utility: 0.1, estimatedCostDollars: 0, estimatedTimeMinutes: 10 }),
        action({
          id: "slow",
          utility: 0.2,
          estimatedCostDollars: 0,
          estimatedTimeMinutes: 90,
        }),
      ],
      { budgetDollars: 0, availableTimeMinutes: 25, transport: "car" },
      { hasBackupPower: false },
    );
    expect(result.selectedIds).toContain("best");
    expect(result.selectedIds).toContain("fit");
    expect(result.selectedIds).not.toContain("slow");
    expect(result.selected.length).toBeGreaterThanOrEqual(2);
  });

  it("treats null time as unconstrained", () => {
    const result = optimizePreparednessPlan(
      [
        action({
          id: "long",
          estimatedTimeMinutes: 240,
          horizon: "long_term",
          estimatedCostDollars: 0,
          utility: 0.9,
        }),
      ],
      { budgetDollars: 50, availableTimeMinutes: null, transport: "car" },
      { hasBackupPower: false },
    );
    expect(result.selectedIds).toContain("long");
  });
});

describe("optimization diff", () => {
  it("explains why a plan changed", () => {
    const before = optimizePreparednessPlan(
      [
        action({ id: "free", estimatedCostDollars: 0, utility: 0.4 }),
        action({
          id: "gen",
          estimatedCostDollars: 3,
          costClass: "flexible",
          utility: 0.95,
        }),
      ],
      { budgetDollars: 500, availableTimeMinutes: null, transport: "car" },
      { hasBackupPower: false },
    );
    const after = optimizePreparednessPlan(
      [
        action({ id: "free", estimatedCostDollars: 0, utility: 0.4 }),
        action({
          id: "gen",
          estimatedCostDollars: 3,
          costClass: "flexible",
          utility: 0.95,
        }),
      ],
      { budgetDollars: 100, availableTimeMinutes: null, transport: "none" },
      { hasBackupPower: false },
    );
    const diff = diffOptimizationResults(before, after);
    expect(diff.removedIds).toContain("gen");
    expect(diff.constraintChanges.budgetUnits).toEqual({
      from: 3,
      to: 2,
    });
    expect(diff.constraintChanges.transport.to).toBe("none");
    expect(diff.summary.toLowerCase()).toMatch(/cost class|removed|transport/);
  });
});
