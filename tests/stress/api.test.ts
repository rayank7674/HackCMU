import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/stress/route";
import { makeHome, makeHousehold, allClearHazards } from "../rules/helpers";

describe("POST /api/stress", () => {
  it("lists presets without a profile", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.forecast).toBe(false);
    expect(body.presets.length).toBeGreaterThan(0);
  });

  it("fails closed without a home profile", async () => {
    const response = await POST(
      new Request("http://localhost/api/stress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate" }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("profile_missing");
  });

  it("simulates a modeled scenario and never claims a forecast", async () => {
    const response = await POST(
      new Request("http://localhost/api/stress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate",
          home: makeHome({ hasBackupPower: false }),
          household: makeHousehold(),
          scenario: { id: "power-12h" },
        }),
      }),
    );
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.forecast).toBe(false);
    expect(body.result.modeled).toBe(true);
    expect(body.result.disruptionLevel).toBeTruthy();
  });

  it("does not fortify without a hazard state (no invented all-clear)", async () => {
    const response = await POST(
      new Request("http://localhost/api/stress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fortify",
          home: makeHome(),
          household: makeHousehold(),
          scenario: { id: "power-12h" },
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.reason).toBe("hazard_state_missing");
  });

  it("fortifies when a confirmed hazard state is provided", async () => {
    const response = await POST(
      new Request("http://localhost/api/stress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fortify",
          home: makeHome({ hasBackupPower: false }),
          household: makeHousehold({ budgetClass: "low" }),
          hazards: allClearHazards(),
          scenario: { id: "power-12h" },
        }),
      }),
    );
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.fortify.solver).toBe("knapsack_dp");
  });
});
