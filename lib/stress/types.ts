/** Modeled stress-test types. Not official infrastructure topology. */

export type StressProvenance =
  | "official"
  | "external"
  | "user_reported"
  | "modeled"
  | "ai_inferred";

export type DependencyNodeType =
  | "power"
  | "water"
  | "transport"
  | "mobility"
  | "communication"
  | "food"
  | "healthcare"
  | "shelter"
  | "home"
  | "elevator"
  | "charging"
  | "road"
  | "roof"
  | "openings"
  | "lowest_floor"
  | "pipes"
  | "local_feeder";

export type DisruptionLevel = "none" | "constrained" | "major" | "critical";

export type TransportStress = "car" | "limited" | "none" | "unchanged";

export type PowerPct = 100 | 75 | 50 | 25 | 0;
export type RoadPct = 100 | 75 | 50;
export type WaterPct = 100 | 50 | 0;
export type OutageHours = 6 | 12 | null;
export type HazardBoost = "wind" | "flood" | "winter" | null;

export type DependencyNode = {
  id: string;
  type: DependencyNodeType;
  label: string;
  source: StressProvenance;
  /** Own capacity before upstream limits, 0–100. */
  ownCapacity: number;
};

export type DependencyEdge = {
  from: string;
  to: string;
  strength: number;
  rationale: string;
  source: StressProvenance;
};

export type DependencyGraph = {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  assumptions: string[];
};

export type StressScenario = {
  id: string;
  label: string;
  disclaimer: string;
  powerAvailability: PowerPct;
  roadAccessibility: RoadPct;
  transport: TransportStress;
  waterAvailability: WaterPct;
  outageHours: OutageHours;
  hazardBoost: HazardBoost;
};

export type NodeState = {
  id: string;
  type: DependencyNodeType;
  label: string;
  source: StressProvenance;
  capacity: number;
  level: DisruptionLevel;
};

export type StressResult = {
  scenario: StressScenario;
  modeled: true;
  forecast: false;
  disruptionLevel: DisruptionLevel;
  householdAccess: number;
  firstBreak: NodeState | null;
  cascadePath: string[];
  affected: NodeState[];
  nodes: NodeState[];
  assumptions: string[];
  provenanceNote: string;
};

export type SearchBounds = {
  power: readonly PowerPct[];
  road: readonly RoadPct[];
  transport: readonly TransportStress[];
  water?: readonly WaterPct[];
};

export type BreakdownFound = {
  status: "found";
  scenario: StressScenario;
  result: StressResult;
  perturbationCount: number;
  severityRank: number;
};

export type BreakdownMiss = {
  status: "no_breakdown";
  result: StressResult | null;
};

export type MinBreakdown = BreakdownFound | BreakdownMiss;

export type WorstCase = BreakdownFound;
