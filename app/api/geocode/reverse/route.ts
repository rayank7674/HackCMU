import { NextResponse } from "next/server";
import { emptyGeocodedLocation } from "@/lib/stormready";
import {
  httpStatusForUnavailable,
  reverseGeocode,
  validateCoordinates,
} from "@/lib/integrations";

export const dynamic = "force-dynamic";

/**
 * Census reverse geocode. Never invents a street for a ZIP-centroid match.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const coords = isRecord(body)
    ? validateCoordinates(body.latitude ?? body.lat, body.longitude ?? body.lon)
    : null;
  if (!coords) {
    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        reason: "invalid_input",
        message: "JSON body must include finite latitude and longitude.",
        service: "geocode",
        location: emptyGeocodedLocation(),
      },
      { status: 400 },
    );
  }
  const result = await reverseGeocode(coords);
  if (!result.ok) {
    return NextResponse.json(
      { ...result, location: emptyGeocodedLocation() },
      { status: httpStatusForUnavailable(result) },
    );
  }
  return NextResponse.json(result);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
