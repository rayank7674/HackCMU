import { afterEach, describe, expect, it, vi } from "vitest";
import { applySiteFactsToHome, lookupSiteFacts } from "@/lib/integrations/site-facts";
import { createEmptyHomeProfile, UNKNOWN } from "@/lib/stormready";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("optional site facts", () => {
  it("leaves flood zone and elevation unknown when no feature returns", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ features: [], value: null }),
      })),
    );
    const facts = await lookupSiteFacts(27.95, -82.46);
    expect(facts.ok).toBe(true);
    if (!facts.ok) return;
    expect(facts.floodZone).toBe(UNKNOWN);
    expect(facts.elevationFeet).toBe(UNKNOWN);
    expect(facts.notes.join(" ")).toMatch(/unknown is not 'outside a flood zone'/i);

    const home = applySiteFactsToHome(createEmptyHomeProfile(), facts);
    expect(home.floodZone).toBe(UNKNOWN);
    expect(home.elevationFeet).toBe(UNKNOWN);
  });

  it("fails closed on invalid coordinates", async () => {
    const facts = await lookupSiteFacts(200, 0);
    expect(facts.ok).toBe(false);
  });
});
