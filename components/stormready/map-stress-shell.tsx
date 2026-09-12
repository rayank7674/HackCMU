"use client";

import { useMemo, useState } from "react";
import { MapView } from "@/components/map/map-view";
import { MapStressControls } from "@/components/stormready/map-stress-controls";
import { useProfile } from "@/lib/use-profile";
import { resolveMapView } from "@/lib/map/location";
import { buildTampaDemoStressOverlay } from "@/lib/integrations/map/tampa-demo-stress";

/**
 * Map tab wrapper. Overlay is off by default so the map matches today.
 */
export function MapStressShell() {
  const { profile, hydrated } = useProfile();
  const [showOverlay, setShowOverlay] = useState(false);
  const view = resolveMapView(profile.home?.location);
  const anchor = view.approximateHome ?? view.center;

  const demo = useMemo(() => {
    if (!showOverlay || !hydrated) return null;
    return buildTampaDemoStressOverlay({
      latitude: anchor.latitude,
      longitude: anchor.longitude,
    });
  }, [anchor.latitude, anchor.longitude, hydrated, showOverlay]);

  return (
    <MapView
      leading={
        <MapStressControls
          enabled={showOverlay}
          onToggle={() => setShowOverlay((value) => !value)}
        />
      }
      stressOverlay={demo?.overlay ?? null}
    />
  );
}
