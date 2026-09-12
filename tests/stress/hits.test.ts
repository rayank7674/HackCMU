import { describe, expect, it } from "vitest";
import { resolveSeasonContext } from "@/lib/integrations/season";
import {
  hitFromRecommendation,
  hitIsInSeason,
  parseHouseHit,
  presetsForHit,
  visibleHits,
} from "@/lib/stress/hits";

describe("house hits", () => {
  it("parses Plan deep-links and maps roof/wind rules to wind", () => {
    expect(parseHouseHit("wind")).toBe("wind");
    expect(parseHouseHit("blizzard")).toBeNull();
    expect(hitFromRecommendation("hurricane_old_roof")).toBe("wind");
    expect(hitFromRecommendation("winter_pipes")).toBe("freeze");
  });

  it("hides freeze in a South Florida September unless show-all is on", () => {
    const season = resolveSeasonContext({
      state: "FL",
      nwsForecastOffice: "TBW",
      now: new Date("2026-09-12T12:00:00Z"),
    });
    expect(hitIsInSeason("freeze", season)).toBe(false);
    expect(visibleHits(season, false)).not.toContain("freeze");
    expect(visibleHits(season, true)).toContain("freeze");
    expect(presetsForHit("power").some((item) => item.id === "power-12h")).toBe(true);
  });
});
