"use client";

import type { DependencyEdge, DisruptionLevel, NodeState } from "@/lib/stress";

export const STRESS_CASCADE_COLUMNS: readonly (readonly string[])[] = [
  ["local_feeder", "power", "water", "road"],
  ["roof", "openings", "lowest_floor", "pipes", "home"],
  ["elevator", "charging", "transport", "mobility"],
  ["communication", "food", "healthcare", "shelter"],
];

export const STRESS_CASCADE_VIEW = {
  width: 398,
  nodeWidth: 90,
  nodeHeight: 36,
  columnGap: 10,
  rowGap: 10,
  padding: 8,
} as const;

export type CascadeLaidOutNode = {
  id: string;
  label: string;
  level: DisruptionLevel;
  x: number;
  y: number;
  width: number;
  height: number;
  inCascade: boolean;
};

export type CascadeLaidOutEdge = {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  inCascade: boolean;
};

export type CascadeLayout = {
  nodes: CascadeLaidOutNode[];
  edges: CascadeLaidOutEdge[];
  width: number;
  height: number;
};

function columnFor(id: string): number {
  const index = STRESS_CASCADE_COLUMNS.findIndex((column) => column.includes(id));
  return index >= 0 ? index : STRESS_CASCADE_COLUMNS.length - 1;
}

function rowFor(id: string, columnIds: string[]): number {
  const preferred = STRESS_CASCADE_COLUMNS[columnFor(id)] ?? [];
  const preferredIndex = preferred.indexOf(id);
  if (preferredIndex >= 0) return preferredIndex;
  return columnIds.indexOf(id);
}

export function layoutStressCascade(
  nodes: Pick<NodeState, "id" | "label" | "level">[],
  edges: Pick<DependencyEdge, "from" | "to">[],
  cascadePath: string[],
): CascadeLayout {
  const { width, nodeWidth, nodeHeight, columnGap, rowGap, padding } = STRESS_CASCADE_VIEW;
  const cascade = new Set(cascadePath);
  const columnCount = STRESS_CASCADE_COLUMNS.length;
  const usable = width - padding * 2;
  const colWidth = (usable - columnGap * (columnCount - 1)) / columnCount;
  const xForCol = (col: number) =>
    padding + col * (colWidth + columnGap) + (colWidth - nodeWidth) / 2;

  const idsByColumn: string[][] = STRESS_CASCADE_COLUMNS.map(() => []);
  for (const node of nodes) {
    const col = columnFor(node.id);
    if (!idsByColumn[col]!.includes(node.id)) {
      idsByColumn[col]!.push(node.id);
    }
  }
  for (let col = 0; col < idsByColumn.length; col += 1) {
    idsByColumn[col]!.sort((a, b) => rowFor(a, idsByColumn[col]!) - rowFor(b, idsByColumn[col]!));
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const laidOut: CascadeLaidOutNode[] = [];
  let maxRow = 0;
  idsByColumn.forEach((ids, col) => {
    ids.forEach((id, row) => {
      const source = nodeMap.get(id);
      if (!source) return;
      maxRow = Math.max(maxRow, row);
      laidOut.push({
        id,
        label: source.label,
        level: source.level,
        x: xForCol(col),
        y: padding + row * (nodeHeight + rowGap),
        width: nodeWidth,
        height: nodeHeight,
        inCascade: cascade.has(id),
      });
    });
  });

  const byId = new Map(laidOut.map((node) => [node.id, node]));
  const laidEdges: CascadeLaidOutEdge[] = [];
  for (const edge of edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;
    laidEdges.push({
      from: edge.from,
      to: edge.to,
      x1: from.x + from.width,
      y1: from.y + from.height / 2,
      x2: to.x,
      y2: to.y + to.height / 2,
      inCascade: cascade.has(edge.from) && cascade.has(edge.to),
    });
  }

  const height =
    padding * 2 + (maxRow + 1) * nodeHeight + Math.max(0, maxRow) * rowGap;

  return { nodes: laidOut, edges: laidEdges, width, height: Math.max(height, 120) };
}

function fillFor(level: DisruptionLevel, inCascade: boolean): string {
  if (inCascade && (level === "major" || level === "critical")) {
    return "color-mix(in srgb, var(--danger) 18%, white)";
  }
  if (inCascade) return "color-mix(in srgb, var(--accent) 16%, white)";
  if (level === "critical" || level === "major") {
    return "color-mix(in srgb, var(--warning) 12%, white)";
  }
  return "var(--surface)";
}

function strokeFor(level: DisruptionLevel, inCascade: boolean): string {
  if (level === "critical" || level === "major") return "var(--danger)";
  if (inCascade || level === "constrained") return "var(--accent-strong)";
  return "var(--border)";
}

export function StressCascade({
  nodes,
  edges,
  cascadePath,
  weakestId,
}: {
  nodes: NodeState[];
  edges: Pick<DependencyEdge, "from" | "to">[];
  cascadePath: string[];
  weakestId?: string;
}) {
  const layout = layoutStressCascade(nodes, edges, cascadePath);

  if (layout.nodes.length === 0) {
    return (
      <p className="text-sm text-muted">
        No modeled nodes to draw for this household graph.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label="Modeled cascade: household dependencies under this simulated scenario"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width="100%"
        height={layout.height}
      >
        {layout.edges.map((edge) => (
          <line
            key={`${edge.from}-${edge.to}`}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            className={edge.inCascade ? "sr-cascade-edge" : undefined}
            stroke={edge.inCascade ? "var(--accent-strong)" : "var(--border)"}
            strokeWidth={edge.inCascade ? 2.2 : 1.2}
          />
        ))}
        {layout.nodes.map((node) => (
          <g key={node.id} className={`sr-cascade-node${node.id === weakestId ? " is-weakest" : ""}`} transform={`translate(${node.x} ${node.y})`}>
            <rect
              width={node.width}
              height={node.height}
              rx={10}
              fill={fillFor(node.level, node.inCascade)}
              stroke={strokeFor(node.level, node.inCascade)}
              strokeWidth={node.inCascade ? 1.8 : 1.2}
            />
            <text
              x={node.width / 2}
              y={14}
              textAnchor="middle"
              fill="var(--foreground)"
              fontSize={8.5}
              fontWeight={600}
            >
              {shortLabel(node.label)}
            </text>
            <text
              x={node.width / 2}
              y={26}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize={7.5}
            >
              {node.level}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function shortLabel(label: string): string {
  if (label.length <= 16) return label;
  return `${label.slice(0, 14)}…`;
}
