import type { HazardState, HomeProfile, HouseholdProfile } from "@/types";
import type { RecommendationCategory } from "@/types";
import { evaluateRules } from "@/lib/recommendations/engine";
import {
  optimizePreparednessPlan,
  resolveOptimizationConstraints,
  toPreparednessActions,
} from "@/lib/optimization";
import type { OptimizationConstraints, OptimizationResult } from "@/lib/optimization";
import { buildHouseholdGraph } from "./graph";
import { simulate } from "./propagate";
import type { DisruptionLevel, NodeState, StressResult, StressScenario } from "./types";

const NODE_CATEGORIES: Record<string, RecommendationCategory[]> = {
  power: ["power"],
  charging: ["power", "communication"],
  communication: ["communication"],
  mobility: ["evacuate"],
  transport: ["evacuate"],
  elevator: ["evacuate"],
  road: ["evacuate"],
  food: ["supplies", "water"],
  water: ["water", "supplies"],
  healthcare: ["medical"],
  shelter: ["shelter"],
};

function categoriesFor(affected: NodeState[]): Set<RecommendationCategory> {
  const set = new Set<RecommendationCategory>();
  for (const node of affected) {
    const cats = NODE_CATEGORIES[node.id] ?? NODE_CATEGORIES[node.type];
    if (!cats) continue;
    for (const cat of cats) set.add(cat);
  }
  return set;
}

export function fortifyFromStress(
  result: StressResult,
  home: HomeProfile,
  household: HouseholdProfile,
  hazards: HazardState,
  constraints?: Partial<OptimizationConstraints>,
): OptimizationResult {
  const ctx = { home, household, hazards };
  const matches = evaluateRules(ctx);
  const wanted = categoriesFor(result.affected);
  const filtered = matches.filter(
    (match) => match.official || match.category === "evacuate" || wanted.has(match.category),
  );
  const pool = filtered.length > 0 ? filtered : matches;
  const candidates = toPreparednessActions(pool, ctx);
  const resolved = resolveOptimizationConstraints(constraints, ctx);
  return optimizePreparednessPlan(candidates, resolved, {
    hasBackupPower: home.hasBackupPower === true,
  });
}

export function counterfactualBackupPower(
  home: HomeProfile,
): HomeProfile {
  return {
    ...home,
    hasBackupPower: true,
    updatedAt: home.updatedAt,
  };
}

export function compareCounterfactual(input: {
  home: HomeProfile;
  household: HouseholdProfile;
  scenario: StressScenario;
  variantHome?: HomeProfile;
  variantHousehold?: HouseholdProfile;
}): {
  without: StressResult;
  withChange: StressResult;
  householdAccessDelta: number;
  disruptionWithout: DisruptionLevel;
  disruptionWith: DisruptionLevel;
} {
  const without = simulate(
    buildHouseholdGraph(input.home, input.household),
    input.scenario,
  );
  const withChange = simulate(
    buildHouseholdGraph(
      input.variantHome ?? input.home,
      input.variantHousehold ?? input.household,
    ),
    input.scenario,
  );
  return {
    without,
    withChange,
    householdAccessDelta: withChange.householdAccess - without.householdAccess,
    disruptionWithout: without.disruptionLevel,
    disruptionWith: withChange.disruptionLevel,
  };
}
