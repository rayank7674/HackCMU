import { isUnknown, type Unknownable } from "@/types";
import type { RuleContext } from "@/lib/rules/types";
import { planningDollarsForHousehold } from "./planning-values";
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
  return {
    budgetDollars:
      partial?.budgetDollars !== undefined
        ? partial.budgetDollars
        : planningDollarsForHousehold(ctx.household.budgetClass),
    availableTimeMinutes:
      partial?.availableTimeMinutes !== undefined
        ? partial.availableTimeMinutes
        : null,
    transport: partial?.transport ?? inferTransport(ctx.household.vehicleCount),
  };
}
