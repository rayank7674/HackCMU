"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { divIcon, latLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import { pointsForBounds, type LatLon } from "@/lib/map/location";
import { getMapTileLayer } from "@/lib/map/resources";
import {
  MAP_PLACE_KIND_LABEL,
  MAP_PLACE_KIND_LETTER,
  type MapPlaceKind,
  type MapPlacePin,
} from "@/lib/map/places";
import {
  PlaceHoursChip,
  PlaceOffers,
  PlaceTypeChip,
} from "@/components/map/place-chips";
import {
  GOOGLE_HOURS_DISCLAIMER,
  HOURS_OUTLOOK_FILL,
  HOURS_OUTLOOK_LETTER,
  hoursOutlookForMatch,
  type PinHoursMatch,
} from "@/lib/map/google-hours";

const HOME_COLOR = "#1e4f86";
const NEUTRAL_FILL = "#64748b";
const NEUTRAL_LETTER = "#ffffff";

function placeDivIcon(kind: MapPlaceKind, fill: string, letterColor: string) {
  const letter = MAP_PLACE_KIND_LETTER[kind];
  return divIcon({
    className: "sr-place-pin",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
    html: `<span class="sr-place-pin-dot" style="background:${fill};color:${letterColor}">${letter}</span>`,
  });
}

type StormMapProps = {
  center: LatLon;
  zoom: number;
  approximateHome: LatLon | null;
  pins: MapPlacePin[];
  hoursByPinId?: Record<string, PinHoursMatch>;
  hoursAt?: Date | null;
};

function Recenter({ center, zoom }: { center: LatLon; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.latitude, center.longitude], zoom);
  }, [center.latitude, center.longitude, map, zoom]);
  return null;
}

function InvalidateMapSize() {
  const map = useMap();
  useEffect(() => {
    const refresh = () => map.invalidateSize();
    refresh();
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
    };
  }, [map]);
  return null;
}

function FitPins({
  home,
  pins,
}: {
  home: LatLon | null;
  pins: MapPlacePin[];
}) {
  const map = useMap();
  useEffect(() => {
    const points = pointsForBounds(home, pins);
    if (points.length < 2) return;
    const bounds = latLngBounds(
      points.map((point) => [point.latitude, point.longitude] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
  }, [home, map, pins]);
  return null;
}

export function StormMap({
  center,
  zoom,
  approximateHome,
  pins,
  hoursByPinId = {},
  hoursAt = null,
}: StormMapProps) {
  const tiles = getMapTileLayer();
  const clock = hoursAt ?? new Date();

  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-full w-full"
      attributionControl
    >
      <InvalidateMapSize />
      {pins.length > 0 ? (
        <FitPins home={approximateHome} pins={pins} />
      ) : (
        <Recenter center={center} zoom={zoom} />
      )}
      <TileLayer
        url={tiles.url}
        attribution={tiles.attribution}
        {...(tiles.tileSize
          ? { tileSize: tiles.tileSize, zoomOffset: tiles.zoomOffset }
          : {})}
      />
      {approximateHome ? (
        <CircleMarker
          center={[approximateHome.latitude, approximateHome.longitude]}
          radius={10}
          pathOptions={{
            color: HOME_COLOR,
            fillColor: HOME_COLOR,
            fillOpacity: 0.85,
            weight: 2,
          }}
        >
          <Popup maxWidth={200} autoPan>
            <p className="text-sm font-semibold text-foreground">
              Approximate home location
            </p>
            <p className="mt-1 text-xs text-muted">Not your exact address.</p>
          </Popup>
        </CircleMarker>
      ) : null}
      {pins.map((pin) => {
        const hoursMatch = hoursByPinId[pin.id];
        const hoursOutlook = hoursMatch
          ? hoursOutlookForMatch(hoursMatch, clock)
          : null;
        const usesHours = hoursOutlook != null && hoursOutlook !== "unknown";
        const fill = usesHours
          ? HOURS_OUTLOOK_FILL[hoursOutlook]
          : NEUTRAL_FILL;
        const letterColor = usesHours
          ? HOURS_OUTLOOK_LETTER[hoursOutlook]
          : NEUTRAL_LETTER;
        const titleExtra = usesHours
          ? hoursOutlook === "usually_open"
            ? "Open now"
            : "Closed now"
          : null;
        return (
          <Marker
            key={pin.id}
            position={[pin.latitude, pin.longitude]}
            icon={placeDivIcon(pin.kind, fill, letterColor)}
            zIndexOffset={usesHours && hoursOutlook === "usually_closed" ? 500 : 200}
            title={
              titleExtra
                ? `${MAP_PLACE_KIND_LABEL[pin.kind]} · ${titleExtra}`
                : MAP_PLACE_KIND_LABEL[pin.kind]
            }
          >
            <Popup maxWidth={260} autoPan>
              <p className="text-sm font-semibold text-foreground">{pin.title}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <PlaceTypeChip kind={pin.kind} />
                {hoursOutlook ? <PlaceHoursChip outlook={hoursOutlook} /> : null}
              </div>
              <PlaceOffers kind={pin.kind} />
              {hoursMatch ? (
                <p className="mt-2 text-xs text-muted">
                  {hoursMatch.weekdayDescriptions[0]
                    ? `${hoursMatch.weekdayDescriptions[0]} `
                    : ""}
                  {GOOGLE_HOURS_DISCLAIMER}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  Mapped in OpenStreetMap. Hours and stock are not confirmed here.
                </p>
              )}
              <a
                href={pin.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-accent-strong underline-offset-2 hover:underline"
              >
                Open in OpenStreetMap
              </a>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
