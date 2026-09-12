/**
 * Schematic map layout for modeled household stress.
 * Positions are invented offsets around an approximate home marker.
 * They are not utility topology, substations, or official infrastructure.
 */

import type { DependencyEdge } from "@/lib/stress";
import type {
  DisruptionLevel,
  NodeState,
  StressProvenance,
  StressResult,
} from "@/lib/stress";
import type { LatLon } from "@/lib/map/location";

export const MODELED_DEPENDENCIES_DISCLAIMER =
  "Modeled dependencies — not official infrastructure.";

export const OVERLAY_SIMULATED_NOTE =
  "Simulated household model. Not live NWS and not a utility map.";

const METERS_PER_DEG_LAT = 111_320;
/** Schematic ring — far enough to read, not a real service location. */
const RING_METERS = 520;

export const FORBIDDEN_OVERLAY_CLAIMS = [
  "utility topology",
  "substation",
  "verified grid",
  "official utility",
] as const;

export type OverlayLinkKind = "modeled_edge" | "cascade";

export type StressOverlayPoint = {
  id: string;
  label: string;
  type: NodeState["type"];
  level: DisruptionLevel;
  capacity: number;
  source: StressProvenance;
  latitude: number;
  longitude: number;
  inCascade: boolean;
  isFirstBreak: boolean;
  /** Schematic offset from the approximate home marker, not a real site. */
  schematic: true;
};

export type StressOverlayLink = {
  fromId: string;
  toId: string;
  kind: OverlayLinkKind;
};

export type StressOverlayModel = {
  disclaimer: typeof MODELED_DEPENDENCIES_DISCLAIMER;
  simulatedNote: typeof OVERLAY_SIMULATED_NOTE;
  modeled: true;
  forecast: false;
  officialInfrastructure: false;
  scenarioLabel: string;
  householdAccess: number;
  disruptionLevel: DisruptionLevel;
  points: StressOverlayPoint[];
  links: StressOverlayLink[];
};

export function offsetFromAnchor(
  anchor: LatLon,
  headingDeg: number,
  meters: number,
): LatLon {
  const rad = (headingDeg * Math.PI) / 180;
  const degLat = meters / METERS_PER_DEG_LAT;
  const cosLat = Math.cos(anchor.latitude * (Math.PI / 180));
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.max(0.2, Math.abs(cosLat));
  const degLon = meters / metersPerDegLon;
  return {
    latitude: anchor.latitude + degLat * Math.cos(rad),
    longitude: anchor.longitude + degLon * Math.sin(rad),
  };
}

function headingForId(id: string, index: number, count: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const spread = count > 0 ? (360 / count) * index : 0;
  return (spread + (hash % 17)) % 360;
}

export function layoutStressOverlay(input: {
  result: StressResult;
  anchor: LatLon;
  edges?: readonly DependencyEdge[];
}): StressOverlayModel {
  const { result, anchor, edges = [] } = input;
  const cascade = new Set(result.cascadePath);
  const firstBreakId = result.firstBreak?.id ?? null;

  const others = result.nodes
    .filter((node) => node.id !== "home")
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const points: StressOverlayPoint[] = result.nodes.map((node) => {
    const isHome = node.id === "home";
    const index = others.findIndex((item) => item.id === node.id);
    const heading = isHome ? 0 : headingForId(node.id, Math.max(0, index), others.length);
    const position = isHome
      ? anchor
      : offsetFromAnchor(anchor, heading, RING_METERS);

    return {
      id: node.id,
      label: node.label,
      type: node.type,
      level: node.level,
      capacity: node.capacity,
      source: node.source,
      latitude: position.latitude,
      longitude: position.longitude,
      inCascade: cascade.has(node.id),
      isFirstBreak: firstBreakId === node.id,
      schematic: true,
    };
  });

  const pointIds = new Set(points.map((point) => point.id));
  const links: StressOverlayLink[] = [];
  const seen = new Set<string>();

  const pushLink = (fromId: string, toId: string, kind: OverlayLinkKind) => {
    if (!pointIds.has(fromId) || !pointIds.has(toId) || fromId === toId) return;
    const key = `${kind}:${fromId}->${toId}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ fromId, toId, kind });
  };

  for (const edge of edges) {
    pushLink(edge.from, edge.to, "modeled_edge");
  }

  for (let i = 0; i < result.cascadePath.length - 1; i += 1) {
    const fromId = result.cascadePath[i];
    const toId = result.cascadePath[i + 1];
    if (fromId && toId) pushLink(fromId, toId, "cascade");
  }

  return {
    disclaimer: MODELED_DEPENDENCIES_DISCLAIMER,
    simulatedNote: OVERLAY_SIMULATED_NOTE,
    modeled: true,
    forecast: false,
    officialInfrastructure: false,
    scenarioLabel: result.scenario.label,
    householdAccess: result.householdAccess,
    disruptionLevel: result.disruptionLevel,
    points,
    links,
  };
}

export function overlayHasContent(
  result: StressResult | null | undefined,
): result is StressResult {
  return Boolean(result);
}

export function overlayPointsAsLatLon(
  overlay: StressOverlayModel | null | undefined,
): LatLon[] {
  if (!overlay) return [];
  return overlay.points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
  }));
}
