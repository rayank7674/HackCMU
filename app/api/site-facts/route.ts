import { NextResponse } from "next/server";
import { lookupSiteFacts, validateCoordinates } from "@/lib/integrations";

export const dynamic = "force-dynamic";

/**
 * Optional FEMA flood zone + USGS elevation. Fail closed - never "not in a flood zone".
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
      },
      { status: 400 },
    );
  }
  const result = await lookupSiteFacts(coords.latitude, coords.longitude);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
