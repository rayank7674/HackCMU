import type {
  DependencyGraph,
  DisruptionLevel,
  NodeState,
  StressResult,
  StressScenario,
} from "./types";

export const DISCLAIMER =
  "Modeled under these assumptions. Not a forecast, safety score, or official infrastructure assessment.";

const LEVEL_RANK: Record<DisruptionLevel, number> = {
  none: 0,
  constrained: 1,
  major: 2,
  critical: 3,
};

export function disruptionLevel(capacity: number): DisruptionLevel {
  if (capacity >= 80) return "none";
  if (capacity >= 50) return "constrained";
  if (capacity >= 25) return "major";
  return "critical";
}

export function rankDisruption(level: DisruptionLevel): number {
  return LEVEL_RANK[level];
}

function clamp(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function transportCapacity(
  base: number,
  mode: StressScenario["transport"],
): number {
  if (mode === "unchanged") return base;
  if (mode === "car") return Math.max(base, 85);
  if (mode === "limited") return Math.min(base, 50);
  return Math.min(base, 20);
}

function topoOrder(graph: DependencyGraph): string[] {
  const incoming = new Map<string, number>();
  for (const node of graph.nodes) incoming.set(node.id, 0);
  for (const edge of graph.edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    if (!incoming.has(edge.from)) incoming.set(edge.from, 0);
  }
  const queue = [...incoming.entries()]
    .filter(([, count]) => count === 0)
    .map(([id]) => id)
    .sort();
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const edge of graph.edges.filter((item) => item.from === id)) {
      const next = (incoming.get(edge.to) ?? 1) - 1;
      incoming.set(edge.to, next);
      if (next === 0) queue.push(edge.to);
      queue.sort();
    }
  }
  for (const node of graph.nodes) {
    if (!order.includes(node.id)) order.push(node.id);
  }
  return order;
}

/**
 * Deterministic capacity propagation. No I/O.
 */
export function simulate(
  graph: DependencyGraph,
  scenario: StressScenario,
): StressResult {
  const own = new Map(graph.nodes.map((node) => [node.id, node.ownCapacity]));
  own.set("power", scenario.powerAvailability);
  own.set("road", scenario.roadAccessibility);
  own.set("water", scenario.waterAvailability);
  const transport = graph.nodes.find((node) => node.id === "transport");
  if (transport) {
    own.set(
      "transport",
      transportCapacity(transport.ownCapacity, scenario.transport),
    );
  }

  if (scenario.outageHours === 12 && own.get("charging") !== undefined) {
    own.set("charging", clamp((own.get("charging") ?? 100) * 0.7));
  }
  if (scenario.hazardBoost === "flood") {
    own.set("road", clamp((own.get("road") ?? 100) * 0.8));
  }
  if (scenario.hazardBoost === "winter" && own.get("charging") !== undefined) {
    own.set("charging", clamp((own.get("charging") ?? 100) * 0.85));
  }

  const effective = new Map<string, number>();
  const order = topoOrder(graph);
  for (const id of order) {
    const incoming = graph.edges.filter((edge) => edge.to === id);
    const self = own.get(id) ?? 100;
    if (incoming.length === 0) {
      effective.set(id, clamp(self));
      continue;
    }
    let upstream = 100;
    for (const edge of incoming) {
      const from = effective.get(edge.from) ?? own.get(edge.from) ?? 100;
      upstream = Math.min(upstream, from * edge.strength);
    }
    effective.set(id, clamp(Math.min(self, upstream)));
  }

  const nodes: NodeState[] = graph.nodes.map((node) => {
    const capacity = effective.get(node.id) ?? node.ownCapacity;
    return {
      id: node.id,
      type: node.type,
      label: node.label,
      source: node.source,
      capacity: Math.round(capacity),
      level: disruptionLevel(capacity),
    };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const accessIds = ["mobility", "communication", "food", "healthcare"] as const;
  const householdAccess = Math.min(
    ...accessIds.map((id) => byId.get(id)?.capacity ?? 100),
  );
  const disruption = disruptionLevel(householdAccess);

  const shocked = new Set(["power", "road", "transport", "water"]);
  const affected = nodes
    .filter((node) => node.level !== "none")
    .sort((a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id));

  const firstBreak =
    affected.find((node) => !shocked.has(node.id) && node.level !== "none") ??
    affected[0] ??
    null;

  const cascadePath: string[] = [];
  const seen = new Set<string>();
  const start = firstBreak?.id ?? affected[0]?.id;
  if (start) {
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      const parents = graph.edges
        .filter((edge) => edge.to === id)
        .map((edge) => edge.from)
        .sort();
      for (const parent of parents) {
        const parentState = byId.get(parent);
        if (parentState && parentState.level !== "none") walk(parent);
      }
      cascadePath.push(id);
    };
    walk(start);
    for (const node of affected) {
      if (!seen.has(node.id) && !shocked.has(node.id)) {
        cascadePath.push(node.id);
      }
    }
  }

  return {
    scenario,
    modeled: true,
    forecast: false,
    disruptionLevel: disruption,
    householdAccess: Math.round(householdAccess),
    firstBreak,
    cascadePath,
    affected,
    nodes,
    assumptions: [
      ...graph.assumptions,
      `Power availability modeled at ${scenario.powerAvailability}%.`,
      `Road access modeled at ${scenario.roadAccessibility}%.`,
      `Transportation modeled as ${scenario.transport}.`,
      DISCLAIMER,
    ],
    provenanceNote:
      "Dependencies are modeled unless labeled user-reported. This is not official NWS or utility data.",
  };
}
