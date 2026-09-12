"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resolveMapView } from "@/lib/map/location";
import { MAP_LOCATOR_LINKS } from "@/lib/map/resources";
import {
  MAP_PLACE_KIND_LABEL,
  MAP_PLACE_KIND_LETTER,
  OSM_PLACE_DISCLAIMER,
  type MapPlaceKind,
  type MapPlacePin,
} from "@/lib/map/places";
import { useProfile } from "@/lib/use-profile";
import {
  fetchMapPlaces,
  fetchPlaceHours,
  statusFromResult,
  type ResourceStatus,
} from "@/lib/stormready-api";
import { LoadingCard } from "@/components/stormready/query-state";
import { UnavailableNote } from "@/components/stormready/unavailable-note";
import {
  PlaceHoursChip,
  PlaceOffers,
  PlaceTypeChip,
} from "@/components/map/place-chips";
import {
  GOOGLE_HOURS_DISCLAIMER,
  hoursOutlookForMatch,
  type PinHoursMatch,
} from "@/lib/map/google-hours";

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

const KIND_ORDER: MapPlaceKind[] = [
  "grocery",
  "pharmacy",
  "food_bank",
  "hospital",
  "clinic",
  "shelter",
  "assembly_point",
];

export function MapView() {
  const { profile, hydrated } = useProfile();
  const view = resolveMapView(profile.home?.location);
  const [pins, setPins] = useState<MapPlacePin[]>([]);
  const [placesStatus, setPlacesStatus] = useState<ResourceStatus>("idle");
  const [placesReload, setPlacesReload] = useState(0);
  const [hoursByPinId, setHoursByPinId] = useState<Record<string, PinHoursMatch>>(
    {},
  );
  const [hoursConfigured, setHoursConfigured] = useState<boolean | null>(null);
  const [hoursStatus, setHoursStatus] = useState<ResourceStatus>("idle");
  const [hoursAt, setHoursAt] = useState<Date | null>(null);

  const queryLat = view.approximateHome?.latitude ?? view.center.latitude;
  const queryLon = view.approximateHome?.longitude ?? view.center.longitude;

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setPlacesStatus("loading");
    setHoursByPinId({});
    setHoursConfigured(null);
    setHoursStatus("idle");
    setHoursAt(null);
    (async () => {
      const result = await fetchMapPlaces({
        latitude: queryLat,
        longitude: queryLon,
      });
      if (cancelled) return;
      setPlacesStatus(statusFromResult(result));
      setPins(result.ok ? result.data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, placesReload, queryLat, queryLon]);

  useEffect(() => {
    if (placesStatus !== "ready" || pins.length === 0) return;
    let cancelled = false;
    setHoursStatus("loading");
    (async () => {
      const result = await fetchPlaceHours({
        latitude: queryLat,
        longitude: queryLon,
        pins: pins.map((pin) => ({
          id: pin.id,
          kind: pin.kind,
          latitude: pin.latitude,
          longitude: pin.longitude,
        })),
      });
      if (cancelled) return;
      setHoursAt(new Date());
      setHoursStatus(statusFromResult(result));
      if (!result.ok) {
        setHoursConfigured(null);
        setHoursByPinId({});
        return;
      }
      setHoursConfigured(result.data.configured);
      const next: Record<string, PinHoursMatch> = {};
      for (const match of result.data.hours) {
        next[match.pinId] = match;
      }
      setHoursByPinId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [pins, placesStatus, queryLat, queryLon]);

  const kindsOnMap = KIND_ORDER.filter((kind) =>
    pins.some((pin) => pin.kind === kind),
  );

  return (
    <div className="flex flex-1 flex-col gap-3 px-5 pb-8 pt-4">
      {!hydrated ? (
        <Card title="Map">Loading this device…</Card>
      ) : view.hasHomeLocation ? (
        <Card eyebrow="Approximate" title="Your saved location">
          The home marker is offset so the exact address is not shown. Nearby
          dots are grocery / food / utilities, pharmacy, clinic, and mapped
          shelter-style points.
          Green or red means posted hours say the place is open or closed{" "}
          <span className="font-semibold text-foreground">right now</span>
          — not a model.
        </Card>
      ) : (
        <Card eyebrow="No home location yet" title="Tampa demo area">
          Set up your plan to place an approximate marker for this home. Until
          then, the map is centered on the Tampa demo. Pin color is posted hours
          for right now, not a model.
          <div className="mt-3">
            <Button href="/onboarding" variant="secondary">
              Set up your plan
            </Button>
          </div>
        </Card>
      )}

      <div className="sr-map-frame relative z-0 overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_10px_30px_rgba(16,35,61,0.06)]">
        {hydrated ? (
          <StormMap
            center={view.center}
            zoom={view.zoom}
            approximateHome={view.approximateHome}
            pins={pins}
            hoursByPinId={hoursByPinId}
            hoursAt={hoursAt}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Loading map…
          </div>
        )}
      </div>

      {placesStatus === "loading" ? (
        <LoadingCard
          title="Nearby access"
          label="Looking up grocery, pharmacy, and mapped shelter points…"
          lines={2}
        />
      ) : null}
      {placesStatus === "error" ? (
        <UnavailableNote title="Nearby access">
          OpenStreetMap did not return grocery, pharmacy, or hospital points.
          StormReady will not invent them.
          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPlacesReload((value) => value + 1)}
            >
              Try OpenStreetMap again
            </Button>
          </div>
        </UnavailableNote>
      ) : null}
      {placesStatus === "unavailable" ? (
        <UnavailableNote title="Nearby access">
          Nearby OpenStreetMap places are unavailable. This is not an empty-area
          all-clear and not a closed-store list.
          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPlacesReload((value) => value + 1)}
            >
              Try OpenStreetMap again
            </Button>
          </div>
        </UnavailableNote>
      ) : null}

      {hoursStatus === "loading" ? (
        <LoadingCard
          title="Open or closed now"
          label="Checking posted hours for right now…"
          lines={1}
        />
      ) : null}
      {hoursStatus === "error" || hoursStatus === "unavailable" ? (
        <UnavailableNote title="Open or closed now">
          Posted hours did not load. StormReady will not guess whether a place
          is open.
        </UnavailableNote>
      ) : null}
      {hoursStatus === "ready" && hoursConfigured === false ? (
        <UnavailableNote title="Open or closed now">
          Posted hours are off until a server-only{" "}
          <code>GOOGLE_PLACES_API_KEY</code> is set. StormReady will not model
          or guess open/closed.
        </UnavailableNote>
      ) : null}
      {hoursStatus === "ready" && hoursConfigured ? (
        <Card eyebrow="Not a model" title="Open or closed right now">
          <p className="text-xs leading-relaxed text-muted">
            {GOOGLE_HOURS_DISCLAIMER} Green = open now. Red = closed now. Gray
            = no hours matched that pin.
          </p>
        </Card>
      ) : null}

      {placesStatus === "ready" && pins.length > 0 ? (
        <Card eyebrow="Nearby" title="Access points on this map">
          <p className="mb-3 text-xs leading-relaxed text-muted">
            {OSM_PLACE_DISCLAIMER}
          </p>
          {kindsOnMap.length > 0 ? (
            <ul className="mb-3 flex flex-wrap gap-3" aria-label="Place types">
              {kindsOnMap.map((kind) => (
                <li key={kind} className="flex items-center gap-2 text-xs">
                  <span
                    aria-hidden
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: "#64748b" }}
                  >
                    {MAP_PLACE_KIND_LETTER[kind]}
                  </span>
                  {MAP_PLACE_KIND_LABEL[kind]}
                </li>
              ))}
            </ul>
          ) : null}
          <ul>
            {pins.map((pin) => {
              const hoursMatch = hoursByPinId[pin.id];
              const hoursOutlook = hoursMatch
                ? hoursOutlookForMatch(hoursMatch, hoursAt ?? new Date())
                : null;
              return (
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
                  <PlaceOffers kind={pin.kind} />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <PlaceTypeChip kind={pin.kind} />
                    {hoursOutlook ? (
                      <PlaceHoursChip outlook={hoursOutlook} />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {placesStatus === "ready" && pins.length === 0 ? (
        <Card eyebrow="Nearby" title="No mapped access points nearby">
          No grocery, pharmacy, clinic, or mapped shelter tags in this window.
          That is not an all-clear. Use the official locators below.
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
