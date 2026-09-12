import { describe, expect, it } from "vitest";
import {
  COST_UNITS_BY_CLASS,
  HOUSEHOLD_COST_UNITS,
  labelForCostUnits,
  costUnitsForClass,
  costUnitsForHousehold,
  planningMinutesFor,
  toCostUnits,
} from "@/lib/optimization";

describe("planning values", () => {
  it("maps cost class to discrete units, not dollar prices", () => {
    expect(costUnitsForClass("zero")).toBe(0);
    expect(costUnitsForClass("low")).toBe(1);
    expect(costUnitsForClass("moderate")).toBe(2);
    expect(costUnitsForClass("flexible")).toBe(3);
    expect(COST_UNITS_BY_CLASS.flexible).toBe(3);
  });

  it("maps household class to the same 0/1/2/3 ladder", () => {
    expect(HOUSEHOLD_COST_UNITS.zero).toBe(0);
    expect(HOUSEHOLD_COST_UNITS.low).toBe(1);
    expect(HOUSEHOLD_COST_UNITS.moderate).toBe(2);
    expect(HOUSEHOLD_COST_UNITS.flexible).toBe(3);
    expect(costUnitsForHousehold("flexible")).toBe(3);
  });

  it("treats unknown household budget as a low unit cap, not flexible", () => {
    expect(costUnitsForHousehold("unknown")).toBe(1);
  });

  it("uses 10–25 minutes for now, ~90 before next event, ~240 long term", () => {
    expect(planningMinutesFor("communication", "now")).toBe(10);
    expect(planningMinutesFor("supplies", "now")).toBe(20);
    expect(planningMinutesFor("evacuate", "now")).toBe(15);
    expect(planningMinutesFor("supplies", "before_next_event")).toBe(90);
    expect(planningMinutesFor("other", "long_term")).toBe(240);
  });

  it("maps leftover dollar aliases onto units without treating them as prices", () => {
    expect(toCostUnits(0)).toBe(0);
    expect(toCostUnits(1)).toBe(1);
    expect(toCostUnits(3)).toBe(3);
    expect(toCostUnits(50)).toBe(1);
    expect(toCostUnits(100)).toBe(2);
    expect(toCostUnits(500)).toBe(3);
    expect(toCostUnits(null)).toBeNull();
    expect(labelForCostUnits(0)).toBe("no-cost");
    expect(labelForCostUnits(null)).toBe("unconstrained");
  });
});
