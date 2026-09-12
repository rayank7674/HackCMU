import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getAlerts, POST as postAlerts } from "@/app/api/alerts/route";
import { GET as getGeocode, POST as postGeocode } from "@/app/api/geocode/route";
import { fetchAlerts, fetchStress } from "@/lib/stormready-api";
import { UNKNOWN } from "@/lib/stormready";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe("GET/POST /api/geocode", () => {
  it("rejects a missing query without inventing coordinates", async () => {
    const response = await getGeocode(
      new Request("http://localhost/api/geocode"),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.status).toBe("unavailable");
    expect(body.reason).toBe("invalid_input");
    expect(body.location.latitude).toBe(UNKNOWN);
    expect(body.location.longitude).toBe(UNKNOWN);
    expect(body.location.provenance).toBe(UNKNOWN);
  });

  it("rejects an empty JSON object", async () => {
    const response = await postGeocode(
      new Request("http://localhost/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("invalid_input");
    expect(body.location.latitude).toBe(UNKNOWN);
  });

  it("rejects a non-JSON body", async () => {
    const response = await postGeocode(
      new Request("http://localhost/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("invalid_input");
  });

  it("rejects a ZIP that is not five digits without calling a match", async () => {
    const response = await postGeocode(
      new Request("http://localhost/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode: "abc" }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("invalid_input");
    expect(body.location.latitude).toBe(UNKNOWN);
  });
});

describe("GET/POST /api/alerts", () => {
  it("rejects a missing location without an all-clear", async () => {
    const response = await getAlerts(new Request("http://localhost/api/alerts"));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.status).toBe("unavailable");
    expect(body.reason).toBe("invalid_input");
    expect(body.hazards.allClear).toBe(UNKNOWN);
    expect(body.hazards.hazards).toEqual([]);
    expect(body.hazards.provenance).toBe(UNKNOWN);
  });

  it("rejects an empty JSON object", async () => {
    const response = await postAlerts(
      new Request("http://localhost/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.hazards.allClear).toBe(UNKNOWN);
    expect(body.hazards.hazards).toEqual([]);
  });

  it("rejects a non-JSON body", async () => {
    const response = await postAlerts(
      new Request("http://localhost/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.hazards.allClear).toBe(UNKNOWN);
  });

  it("reads nested location coordinates and still fails closed on invalid lat", async () => {
    const response = await postAlerts(
      new Request("http://localhost/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: { latitude: 91, longitude: 0 },
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.service).toBe("nws");
    expect(body.reason).toBe("invalid_input");
    expect(body.message).toMatch(/-90/i);
    expect(body.hazards.allClear).toBe(UNKNOWN);
    expect(body.hazards.hazards).toEqual([]);
  });
});

describe("fetchAlerts client parser", () => {
  it("does not treat an empty hazard list as all-clear unless allClear is true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          observedAt: "2026-09-12T00:00:00.000Z",
          hazards: [],
        }),
      ),
    );

    const result = await fetchAlerts({ postalCode: "33602" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allClear).toBe("unknown");
      expect(result.data.hazards).toEqual([]);
    }
  });

  it("parses the live NWS route shape (hazards wrapped as HazardState)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ok: true,
          status: "ok",
          hazards: {
            observedAt: "2026-09-12T00:00:00.000Z",
            locationLabel: "Tampa, FL",
            hazards: [],
            allClear: true,
            provenance: "external_source",
          },
        }),
      ),
    );

    const result = await fetchAlerts({ postalCode: "33602" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allClear).toBe(true);
      expect(result.data.locationLabel).toBe("Tampa, FL");
    }
  });

  it("treats a 5xx / timeout-style failure as error, not all-clear", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            ok: false,
            status: "unavailable",
            reason: "upstream_unavailable",
            message: "timed out",
            service: "nws",
            hazards: {
              observedAt: "2026-09-12T00:00:00.000Z",
              hazards: [],
              allClear: "unknown",
              provenance: "unknown",
            },
          },
          503,
        ),
      ),
    );

    const result = await fetchAlerts({ postalCode: "33602" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Phase 2 UX: 5xx/timeout is an error (not an all-clear or invented alerts).
      expect(result.reason).toBe("error");
      expect(result.status).toBe(503);
    }
  });
});

describe("fetchStress", () => {
  it("fails closed on a missing route instead of inventing a forecast", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "",
      }),
    );
    const result = await fetchStress({
      home: null,
      household: null,
      scenario: "power-12h",
      action: "simulate",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unavailable");
      expect(result.status).toBe(404);
    }
  });
});
