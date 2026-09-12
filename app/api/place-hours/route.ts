import { NextResponse } from "next/server";
import {
  fetchGooglePlacesNearby,
  isGooglePlacesConfigured,
  matchPinsToGoogleHours,
} from "@/lib/integrations/google-places";
import { PLACE_SEARCH_RADIUS_KM, type MapPlaceKind } from "@/lib/map/places";
import { GOOGLE_HOURS_DISCLAIMER } from "@/lib/map/google-hours";

export const dynamic = "force-dynamic";

type PinInput = {
  id: string;
  kind: MapPlaceKind;
  latitude: number;
  longitude: number;
};

/**
 * Usual Google Places hours for OSM pins near a point.
 * Not a live storm-closure feed and not historical Milton closures.
 */
export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, configured: isGooglePlacesConfigured(), hours: [], error: "invalid_json" },
      { status: 400 },
    );
  }
  const pins = parsePins(body);
  const center = parseCenter(body);
  if (!center) {
    return NextResponse.json(
      { ok: false, configured: isGooglePlacesConfigured(), hours: [], error: "invalid_input" },
      { status: 400 },
    );
  }

  if (!isGooglePlacesConfigured()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      hours: [],
      disclaimer:
        "GOOGLE_PLACES_API_KEY is not set. Posted hours are not available. FaultLine will not model open/closed.",
    });
  }

  const nearby = await fetchGooglePlacesNearby(
    center,
    PLACE_SEARCH_RADIUS_KM * 1000,
  );
  if (nearby.error && nearby.places.length === 0) {
    return NextResponse.json({
      ok: false,
      configured: true,
      hours: [],
      error: nearby.error,
      disclaimer:
      "Google Places did not return hours. FaultLine will not invent open/closed.",
    });
  }

  const hours = matchPinsToGoogleHours(pins, nearby.places);
  return NextResponse.json({
    ok: true,
    configured: true,
    hours,
    disclaimer: GOOGLE_HOURS_DISCLAIMER,
  });
}

function parseCenter(body: unknown): { latitude: number; longitude: number } | null {
  if (!body || typeof body !== "object") return null;
  const row = body as { latitude?: unknown; longitude?: unknown; lat?: unknown; lon?: unknown };
  const latitude = Number(row.latitude ?? row.lat);
  const longitude = Number(row.longitude ?? row.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function parsePins(body: unknown): PinInput[] {
  if (!body || typeof body !== "object") return [];
  const list = (body as { pins?: unknown }).pins;
  if (!Array.isArray(list)) return [];
  const out: PinInput[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string") continue;
    if (typeof row.kind !== "string") continue;
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    out.push({
      id: row.id,
      kind: row.kind as MapPlaceKind,
      latitude,
      longitude,
    });
  }
  return out;
}
