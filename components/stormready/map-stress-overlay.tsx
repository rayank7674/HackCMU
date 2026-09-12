"use client";

import { CircleMarker, Polyline, Popup } from "react-leaflet";
import type { DisruptionLevel } from "@/lib/stress";
import type {
  StressOverlayLink,
  StressOverlayModel,
  StressOverlayPoint,
} from "@/lib/integrations/geo/stress-overlay";

const LEVEL_COLOR: Record<DisruptionLevel, string> = {
  none: "#7a8ea3",
  constrained: "#c4a15a",
  major: "#c4733a",
  critical: "#9b3d3d",
};

function pointById(overlay: StressOverlayModel, id: string): StressOverlayPoint | undefined {
  return overlay.points.find((point) => point.id === id);
}

function linkPositions(
  overlay: StressOverlayModel,
  link: StressOverlayLink,
): [number, number][] | null {
  const from = pointById(overlay, link.fromId);
  const to = pointById(overlay, link.toId);
  if (!from || !to) return null;
  return [
    [from.latitude, from.longitude],
    [to.latitude, to.longitude],
  ];
}

/**
 * Leaflet layer for modeled household nodes. Schematic only.
 */
export function MapStressOverlay({
  overlay,
}: {
  overlay: StressOverlayModel;
}) {
  return (
    <>
      {overlay.links.map((link) => {
        const positions = linkPositions(overlay, link);
        if (!positions) return null;
        const cascade = link.kind === "cascade";
        return (
          <Polyline
            key={`${link.kind}-${link.fromId}-${link.toId}`}
            positions={positions}
            pathOptions={{
              color: cascade ? "#9b3d3d" : "#8aa0b5",
              weight: cascade ? 3 : 1.5,
              opacity: cascade ? 0.85 : 0.45,
              dashArray: cascade ? undefined : "6 6",
            }}
          />
        );
      })}
      {overlay.points
        .filter((point) => point.id !== "home")
        .map((point) => (
          <CircleMarker
            key={`stress-${point.id}`}
            center={[point.latitude, point.longitude]}
            radius={point.isFirstBreak ? 9 : 7}
            pathOptions={{
              color: LEVEL_COLOR[point.level],
              fillColor: LEVEL_COLOR[point.level],
              fillOpacity: 0.75,
              weight: point.inCascade ? 3 : 2,
            }}
          >
            <Popup maxWidth={220} autoPan>
              <p className="text-sm font-semibold text-foreground">{point.label}</p>
              <p className="mt-1 text-xs text-muted">
                Modeled capacity {point.capacity}% ({point.level}).
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                Schematic offset - not a real site
              </p>
            </Popup>
          </CircleMarker>
        ))}
    </>
  );
}
