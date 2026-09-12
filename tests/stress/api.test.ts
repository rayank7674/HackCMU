import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/stress/route";
import { allClearHazards, makeHome, makeHousehold } from "../rules/helpers";
import { STRESS_PRESETS } from "@/lib/stress";

describe("POST /api/stress", () => {
  it("fails closed when home is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/stress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: null,
          household: makeHousehold(),
          scenario: "power-12h",
          action: "simulate",
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("profile_missing");
    expect(body.forecast).toBe(false);
  });

  it("simulates a modeled preset without calling it a forecast", async () => {
    const response = await POST(
      new Request("http://localhost/api/stress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: makeHome({ hasBackupPower: false }),
          household: makeHousehold({ vehicleCount: 1 }),
          scenario: "power-12h",
          action: "simulate",
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.modeled).toBe(true);
    expect(body.forecast).toBe(false);
    expect(body.result.modeled).toBe(true);
    expect(body.result.forecast).toBe(false);
    expect(body.result.disruptionLevel).toMatch(/none|constrained|major|critical/);
    expect(body.result.assumptions.join(" ")).toMatch(/not a forecast/i);
  });

  it("returns a bounded worst-case search", async () => {
    const response = await POST(
      new Request("http://localhost/api/stress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: makeHome({ hasBackupPower: false }),
          household: makeHousehold(),
          action: "worst",
        }),
      }),
    );
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.breakdown.status).toBe("found");
    expect(body.result.modeled).toBe(true);
  });

  it("refuses fortify without a confirmed hazard state", async () => {
    const response = await POST(
      new Request("http://localhost/api/stress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: makeHome(),
          household: makeHousehold(),
          scenario: "wind-power",
          action: "fortify",
        }),
      }),
    );
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.status).toBe("unavailable");
  });

  it("fortifies with confirmed all-clear and keeps official/hard first", async () => {
    const response = await POST(
      new Request("http://localhost/api/stress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: makeHome({ hasBackupPower: false }),
          household: makeHousehold({ budgetClass: "low" }),
          scenario: "power-12h",
          action: "fortify",
          hazards: allClearHazards(),
        }),
      }),
    );
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.optimization.solver).toBe("knapsack_dp");
    const first = body.optimization.selected[0];
    if (first) {
      if (body.optimization.hardCount > 0) {
        expect(first.hardConstraint === true || first.official === true).toBe(true);
      }
    }
    expect(JSON.stringify(body.optimization)).not.toMatch(/\$\d/);
  });

  it("includes the tampa-demo preset labeled as modeled, not live NWS", () => {
    const tampa = STRESS_PRESETS.find((item) => item.id === "tampa-demo");
    expect(tampa?.label.toLowerCase()).toMatch(/modeled, not live nws/);
  });
});
