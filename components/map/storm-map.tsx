"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MapResourcePin } from "@/lib/map/resources";
import type { LatLon } from "@/lib/map/location";
import { getMapTileLayer } from "@/lib/map/resources";

const HOME_COLOR = "#1e4f86";
const PIN_COLORS: Record<MapResourcePin["kind"], string> = {
  forecast_office: "#5a6d82",
  emergency_management: "#2c6aa8",
  red_cross: "#6b4f5b",
};

type StormMapProps = {
  center: LatLon;
  zoom: number;
  approximateHome: LatLon | null;
  pins: MapResourcePin[];
};

function Recenter({ center, zoom }: { center: LatLon; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.latitude, center.longitude], zoom);
  }, [center.latitude, center.longitude, map, zoom]);
  return null;
}

export function StormMap({
  center,
  zoom,
  approximateHome,
  pins,
}: StormMapProps) {
  const tiles = getMapTileLayer();

  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-full w-full"
      attributionControl
    >
      <Recenter center={center} zoom={zoom} />
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
          <Popup>
            <p className="text-sm font-semibold text-foreground">
              Approximate home location
            </p>
            <p className="mt-1 text-xs text-muted">
              Offset on purpose. This is not your exact address.
            </p>
          </Popup>
        </CircleMarker>
      ) : null}
      {pins.map((pin) => (
        <CircleMarker
          key={pin.id}
          center={[pin.latitude, pin.longitude]}
          radius={8}
          pathOptions={{
            color: PIN_COLORS[pin.kind],
            fillColor: PIN_COLORS[pin.kind],
            fillOpacity: 0.8,
            weight: 2,
          }}
        >
          <Popup>
            <p className="text-sm font-semibold text-foreground">{pin.title}</p>
            <p className="mt-1 text-xs text-muted">{pin.description}</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
              Source: {pin.source}
            </p>
            <a
              href={pin.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-semibold text-accent-strong underline-offset-2 hover:underline"
            >
              Official page
            </a>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
