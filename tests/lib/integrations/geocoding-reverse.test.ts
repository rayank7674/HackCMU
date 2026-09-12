import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyConfirmedLocation,
  reverseGeocode,
  validateCoordinates,
} from "@/lib/integrations/geocoding";
import { createEmptyHomeProfile, UNKNOWN } from "@/lib/stormready";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Census reverse geocode", () => {
  it("fails closed on invalid coordinates without inventing a street", async () => {
    expect(validateCoordinates(91, -82)).toBeNull();
    expect(validateCoordinates("lat", "lon")).toBeNull();
    const result = await reverseGeocode({ latitude: Number.NaN, longitude: -82.46 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_input");
  });

  it("fails closed when Census is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      })),
    );
    const result = await reverseGeocode({ latitude: 27.95, longitude: -82.46 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe("unavailable");
  });

  it("does not invent a street when Census only returns a coordinate match", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/locations/coordinates")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ result: { addressMatches: [] } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: { geographies: {} } }),
        };
      }),
    );
    const result = await reverseGeocode({ latitude: 27.95, longitude: -82.46 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matchKind).toBe("zcta");
    expect(result.normalizedAddress.addressLine).toBe(UNKNOWN);
    expect(result.normalizedAddress.matchedAddress).toBe(UNKNOWN);
    expect(result.location.latitude).toBe(27.95);
  });

  it("marks a confirmed pin as user-reported without inventing a street on ZCTA", () => {
    const home = createEmptyHomeProfile({ addressLine: "unknown" });
    const next = applyConfirmedLocation(home, {
      ok: true,
      status: "ok",
      matchKind: "zcta",
      query: {},
      normalizedAddress: {
        matchedAddress: UNKNOWN,
        addressLine: UNKNOWN,
        city: UNKNOWN,
        state: "FL",
        postalCode: "33602",
      },
      location: {
        ...home.location,
        latitude: 27.95,
        longitude: -82.46,
        provenance: "external_source",
      },
    });
    expect(next.addressProvenance).toBe("user_reported");
    expect(next.addressLine).toBe(UNKNOWN);
    expect(next.location.provenance).toBe("external_source");
    expect(next.location.latitude).toBe(27.95);
  });
});
