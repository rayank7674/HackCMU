import { shortSceneLabel } from "./copy";
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
};

export const SCENE_LEVEL_COLOR: Record<DisruptionLevel, string> = {
  none: "#7a8ea3",
  constrained: "#c4a15a",
  major: "#c4733a",
  critical: "#9b3d3d",
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

export type StressSceneModel = {
  modeled: true;
  forecast: false;
  nodes: StressSceneNode[];
  edges: StressSceneEdge[];
  firstBreakId: string | null;
  cascadePath: string[];
  houseLevel: DisruptionLevel;
};

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
): StressSceneModel {
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

  const home = nodes.find((node) => node.id === "home");
  return {
    modeled: true,
    forecast: false,
    nodes,
    edges,
    firstBreakId,
    cascadePath: result.cascadePath.filter((id) => typeof id === "string"),
    houseLevel: home?.level ?? "none",
  };
}

export function sceneNodesFromStates(
  nodes: NodeState[],
  edges: Pick<DependencyEdge, "from" | "to">[],
  cascadePath: string[],
  firstBreakId: string | null,
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
