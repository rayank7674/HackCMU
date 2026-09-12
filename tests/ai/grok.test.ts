import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GROK_EXPLAIN_RULES,
  buildGrokExplainPayload,
  explainWithGrok,
  proposeStressScenarioFromText,
  readXaiApiKey,
} from "@/lib/integrations/grok";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("buildGrokExplainPayload", () => {
  it("includes selected ids and forbids inventing new recommendations", () => {
    const facts = buildGrokExplainPayload({
      intent: "why_top_priority",
      selected: [
        {
          id: "official.warning",
          title: "Follow the official warning",
          ruleId: "nws.warning",
          hardConstraint: true,
        },
        {
          id: "kit.water",
          title: "Fill water containers",
          ruleId: "supplies.water",
          hardConstraint: false,
        },
      ],
      rejected: [
        {
          id: "gen.buy",
          ruleId: "power.generator",
          reasons: ["over_budget"],
        },
      ],
      constraints: {
        budgetUnits: 1,
        availableTimeMinutes: 30,
        transport: "none",
      },
      officialHeadlines: ["Hurricane Warning for Tampa Bay"],
    });

    expect(facts.selectedIds).toEqual(["official.warning", "kit.water"]);
    expect(facts.selected.map((item) => item.title)).toEqual([
      "Follow the official warning",
      "Fill water containers",
    ]);
    expect(facts.rejected[0]?.reasons).toContain("over_budget");
    expect(facts.rules).toContain("Do not invent new recommendations");
    expect(GROK_EXPLAIN_RULES).toContain("Do not invent new recommendations");
    expect(GROK_EXPLAIN_RULES).toContain("Do not add, remove, or reorder recommendations");
    expect(facts).not.toHaveProperty("address");
    expect(facts).not.toHaveProperty("email");
    expect(facts).not.toHaveProperty("latitude");
  });

  it("does not copy extra PII fields from the source object", () => {
    const facts = buildGrokExplainPayload({
      intent: "what_with_constraints",
      selectedIds: ["kit.water"],
      officialHeadlines: ["Flood Watch"],
    });
    const serialized = JSON.stringify(facts);
    expect(serialized).not.toMatch(/ssn|phone|street|postalCode|lat\b/i);
    expect(facts.officialHeadlines).toEqual(["Flood Watch"]);
  });
});

describe("explainWithGrok", () => {
  it("returns unavailable when XAI_API_KEY is missing and never fakes text", async () => {
    vi.stubEnv("XAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await explainWithGrok(
      {
        intent: "why_top_priority",
        selectedIds: ["official.warning"],
      },
      { ...process.env, XAI_API_KEY: "" },
    );

    expect(readXaiApiKey({ XAI_API_KEY: undefined })).toBeNull();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("unavailable");
      expect(result.reason).toBe("missing_key");
      expect(result.service).toBe("grok");
      expect(result).not.toHaveProperty("text");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("proposeStressScenarioFromText", () => {
  it("maps lose-power and road-closure language onto discrete fields", () => {
    const scenario = proposeStressScenarioFromText(
      "lose power tonight and the main road closes",
    );
    expect(scenario.powerAvailability).toBe(0);
    expect(scenario.outageHours).toBe(6);
    expect(scenario.roadAccessibility).toBe(50);
    expect(scenario.disclaimer).toMatch(/not a forecast/i);
    expect(scenario).not.toHaveProperty("k2");
    expect(scenario).not.toHaveProperty("mesh");
  });
});
