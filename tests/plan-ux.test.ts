import { describe, expect, it } from "vitest";
import {
  arrangePlanActions,
  budgetFitLabel,
  formatCostClass,
  formatHorizon,
  resolvePlanHorizon,
  sortActionsByBudget,
} from "@/lib/stormready-format";
import { classifyRequestFailure } from "@/lib/stormready-api";
import type { RecommendationTimeframe } from "@/lib/stormready";

function action(input: {
  id: string;
  timeframe?: RecommendationTimeframe | "unknown";
  horizon?: string;
  costClass?: string;
}) {
  return {
    id: input.id,
    timeframe: input.timeframe ?? "unknown",
    horizon: input.horizon,
    costClass: input.costClass,
  };
}

describe("horizon grouping", () => {
  it("maps engine and legacy timeframes onto now / before_next_event / long_term", () => {
    expect(resolvePlanHorizon("now")).toBe("now");
    expect(resolvePlanHorizon("during_event")).toBe("now");
    expect(resolvePlanHorizon("before_event")).toBe("before_next_event");
    expect(resolvePlanHorizon("before_next_event")).toBe("before_next_event");
    expect(resolvePlanHorizon("after_event")).toBe("long_term");
    expect(resolvePlanHorizon("long_term")).toBe("long_term");
    expect(resolvePlanHorizon("unknown")).toBe("before_next_event");
  });

  it("labels horizons instead of raw ids", () => {
    expect(formatHorizon("now", "now")).toBe("Now");
    expect(formatHorizon("before_next_event", "before_next_event")).toBe(
      "Before the next event",
    );
    expect(formatHorizon("long_term", "long_term")).toBe("Long term");
  });

  it("groups actions in horizon order and hides empty groups", () => {
    const groups = arrangePlanActions(
      [
        action({ id: "later", horizon: "long_term", costClass: "low" }),
        action({ id: "soon", horizon: "before_next_event", costClass: "zero" }),
        action({ id: "now", horizon: "now", costClass: "moderate" }),
      ],
      "low",
    );

    expect(groups.map((group) => group.horizon)).toEqual([
      "now",
      "before_next_event",
      "long_term",
    ]);
    expect(groups[0]?.items[0]?.id).toBe("now");
    expect(groups[1]?.items[0]?.id).toBe("soon");
    expect(groups[2]?.items[0]?.id).toBe("later");
  });

  it("preserves optimizer order within a horizon instead of re-sorting by budget", () => {
    const groups = arrangePlanActions(
      [
        action({ id: "higher-cost-first", horizon: "now", costClass: "flexible" }),
        action({ id: "zero-second", horizon: "now", costClass: "zero" }),
      ],
      "zero",
    );
    expect(groups[0]?.items.map((item) => item.id)).toEqual([
      "higher-cost-first",
      "zero-second",
    ]);
  });
});

describe("budget ranking", () => {
  it("sorts no-cost and in-budget actions ahead of higher-cost ones", () => {
    const sorted = sortActionsByBudget(
      [
        action({ id: "gen", horizon: "now", costClass: "flexible" }),
        action({ id: "kit", horizon: "now", costClass: "low" }),
        action({ id: "check", horizon: "now", costClass: "zero" }),
        action({ id: "mid", horizon: "now", costClass: "moderate" }),
      ],
      "low",
    );

    expect(sorted.map((item) => item.id)).toEqual([
      "check",
      "kit",
      "mid",
      "gen",
    ]);
  });

  it("badges cost classes without dollar amounts", () => {
    expect(formatCostClass("zero")).toBe("No cost");
    expect(formatCostClass("low")).toBe("Low cost");
    expect(formatCostClass("moderate")).toBe("Moderate cost");
    expect(formatCostClass("flexible")).toBe("Higher cost");
    for (const value of ["zero", "low", "moderate", "flexible"] as const) {
      expect(formatCostClass(value)).not.toMatch(/\$|\d/);
    }
  });

  it("labels whether an action fits the household budget class", () => {
    expect(budgetFitLabel("zero", "low")).toBe("Fits budget");
    expect(budgetFitLabel("flexible", "low")).toBe("Above budget");
    expect(budgetFitLabel("low", "unknown")).toBeNull();
  });
});

describe("API failure classification", () => {
  it("treats missing routes as unavailable and transport failures as errors", () => {
    expect(classifyRequestFailure(404)).toBe("unavailable");
    expect(classifyRequestFailure(400)).toBe("unavailable");
    expect(classifyRequestFailure(500)).toBe("error");
    expect(classifyRequestFailure(429)).toBe("error");
    expect(classifyRequestFailure(null)).toBe("error");
  });
});
