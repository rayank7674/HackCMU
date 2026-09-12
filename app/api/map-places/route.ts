import { NextResponse } from "next/server";
import { fetchOsmPlaces, httpStatusForUnavailable } from "@/lib/integrations";

export const dynamic = "force-dynamic";

/**
 * Nearby grocery, pharmacy, clinic, and mapped shelter-style points
 * from OpenStreetMap Overpass. Fail closed: never invents places.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = asNumber(params.get("latitude") ?? params.get("lat"));
  const longitude = asNumber(
    params.get("longitude") ?? params.get("lon") ?? params.get("lng"),
  );
  const radiusKm = asNumber(params.get("radiusKm") ?? params.get("radius"));

  if (latitude === null || longitude === null) {
    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        reason: "invalid_input",
        message: "Provide latitude and longitude to look up nearby OSM places.",
        service: "osm",
        pins: [],
      },
      { status: 400 },
    );
  }

  const result = await fetchOsmPlaces({ latitude, longitude, radiusKm });
  if (!result.ok) {
    return NextResponse.json(
      { ...result, pins: [] },
      { status: httpStatusForUnavailable(result) },
    );
  }
  return NextResponse.json(result);
}

function asNumber(value: string | number | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
