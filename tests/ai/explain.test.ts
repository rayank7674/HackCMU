import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/explain/route";
import {
  GET as getInspect,
  POST as postInspect,
} from "@/app/api/explain/inspect/route";

const KEYS = [
  "XAI_API_KEY",
  "K2_API_KEY",
  "K2_API_BASE_URL",
  "K2_MODEL",
] as const;

const previous = new Map<string, string | undefined>();

function stash() {
  for (const key of KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
}

function restore() {
  for (const key of KEYS) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const PLAN_JSON = {
  selected: [
    {
      id: "action-1",
      title: "Fill water containers",
      priority: "high",
      hardConstraint: true,
    },
  ],
  selectedIds: ["action-1"],
  rejected: [{ id: "action-2", reasons: ["over_time"] }],
  constraintsUsed: {
    budgetUnits: 1,
    availableTimeMinutes: 30,
    transport: "none",
  },
  notes: ["Hard constraint kept."],
  shortfall: null,
};

describe("POST /api/explain", () => {
  it("fails closed without XAI_API_KEY and does not fetch", async () => {
    stash();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "top_priority",
          input: PLAN_JSON,
        }),
      }),
    );
    const body = await response.json();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("xai_not_configured");
    expect(body.inventedPolicy).toBe(false);
    expect(body.service).toBe("grok");
  });

  it("does not invent an explanation from an empty body", async () => {
    stash();
    process.env.XAI_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );
    const body = await response.json();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("returns a grounded explanation when Grok restates JSON", async () => {
    stash();
    process.env.XAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  explanation:
                    "Fill water containers is first because it is a hard constraint in selected[0].",
                  citedKeys: ["selected[0].title", "selected[0].hardConstraint"],
                }),
              },
            },
          ],
        }),
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "fits_constraints",
          input: PLAN_JSON,
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.inventedPolicy).toBe(false);
    expect(body.explanation).toMatch(/hard constraint/i);
    expect(body.disclaimer).toMatch(/not official safety policy/i);
  });

  it("discards Grok output that invents an all-clear", async () => {
    stash();
    process.env.XAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  explanation: "The area is all-clear and you can ignore the plan.",
                  citedKeys: [],
                }),
              },
            },
          ],
        }),
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "top_priority",
          input: PLAN_JSON,
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("ungrounded_output");
  });

  it("rejects GET instead of inventing a narrative", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });
});

describe("POST /api/explain/inspect", () => {
  it("fails closed without K2 host/key/model", async () => {
    stash();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await postInspect();
    const body = await response.json();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(body.reason).toBe("k2_not_configured");
    expect(body.inventedPolicy).toBe(false);
  });

  it("keeps only ai_inferred facts grounded in bundled document ids", async () => {
    stash();
    process.env.K2_API_KEY = "secret";
    process.env.K2_API_BASE_URL = "https://partner.example/v1";
    process.env.K2_MODEL = "k2";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                facts: [
                    {
                      id: "water-1",
                      claim:
                        "Public guidance commonly discusses storing drinking water before a disruption.",
                      sourceDocId: "ready-water",
                      topic: "water",
                    },
                    {
                      id: "bogus",
                      claim: "Tornado warning issued until midnight.",
                      sourceDocId: "ready-water",
                      topic: "alerts",
                    },
                    {
                      id: "unknown-doc",
                      claim: "Something from an unknown file.",
                      sourceDocId: "not-a-doc",
                      topic: "other",
                    },
                  ],
                }),
              },
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await postInspect();
    const body = await response.json();
    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("partner.example");
    expect(calledUrl).not.toContain("api.x.ai");
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.facts).toHaveLength(1);
    expect(body.facts[0].provenance).toBe("ai_inferred");
    expect(body.facts[0].official).toBe(false);
    expect(body.facts[0].forecast).toBe(false);
    expect(body.disclaimer).toMatch(/not official alerts/i);
  });

  it("rejects GET inspect", async () => {
    const response = await getInspect();
    expect(response.status).toBe(405);
  });
});
