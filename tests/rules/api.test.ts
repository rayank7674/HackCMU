import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/recommendations/route";
import { ENGINE_REASONS, tampaDemoInput } from "@/lib/stormready";
import { makeHazard, makeHazards, makeHome, makeHousehold } from "./helpers";

describe("POST /api/recommendations", () => {
  it("returns ranked recommendations for profile + hazard state", async () => {
    const input = tampaDemoInput("quiet");
    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("ok");
    expect(body.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(body.recommendations.length).toBeLessThanOrEqual(5);
    expect(body.ruleCount).toBeGreaterThanOrEqual(20);
  });

  it("returns a safe empty list with an explicit reason when hazards are missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: makeHome(),
          household: makeHousehold(),
          hazards: null,
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("unavailable");
    expect(body.reason).toBe(ENGINE_REASONS.hazardStateMissing);
    expect(body.recommendations).toEqual([]);
  });

  it("returns a safe empty list when the hazard API is unavailable", async () => {
    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: makeHome(),
          household: makeHousehold(),
          hazards: makeHazards(
            [
              makeHazard({
                kind: "hurricane",
                severity: "warning",
                headline: "should be ignored",
              }),
            ],
            false,
          ),
          hazardSource: "unavailable",
        }),
      }),
    );
    const body = await response.json();
    expect(body.status).toBe("unavailable");
    expect(body.reason).toBe(ENGINE_REASONS.hazardApiUnavailable);
    expect(body.recommendations).toEqual([]);
  });

  it("rejects an invalid body", async () => {
    const response = await POST(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home: "nope" }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("invalid_request");
  });
});

describe("GET /api/recommendations", () => {
  it("serves the Tampa fixture for quiet-weather judging", async () => {
    const response = await GET(
      new Request("http://localhost/api/recommendations?fixture=tampa"),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.fixture).toBe("tampa");
    expect(body.scenario).toBe("quiet");
    expect(body.profile.home.city).toBe("Tampa");
    expect(body.hazards.allClear).toBe(true);
    expect(body.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(body.recommendations.every((rec: { official: boolean }) => !rec.official)).toBe(
      true,
    );
  });

  it("can replay an official warning from the fixture", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/recommendations?fixture=tampa&scenario=evac",
      ),
    );
    const body = await response.json();
    expect(body.recommendations[0]?.official).toBe(true);
    expect(body.hazards.allClear).toBe(false);
  });
});
