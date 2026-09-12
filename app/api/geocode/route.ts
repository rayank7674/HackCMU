import { NextResponse } from "next/server";
import { emptyGeocodedLocation } from "@/lib/stormready";
import {
  geocode,
  httpStatusForUnavailable,
  type GeocodeQuery,
} from "@/lib/integrations";

export const dynamic = "force-dynamic";

/**
 * Anonymous Census geocode. GET or POST.
 * Success: lat/lon + normalized address (provenance external_source).
 * Failure: unavailable payload - never invents coordinates.
 */
export async function GET(request: Request) {
  return respond(queryFromSearchParams(new URL(request.url).searchParams));
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body === null) {
    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        reason: "invalid_input",
        message: "Request body must be JSON with an address or ZIP.",
        service: "geocode",
      },
      { status: 400 },
    );
  }
  return respond(queryFromRecord(body));
}

async function respond(query: GeocodeQuery) {
  const result = await geocode(query);
  if (!result.ok) {
    return NextResponse.json(
      { ...result, location: emptyGeocodedLocation() },
      { status: httpStatusForUnavailable(result) },
    );
  }
  return NextResponse.json(result);
}

function queryFromSearchParams(params: URLSearchParams): GeocodeQuery {
  return queryFromRecord({
    address: params.get("address") ?? params.get("q") ?? undefined,
    addressLine:
      params.get("addressLine") ?? params.get("street") ?? undefined,
    city: params.get("city") ?? undefined,
    state: params.get("state") ?? undefined,
    postalCode:
      params.get("postalCode") ?? params.get("zip") ?? undefined,
  });
}

function queryFromRecord(value: Record<string, unknown>): GeocodeQuery {
  return {
    address: asString(value.address) ?? asString(value.q),
    addressLine: asString(value.addressLine) ?? asString(value.street),
    city: asString(value.city),
    state: asString(value.state),
    postalCode:
      asString(value.postalCode) ?? asString(value.zip) ?? asString(value.postal),
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
