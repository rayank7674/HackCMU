import { describe, expect, it } from "vitest";
import { resolveSeasonContext } from "@/lib/integrations/season";

describe("static NOAA season table", () => {
  it("treats TBW / Florida as Atlantic hurricane calendar context", () => {
    const midSeason = resolveSeasonContext({
      state: "FL",
      nwsForecastOffice: "TBW",
      now: new Date("2026-09-12T12:00:00Z"),
    });
    expect(midSeason.applicable).toBe(true);
    expect(midSeason.kind).toBe("hurricane");
    expect(midSeason.inWindow).toBe(true);
    expect(midSeason.forecast).toBe(false);
    expect(midSeason.modeled).toBe(true);
    expect(midSeason.sourceNote.toLowerCase()).toMatch(/calendar/);
    expect(midSeason.sourceNote.toLowerCase()).not.toMatch(/you will get a hurricane/);
  });

  it("treats a northern CWA as meteorological winter, not hurricane season", () => {
    const winter = resolveSeasonContext({
      state: "NY",
      nwsForecastOffice: "BUF",
      now: new Date("2026-01-15T12:00:00Z"),
    });
    expect(winter.kind).toBe("winter");
    expect(winter.inWindow).toBe(true);
    expect(winter.forecast).toBe(false);

    const offSeason = resolveSeasonContext({
      nwsForecastOffice: "BUF",
      now: new Date("2026-09-12T12:00:00Z"),
    });
    expect(offSeason.kind).toBe("winter");
    expect(offSeason.inWindow).toBe(false);
    expect(offSeason.daysUntilWindow).toBeGreaterThan(0);
  });
});
