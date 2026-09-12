import { NextResponse } from "next/server";
import {
  fetchNwsAlerts,
  geocode,
  httpStatusForUnavailable,
  unknownHazardState,
  type GeocodeOk,
  type GeocodeQuery,
} from "@/lib/integrations";
import { isKnown } from "@/lib/stormready";

export const dynamic = "force-dynamic";

/**
 * Anonymous NWS alerts + forecast for a point.
 * Accepts lat/lon, or an address/ZIP (geocoded first).
 * Fail closed: if points or alerts cannot be confirmed, returns unavailable
 * and does not fabricate an all-clear.
 */
export async function GET(request: Request) {
  return respond(inputFromSearchParams(new URL(request.url).searchParams));
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body === null) {
    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        reason: "invalid_input",
        message: "Request body must be JSON with lat/lon or an address/ZIP.",
        service: "nws",
        hazards: unknownHazardState(),
      },
      { status: 400 },
    );
  }
  return respond(inputFromRecord(body));
}

type AlertsInput = {
  latitude: number | null;
  longitude: number | null;
  geocodeQuery: GeocodeQuery;
};

async function respond(input: AlertsInput) {
  let geocodeResult: GeocodeOk | undefined;
  let latitude = input.latitude;
  let longitude = input.longitude;

  const hasCoords =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  if (!hasCoords) {
    if (!hasGeocodeInput(input.geocodeQuery)) {
      return NextResponse.json(
        {
          ok: false,
          status: "unavailable",
          reason: "invalid_input",
          message:
            "Provide latitude and longitude, or an address / ZIP to geocode first.",
          service: "nws",
          hazards: unknownHazardState(),
        },
        { status: 400 },
      );
    }

    const geo = await geocode(input.geocodeQuery);
    if (!geo.ok) {
      return NextResponse.json(
        { ...geo, hazards: unknownHazardState() },
        { status: httpStatusForUnavailable(geo) },
      );
    }
    if (!isKnown(geo.location.latitude) || !isKnown(geo.location.longitude)) {
      return NextResponse.json(
        {
          ok: false,
          status: "unavailable",
          reason: "no_match",
          message:
            "Geocode succeeded without usable coordinates. Alerts were not requested.",
          service: "geocode",
          hazards: unknownHazardState(),
        },
        { status: 404 },
      );
    }
    geocodeResult = geo;
    latitude = geo.location.latitude;
    longitude = geo.location.longitude;
  }

  if (latitude === null || longitude === null) {
    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        reason: "invalid_input",
        message:
          "Provide latitude and longitude, or an address / ZIP to geocode first.",
        service: "nws",
        hazards: unknownHazardState(),
      },
      { status: 400 },
    );
  }

  const result = await fetchNwsAlerts({ latitude, longitude });
  if (!result.ok) {
    return NextResponse.json(
      { ...result, hazards: unknownHazardState() },
      { status: httpStatusForUnavailable(result) },
    );
  }

  return NextResponse.json({
    ...result,
    ...(geocodeResult ? { geocode: geocodeResult } : {}),
  });
}

function inputFromSearchParams(params: URLSearchParams): AlertsInput {
  return inputFromRecord({
    latitude: params.get("latitude") ?? params.get("lat"),
    longitude: params.get("longitude") ?? params.get("lon") ?? params.get("lng"),
    address: params.get("address") ?? params.get("q"),
    addressLine: params.get("addressLine") ?? params.get("street"),
    city: params.get("city"),
    state: params.get("state"),
    postalCode: params.get("postalCode") ?? params.get("zip"),
  });
}

function inputFromRecord(value: Record<string, unknown>): AlertsInput {
  const location =
    value.location !== null &&
    typeof value.location === "object" &&
    !Array.isArray(value.location)
      ? (value.location as Record<string, unknown>)
      : null;
  return {
    latitude: asNumber(value.latitude ?? value.lat ?? location?.latitude ?? location?.lat),
    longitude: asNumber(
      value.longitude ??
        value.lon ??
        value.lng ??
        location?.longitude ??
        location?.lon ??
        location?.lng,
    ),
    geocodeQuery: {
      address: asString(value.address) ?? asString(value.q),
      addressLine: asString(value.addressLine) ?? asString(value.street),
      city: asString(value.city),
      state: asString(value.state),
      postalCode:
        asString(value.postalCode) ?? asString(value.zip) ?? asString(value.postal),
    },
  };
}

async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const parsed: unknown = await request.json().catch(() => null);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function hasGeocodeInput(query: GeocodeQuery): boolean {
  return Boolean(
    query.address ||
      query.addressLine ||
      query.city ||
      query.state ||
      query.postalCode,
  );
}
