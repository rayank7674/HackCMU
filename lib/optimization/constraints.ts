import { isUnknown, type Unknownable } from "@/types";
import type { RuleContext } from "@/lib/rules/types";
import {
  costUnitsForHousehold,
  toCostUnits,
} from "./planning-values";
import type { OptimizationConstraints, TransportMode } from "./types";

export function inferTransport(
  vehicleCount: Unknownable<number>,
): TransportMode {
  if (isUnknown(vehicleCount)) return "unknown";
  if (vehicleCount <= 0) return "none";
  return "car";
}

export function resolveOptimizationConstraints(
  partial: Partial<OptimizationConstraints> | undefined,
  ctx: RuleContext,
): OptimizationConstraints {
  const raw =
    partial?.budgetUnits !== undefined
      ? partial.budgetUnits
      : partial?.budgetDollars !== undefined
        ? partial.budgetDollars
        : costUnitsForHousehold(ctx.household.budgetClass);
  const budgetUnits = toCostUnits(raw);
  return {
    budgetUnits,
    budgetDollars: budgetUnits,
    availableTimeMinutes:
      partial?.availableTimeMinutes !== undefined
        ? partial.availableTimeMinutes
        : null,
    transport: partial?.transport ?? inferTransport(ctx.household.vehicleCount),
  };
}
