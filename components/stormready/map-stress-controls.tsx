"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TAMPA_DEMO_OVERLAY_LABEL } from "@/lib/integrations/map/tampa-demo-stress";

export function MapStressControls({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Card eyebrow="Optional" title="Modeled stress overlay">
      <p>
        Show a schematic overlay from the Tampa household fixture. It is
        simulated with the planning engine — not live NWS and not official
        infrastructure.
      </p>
      <div className="mt-3">
        <Button
          type="button"
          variant={enabled ? "secondary" : "primary"}
          onClick={onToggle}
          aria-pressed={enabled}
        >
          {enabled ? "Hide modeled overlay" : "Show Tampa modeled overlay"}
        </Button>
      </div>
      {enabled ? (
        <p className="mt-3 text-xs leading-relaxed">{TAMPA_DEMO_OVERLAY_LABEL}</p>
      ) : null}
    </Card>
  );
}
