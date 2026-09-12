import { describe, expect, it } from "vitest";
import { matchPinsToGoogleHours, type GooglePlaceHours } from "@/lib/integrations/google-places";

const grocery: GooglePlaceHours = {
  googlePlaceId: "places/g1",
  googleName: "Publix",
  kind: "grocery",
  latitude: 27.9506,
  longitude: -82.4572,
  businessStatus: "OPERATIONAL",
  periods: [{ open: { day: 1, minuteOfDay: 420 }, close: { day: 1, minuteOfDay: 1260 } }],
  weekdayDescriptions: [],
};

describe("matchPinsToGoogleHours", () => {
  it("matches the nearest same-kind pin within 200m", () => {
    const matches = matchPinsToGoogleHours(
      [
        {
          id: "osm-a",
          kind: "grocery",
          latitude: 27.9507,
          longitude: -82.4573,
        },
      ],
      [grocery],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.pinId).toBe("osm-a");
    expect(matches[0]?.googleName).toBe("Publix");
  });

  it("does not invent a match across kinds or far away", () => {
    const matches = matchPinsToGoogleHours(
      [
        {
          id: "osm-pharmacy",
          kind: "pharmacy",
          latitude: 27.9506,
          longitude: -82.4572,
        },
        {
          id: "osm-far",
          kind: "grocery",
          latitude: 28.05,
          longitude: -82.4,
        },
      ],
      [grocery],
    );
    expect(matches).toEqual([]);
  });
});
