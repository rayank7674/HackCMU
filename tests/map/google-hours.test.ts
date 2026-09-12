import { describe, expect, it } from "vitest";
import {
  GOOGLE_HOURS_DISCLAIMER,
  HOURS_OUTLOOK_LABEL,
  hoursOutlookForMatch,
  isUsuallyOpenAt,
  parseGooglePeriods,
  type HoursPeriod,
  type PinHoursMatch,
} from "@/lib/map/google-hours";

describe("hours copy", () => {
  it("labels posted hours as open now, not a model", () => {
    expect(HOURS_OUTLOOK_LABEL.usually_open).toBe("Open now");
    expect(HOURS_OUTLOOK_LABEL.usually_closed).toBe("Closed now");
    expect(GOOGLE_HOURS_DISCLAIMER.toLowerCase()).toContain("not a model");
  });
});

function atEt(isoUtc: string): Date {
  return new Date(isoUtc);
}

const weekdayNineToFive: HoursPeriod[] = [
  {
    open: { day: 1, minuteOfDay: 9 * 60 },
    close: { day: 1, minuteOfDay: 17 * 60 },
  },
];

describe("isUsuallyOpenAt", () => {
  it("returns null when Google gave no periods", () => {
    expect(isUsuallyOpenAt([], atEt("2026-09-14T15:00:00.000Z"))).toBeNull();
  });

  it("is open mid-window on a weekday", () => {
    // Monday 12:00 America/New_York = 16:00Z in September
    expect(isUsuallyOpenAt(weekdayNineToFive, atEt("2026-09-14T16:00:00.000Z"))).toBe(
      true,
    );
  });

  it("is closed after closing time the same day", () => {
    // Monday 18:00 ET = 22:00Z
    expect(isUsuallyOpenAt(weekdayNineToFive, atEt("2026-09-14T22:00:00.000Z"))).toBe(
      false,
    );
  });

  it("handles overnight hours that wrap midnight", () => {
    const overnight: HoursPeriod[] = [
      {
        open: { day: 5, minuteOfDay: 22 * 60 },
        close: { day: 6, minuteOfDay: 2 * 60 },
      },
    ];
    // Friday 23:30 ET = Saturday 03:30Z
    expect(isUsuallyOpenAt(overnight, atEt("2026-09-19T03:30:00.000Z"))).toBe(true);
    // Saturday 03:00 ET = 07:00Z
    expect(isUsuallyOpenAt(overnight, atEt("2026-09-19T07:00:00.000Z"))).toBe(false);
  });
});

describe("parseGooglePeriods", () => {
  it("reads Google hour/minute fields", () => {
    const periods = parseGooglePeriods({
      periods: [{ open: { day: 0, hour: 8, minute: 30 }, close: { day: 0, hour: 12, minute: 0 } }],
    });
    expect(periods).toEqual([
      {
        open: { day: 0, minuteOfDay: 8 * 60 + 30 },
        close: { day: 0, minuteOfDay: 12 * 60 },
      },
    ]);
  });
});

describe("hoursOutlookForMatch", () => {
  const match: PinHoursMatch = {
    pinId: "n-1",
    googlePlaceId: "places/abc",
    googleName: "Store",
    periods: weekdayNineToFive,
    weekdayDescriptions: ["Monday: 9:00 AM – 5:00 PM"],
    businessStatus: "OPERATIONAL",
  };

  it("marks temporarily closed stores closed even inside hours", () => {
    expect(
      hoursOutlookForMatch(
        { ...match, businessStatus: "CLOSED_TEMPORARILY" },
        atEt("2026-09-14T16:00:00.000Z"),
      ),
    ).toBe("usually_closed");
  });

  it("is unknown without a match or periods", () => {
    expect(hoursOutlookForMatch(undefined, atEt("2026-09-14T16:00:00.000Z"))).toBe(
      "unknown",
    );
    expect(
      hoursOutlookForMatch(
        { ...match, periods: [] },
        atEt("2026-09-14T16:00:00.000Z"),
      ),
    ).toBe("unknown");
  });
});
