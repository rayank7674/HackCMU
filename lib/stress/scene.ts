import { shortSceneLabel } from "./copy";
import { isKnown } from "@/types";
import type { HomeProfile } from "@/types";
import type {
  DependencyEdge,
  DependencyNodeType,
  DisruptionLevel,
  NodeState,
  StressResult,
} from "./types";

/** Fixed household-centric layout. Positions are schematic, not geography. */
export const SCENE_NODE_LAYOUT: Record<string, readonly [number, number, number]> = {
  home: [0, 0.55, 0],
  power: [-2.35, 1.2, -1.15],
  water: [-2.15, 0.7, 1.45],
  road: [2.45, 0.28, -1.35],
  transport: [2.25, 0.58, 0.55],
  mobility: [1.45, 0.78, 1.75],
  communication: [-0.15, 1.4, 2.15],
  food: [0.55, 0.68, 2.2],
  healthcare: [2.05, 1.05, 1.85],
  shelter: [0.1, 0.95, -2.05],
  elevator: [-0.95, 1.7, -0.15],
  charging: [-2.1, 0.88, 0.4],
  roof: [0, 1.55, 0],
  openings: [0.55, 0.72, 0.85],
  lowest_floor: [0, 0.18, 0],
  pipes: [-0.85, 0.22, 0.55],
  local_feeder: [-3.15, 1.35, -0.35],
};

export const SCENE_LEVEL_COLOR: Record<DisruptionLevel, string> = {
  none: "#7a8ea3",
  constrained: "#c4a15a",
  major: "#c2410c",
  critical: "#b42318",
};

export type StressSceneNode = {
  id: string;
  type: DependencyNodeType;
  label: string;
  shortLabel: string;
  position: [number, number, number];
  level: DisruptionLevel;
  capacity: number;
  inCascade: boolean;
  isFirstBreak: boolean;
  failed: boolean;
  color: string;
};

export type StressSceneEdge = {
  from: string;
  to: string;
  fromPos: [number, number, number];
  toPos: [number, number, number];
  inCascade: boolean;
};

export type HousePartId = "roof" | "openings" | "lowest_floor" | "pipes";

export type HousePartTint = {
  id: HousePartId;
  level: DisruptionLevel;
  why: string;
};

export type StressSceneModel = {
  modeled: true;
  forecast: false;
  nodes: StressSceneNode[];
  edges: StressSceneEdge[];
  firstBreakId: string | null;
  cascadePath: string[];
  houseLevel: DisruptionLevel;
  houseParts: HousePartTint[];
  dwellingType: string;
  stories: number;
};

export function housePartWhy(id: HousePartId, level: DisruptionLevel): string {
  if (id === "roof") {
    return level === "none"
      ? "Roof is holding in this model. Not an inspection."
      : "Roof is more exposed in this model (age unknown or older class, or wind stress). Not an inspection.";
  }
  if (id === "openings") {
    return level === "none"
      ? "Openings are holding in this model. Not an inspection."
      : "Windows and openings are a modeled wind/rain path. Not an inspection.";
  }
  if (id === "lowest_floor") {
    return level === "none"
      ? "Lowest floor is holding in this model. Not a flood determination."
      : "Lowest floor is flood-sensitive in this model. Unknown flood zone is not 'outside a flood zone'.";
  }
  return level === "none"
    ? "Pipes are holding in this model. Not a plumbing inspection."
    : "Pipes are freeze-sensitive in this model. Not a plumbing inspection.";
}

export function isFailedLevel(level: DisruptionLevel): boolean {
  return level === "major" || level === "critical";
}

export function positionForNode(
  id: string,
  type: DependencyNodeType,
  index: number,
  total: number,
): [number, number, number] {
  const known = SCENE_NODE_LAYOUT[id] ?? SCENE_NODE_LAYOUT[type];
  if (known) return [known[0], known[1], known[2]];
  const count = Math.max(total, 1);
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(angle) * 2.4, 0.7, Math.sin(angle) * 2.4];
}

export function buildStressScene(
  result: Pick<
    StressResult,
    "nodes" | "cascadePath" | "firstBreak" | "modeled" | "forecast"
  >,
  graph: { edges: Pick<DependencyEdge, "from" | "to">[] },
  home?: Pick<HomeProfile, "dwellingType" | "stories"> | null,
): StressSceneModel {
  const profile = home;
  const cascade = new Set(result.cascadePath);
  const firstBreakId = result.firstBreak?.id ?? null;
  const nodes: StressSceneNode[] = result.nodes.map((node, index) => {
    const failed = isFailedLevel(node.level);
    return {
      id: node.id,
      type: node.type,
      label: node.label,
      shortLabel: shortSceneLabel(node.label),
      position: positionForNode(node.id, node.type, index, result.nodes.length),
      level: node.level,
      capacity: node.capacity,
      inCascade: cascade.has(node.id),
      isFirstBreak: node.id === firstBreakId,
      failed,
      color: SCENE_LEVEL_COLOR[node.level],
    };
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges: StressSceneEdge[] = [];
  for (const edge of graph.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;
    edges.push({
      from: edge.from,
      to: edge.to,
      fromPos: from.position,
      toPos: to.position,
      inCascade: cascade.has(edge.from) && cascade.has(edge.to),
    });
  }

  const homeNode = nodes.find((node) => node.id === "home");
  const partIds: HousePartId[] = ["roof", "openings", "lowest_floor", "pipes"];
  const houseParts = partIds.map((id) => {
    const node = nodes.find((item) => item.id === id);
    const level = node?.level ?? "none";
    return { id, level, why: housePartWhy(id, level) };
  });
  return {
    modeled: true,
    forecast: false,
    nodes,
    edges,
    firstBreakId,
    cascadePath: result.cascadePath.filter((id) => typeof id === "string"),
    houseLevel: homeNode?.level ?? "none",
    houseParts,
    dwellingType:
      profile && isKnown(profile.dwellingType)
        ? profile.dwellingType
        : "single_family",
    stories:
      profile && isKnown(profile.stories) ? Math.min(profile.stories, 4) : 1,
  };
}

export function sceneNodesFromStates(
  nodes: NodeState[],
  edges: Pick<DependencyEdge, "from" | "to">[],
  cascadePath: string[],
  firstBreakId: string | null,
  home?: Pick<HomeProfile, "dwellingType" | "stories"> | null,
): StressSceneModel {
  return buildStressScene(
    {
      modeled: true,
      forecast: false,
      nodes,
      cascadePath,
      firstBreak: firstBreakId
        ? (nodes.find((node) => node.id === firstBreakId) ?? null)
        : null,
    },
    { edges },
    home,
  );
}

type CanvasLike = {
  getContext: (id: string) => unknown;
};

/**
 * Fail closed: missing document, thrown getContext, or no WebGL → no 3D.
 */
export function canUseWebGL(
  createCanvas: () => CanvasLike | null = defaultCanvas,
): boolean {
  try {
    const canvas = createCanvas();
    if (!canvas) return false;
    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

function defaultCanvas(): CanvasLike | null {
  if (typeof document === "undefined") return null;
  return document.createElement("canvas");
}
