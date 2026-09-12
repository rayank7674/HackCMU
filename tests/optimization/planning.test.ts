import { describe, expect, it } from "vitest";
import {
  COST_CLASS_RANGE,
  HOUSEHOLD_PLANNING_DOLLARS,
  PLANNING_DOLLARS_BY_COST_CLASS,
  PLANNING_MINUTES_BEFORE_NEXT_EVENT,
  PLANNING_MINUTES_LONG_TERM,
  planningDollarsForCostClass,
  planningDollarsForHousehold,
  planningMinutesFor,
} from "@/lib/optimization";

describe("planning values", () => {
  it("maps cost class to planning dollars, not contractor prices", () => {
    expect(planningDollarsForCostClass("zero")).toBe(0);
    expect(planningDollarsForCostClass("low")).toBe(50);
    expect(planningDollarsForCostClass("moderate")).toBe(150);
    expect(planningDollarsForCostClass("flexible")).toBe(400);
    expect(PLANNING_DOLLARS_BY_COST_CLASS.flexible).toBe(400);
  });

  it("maps household class to 0/50/150/500", () => {
    expect(HOUSEHOLD_PLANNING_DOLLARS.zero).toBe(0);
    expect(HOUSEHOLD_PLANNING_DOLLARS.low).toBe(50);
    expect(HOUSEHOLD_PLANNING_DOLLARS.moderate).toBe(150);
    expect(HOUSEHOLD_PLANNING_DOLLARS.flexible).toBe(500);
    expect(planningDollarsForHousehold("flexible")).toBe(500);
  });

  it("treats unknown household budget as a low planning cap, not flexible", () => {
    expect(planningDollarsForHousehold("unknown")).toBe(50);
  });

  it("uses 10–25 minutes for now, ~90 before next event, ~240 long term", () => {
    expect(planningMinutesFor("communication", "now")).toBe(10);
    expect(planningMinutesFor("supplies", "now")).toBe(20);
    expect(planningMinutesFor("evacuate", "now")).toBe(15);
    expect(planningMinutesFor("other", "now")).toBeLessThanOrEqual(25);
    expect(planningMinutesFor("shelter", "now")).toBeGreaterThanOrEqual(10);
    expect(planningMinutesFor("supplies", "before_next_event")).toBe(
      PLANNING_MINUTES_BEFORE_NEXT_EVENT,
    );
    expect(planningMinutesFor("other", "long_term")).toBe(
      PLANNING_MINUTES_LONG_TERM,
    );
  });

  it("keeps cost ranges as planning bands", () => {
    expect(COST_CLASS_RANGE.zero).toEqual({ min: 0, max: 0 });
    expect(COST_CLASS_RANGE.flexible.max).toBe(400);
  });
});
