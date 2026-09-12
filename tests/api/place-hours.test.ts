import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/place-hours/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/place-hours", () => {
  it("fails closed without a Google key and does not invent hours", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    const response = await POST(
      new Request("http://localhost/api/place-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: 27.9506,
          longitude: -82.4572,
          pins: [
            {
              id: "n-1",
              kind: "grocery",
              latitude: 27.9506,
              longitude: -82.4572,
            },
          ],
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.configured).toBe(false);
    expect(body.hours).toEqual([]);
  });

  it("rejects invalid JSON without calling Google", async () => {
    const response = await POST(
      new Request("http://localhost/api/place-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.hours).toEqual([]);
  });
});
