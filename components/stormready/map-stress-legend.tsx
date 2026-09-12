import { Card } from "@/components/ui/card";
import type { StressOverlayModel } from "@/lib/integrations/geo/stress-overlay";
import { MODELED_DEPENDENCIES_DISCLAIMER } from "@/lib/integrations/geo/stress-overlay";

const LEVEL_SWATCH: { level: string; color: string; label: string }[] = [
  { level: "none", color: "#7a8ea3", label: "None" },
  { level: "constrained", color: "#c4a15a", label: "Constrained" },
  { level: "major", color: "#c4733a", label: "Major" },
  { level: "critical", color: "#9b3d3d", label: "Critical" },
];

export function MapStressLegend({
  overlay,
}: {
  overlay: StressOverlayModel;
}) {
  return (
    <Card eyebrow="Modeled overlay" title={MODELED_DEPENDENCIES_DISCLAIMER}>
      <p>
        {overlay.simulatedNote} Scenario: {overlay.scenarioLabel}. Household
        access modeled at {overlay.householdAccess}% (
        {overlay.disruptionLevel}).
      </p>
      <ul className="mt-3 flex flex-wrap gap-3" aria-label="Disruption colors">
        {LEVEL_SWATCH.map((item) => (
          <li key={item.level} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
        Dots are planning offsets around the approximate home marker.
      </p>
    </Card>
  );
}
