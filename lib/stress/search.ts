import { buildHouseholdGraph, scenarioIncludesLocalFeeder } from "./graph";
import { rankDisruption, simulate } from "./propagate";
import { BASELINE_SCENARIO } from "./presets";
import { STRESS_DISCLAIMER } from "./presets";
import type {
  BreakdownFound,
  MinBreakdown,
  PowerPct,
  RoadPct,
  SearchBounds,
  StressScenario,
  TransportStress,
  WaterPct,
  WorstCase,
} from "./types";
import type { HomeProfile, HouseholdProfile } from "@/types";

export const DEFAULT_BOUNDS: SearchBounds = {
  power: [100, 75, 50, 25, 0],
  road: [100, 75, 50],
  transport: ["unchanged", "limited", "none"],
};

function transportRank(mode: TransportStress): number {
  if (mode === "unchanged" || mode === "car") return 0;
  if (mode === "limited") return 2;
  return 3;
}

function powerRank(value: PowerPct): number {
  if (value === 100) return 0;
  return (100 - value) / 25;
}

function roadRank(value: RoadPct): number {
  if (value === 100) return 0;
  return (100 - value) / 25;
}

export function perturbationCount(scenario: StressScenario): number {
  let count = 0;
  if (scenario.powerAvailability !== 100) count += 1;
  if (scenario.roadAccessibility !== 100) count += 1;
  if (scenario.transport !== "unchanged" && scenario.transport !== "car") {
    count += 1;
  }
  if (scenario.waterAvailability !== 100) count += 1;
  return count;
}

export function severityRank(scenario: StressScenario): number {
  return (
    powerRank(scenario.powerAvailability) +
    roadRank(scenario.roadAccessibility) +
    transportRank(scenario.transport) +
    (scenario.waterAvailability === 100
      ? 0
      : scenario.waterAvailability === 50
        ? 2
        : 3)
  );
}

function comboScenario(
  power: PowerPct,
  road: RoadPct,
  transport: TransportStress,
  water: WaterPct,
): StressScenario {
  return {
    id: `search-${power}-${road}-${transport}-${water}`,
    label: "Bounded modeled search",
    disclaimer: STRESS_DISCLAIMER,
    powerAvailability: power,
    roadAccessibility: road,
    transport,
    waterAvailability: water,
    outageHours: power <= 50 ? 12 : null,
    hazardBoost: null,
  };
}

function enumerate(bounds: SearchBounds): StressScenario[] {
  const water = bounds.water ?? ([100] as const);
  const out: StressScenario[] = [];
  for (const p of bounds.power) {
    for (const r of bounds.road) {
      for (const t of bounds.transport) {
        for (const w of water) {
          out.push(comboScenario(p, r, t, w));
        }
      }
    }
  }
  return out;
}

function compareFound(a: BreakdownFound, b: BreakdownFound): number {
  if (a.perturbationCount !== b.perturbationCount) {
    return a.perturbationCount - b.perturbationCount;
  }
  if (a.severityRank !== b.severityRank) return a.severityRank - b.severityRank;
  return a.scenario.id.localeCompare(b.scenario.id);
}

/**
 * Exhaustive search on a tiny discrete grid. Local only.
 */
export function findMinimumBreakdown(
  home: HomeProfile,
  household: HouseholdProfile,
  bounds: SearchBounds = DEFAULT_BOUNDS,
): MinBreakdown {
  const found: BreakdownFound[] = [];
  for (const scenario of enumerate(bounds)) {
    const graph = buildHouseholdGraph(home, household, {
      includeLocalFeeder: scenarioIncludesLocalFeeder(scenario),
    });
    const result = simulate(graph, scenario);
    if (rankDisruption(result.disruptionLevel) < 2) continue;
    found.push({
      status: "found",
      scenario,
      result,
      perturbationCount: perturbationCount(scenario),
      severityRank: severityRank(scenario),
    });
  }
  found.sort(compareFound);
  if (!found[0]) {
    return {
      status: "no_breakdown",
      result: simulate(
        buildHouseholdGraph(home, household, {
          includeLocalFeeder: scenarioIncludesLocalFeeder(BASELINE_SCENARIO),
        }),
        BASELINE_SCENARIO,
      ),
    };
  }
  return found[0];
}

export function findWorstCase(
  home: HomeProfile,
  household: HouseholdProfile,
  bounds: SearchBounds = DEFAULT_BOUNDS,
): WorstCase {
  let best: BreakdownFound | null = null;
  for (const scenario of enumerate(bounds)) {
    const graph = buildHouseholdGraph(home, household, {
      includeLocalFeeder: scenarioIncludesLocalFeeder(scenario),
    });
    const result = simulate(graph, scenario);
    const candidate: BreakdownFound = {
      status: "found",
      scenario,
      result,
      perturbationCount: perturbationCount(scenario),
      severityRank: severityRank(scenario),
    };
    if (!best) {
      best = candidate;
      continue;
    }
    const rank = rankDisruption(result.disruptionLevel);
    const bestRank = rankDisruption(best.result.disruptionLevel);
    if (rank > bestRank) {
      best = candidate;
      continue;
    }
    if (rank === bestRank && result.affected.length > best.result.affected.length) {
      best = candidate;
      continue;
    }
    if (
      rank === bestRank &&
      result.affected.length === best.result.affected.length &&
      candidate.severityRank > best.severityRank
    ) {
      best = candidate;
    }
  }
  return best!;
}
