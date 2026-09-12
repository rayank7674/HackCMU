"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resolveMapView } from "@/lib/map/location";
import { MAP_LOCATOR_LINKS, pinsForView } from "@/lib/map/resources";
import { useProfile } from "@/lib/use-profile";
import type { StressOverlayModel } from "@/lib/integrations/geo/stress-overlay";
import { MapStressLegend } from "@/components/stormready/map-stress-legend";

const StormMap = dynamic(
  () => import("./storm-map").then((mod) => mod.StormMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Loading map…
      </div>
    ),
  },
);

export function MapView({
  stressOverlay = null,
  leading = null,
}: {
  stressOverlay?: StressOverlayModel | null;
  leading?: ReactNode;
} = {}) {
  const { profile, hydrated } = useProfile();
  const view = resolveMapView(profile.home?.location);
  const pins = pinsForView(view.showTampaExamplePins);

  return (
    <div className="flex flex-1 flex-col gap-3 px-5 pb-8 pt-4">
      {leading}
      {!hydrated ? (
        <Card title="Map">Loading this device…</Card>
      ) : view.hasHomeLocation ? (
        <Card eyebrow="Approximate" title="Your saved location">
          The home marker is offset so the exact address is not shown. Resource
          pins are official offices or demo examples — not a ranking and not
          live shelter status.
        </Card>
      ) : (
        <Card eyebrow="No home location yet" title="Tampa demo area">
          Set up your plan to place an approximate marker for this home. Until
          then, the map is centered on the Tampa demo with a few labeled
          example points.
          <div className="mt-3">
            <Button href="/onboarding" variant="secondary">
              Set up your plan
            </Button>
          </div>
        </Card>
      )}

      <div className="relative z-0 h-[300px] overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_10px_30px_rgba(16,35,61,0.06)]">
        {hydrated ? (
          <StormMap
            center={view.center}
            zoom={view.zoom}
            approximateHome={view.approximateHome}
            pins={pins}
            stressOverlay={stressOverlay}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Loading map…
          </div>
        )}
      </div>

      {stressOverlay ? <MapStressLegend overlay={stressOverlay} /> : null}

      {!view.showTampaExamplePins && view.hasHomeLocation ? (
        <p className="text-xs leading-relaxed text-muted">
          Tampa-area example pins are hidden because your saved location is
          outside the demo area. Use the official locators below.
        </p>
      ) : null}

      {pins.length > 0 ? (
        <Card eyebrow="Examples" title="Points on this map">
          <ul>
            {pins.map((pin) => (
              <li
                key={pin.id}
                className="border-t border-border pt-3 first:border-t-0 first:pt-0"
              >
                <a
                  href={pin.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-accent-strong underline-offset-2 hover:underline"
                >
                  {pin.title}
                </a>
                <p className="mt-1">{pin.description}</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
                  Source: {pin.source}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Find official resources">
        <ul>
          {MAP_LOCATOR_LINKS.map((link) => (
            <li
              key={link.id}
              className="border-t border-border pt-3 first:border-t-0 first:pt-0"
            >
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent-strong underline-offset-2 hover:underline"
              >
                {link.title}
              </a>
              <p className="mt-1">{link.description}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
                Source: {link.source}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
