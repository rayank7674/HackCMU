import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/explain/route";
import * as propagate from "@/lib/stress/propagate";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/ai/explain", () => {
  it("rejects a non-JSON body without inventing an explanation", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.status).toBe("unavailable");
    expect(body.reason).toBe("invalid_input");
    expect(body.text).toBeUndefined();
  });

  it("fails closed without XAI_API_KEY and still returns heuristic scenario params", async () => {
    const simulate = vi.spyOn(propagate, "simulate");
    const response = await POST(
      new Request("http://localhost/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "propose_scenario",
          payload: {
            userText: "lose power tonight and the main road closes",
          },
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.status).toBe("unavailable");
    expect(body.proposedScenario.powerAvailability).toBe(0);
    expect(body.proposedScenario.roadAccessibility).toBe(50);
    expect(body.proposedSource).toBe("heuristic");
    expect(simulate).not.toHaveBeenCalled();
  });

  it("explains a plan as unavailable when the key is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "why_top_priority",
          payload: {
            selectedIds: ["official.warning"],
            selected: [
              {
                id: "official.warning",
                title: "Follow the official warning",
                ruleId: "nws.warning",
                hardConstraint: true,
              },
            ],
          },
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.facts.selectedIds).toContain("official.warning");
    expect(body.facts.rules).toMatch(/invent new recommendations/i);
    expect(body.text).toBeUndefined();
  });
});
