/** Google Places weekday: 0 = Sunday … 6 = Saturday. */

export type ClockMinutes = {
  day: number;
  minuteOfDay: number;
};

export type HoursPeriod = {
  open: ClockMinutes;
  close: ClockMinutes | null;
};

export type PinHoursMatch = {
  pinId: string;
  googlePlaceId: string;
  googleName: string;
  periods: HoursPeriod[];
  weekdayDescriptions: string[];
  businessStatus: string | null;
};

export type HoursOutlook = "usually_open" | "usually_closed" | "unknown";

export const HOURS_OUTLOOK_LABEL: Record<HoursOutlook, string> = {
  usually_open: "Open now",
  usually_closed: "Closed now",
  unknown: "Hours unknown",
};

export const HOURS_OUTLOOK_FILL: Record<HoursOutlook, string> = {
  usually_open: "#22c55e",
  usually_closed: "#dc2626",
  unknown: "#64748b",
};

export const HOURS_OUTLOOK_LETTER: Record<HoursOutlook, string> = {
  usually_open: "#ffffff",
  usually_closed: "#ffffff",
  unknown: "#ffffff",
};

export const GOOGLE_HOURS_DISCLAIMER =
  "Checking posted hours for right now. This is not a model and not a forecast.";

export const MAP_HOURS_TIMEZONE = "America/New_York";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function clockInZone(at: Date, timeZone = MAP_HOURS_TIMEZONE): ClockMinutes {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return {
    day: WEEKDAY_INDEX[weekday] ?? 0,
    minuteOfDay: hour * 60 + minute,
  };
}

export function parseGooglePeriods(value: unknown): HoursPeriod[] {
  if (!value || typeof value !== "object") return [];
  const periods = (value as { periods?: unknown }).periods;
  if (!Array.isArray(periods)) return [];
  const out: HoursPeriod[] = [];
  for (const item of periods) {
    if (!item || typeof item !== "object") continue;
    const row = item as { open?: unknown; close?: unknown };
    const open = readClock(row.open);
    if (!open) continue;
    out.push({ open, close: readClock(row.close) });
  }
  return out;
}

function readClock(value: unknown): ClockMinutes | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { day?: unknown; hour?: unknown; minute?: unknown };
  const day = typeof row.day === "number" ? row.day : Number(row.day);
  const hour = typeof row.hour === "number" ? row.hour : Number(row.hour ?? 0);
  const minute = typeof row.minute === "number" ? row.minute : Number(row.minute ?? 0);
  if (!Number.isFinite(day) || day < 0 || day > 6) return null;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { day, minuteOfDay: hour * 60 + minute };
}

/**
 * Usual weekly hours at a clock time. Null if Google did not give periods.
 * This is not a live storm-closure feed.
 */
export function isUsuallyOpenAt(
  periods: HoursPeriod[],
  at: Date,
  timeZone = MAP_HOURS_TIMEZONE,
): boolean | null {
  if (periods.length === 0) return null;
  const clock = clockInZone(at, timeZone);
  const now = clock.day * 24 * 60 + clock.minuteOfDay;
  const week = 7 * 24 * 60;
  for (const period of periods) {
    const start = period.open.day * 24 * 60 + period.open.minuteOfDay;
    if (period.close == null) return true;
    let end = period.close.day * 24 * 60 + period.close.minuteOfDay;
    if (end <= start) end += week;
    if (inWindow(now, start, end, week) || inWindow(now + week, start, end, week)) {
      return true;
    }
  }
  return false;
}

export function hoursOutlookForMatch(
  match: PinHoursMatch | undefined,
  at: Date,
  timeZone = MAP_HOURS_TIMEZONE,
): HoursOutlook {
  if (!match) return "unknown";
  const status = (match.businessStatus ?? "").toUpperCase();
  if (status === "CLOSED_PERMANENTLY" || status === "CLOSED_TEMPORARILY") {
    return "usually_closed";
  }
  const open = isUsuallyOpenAt(match.periods, at, timeZone);
  if (open === null) return "unknown";
  return open ? "usually_open" : "usually_closed";
}

function inWindow(t: number, start: number, end: number, week: number): boolean {
  return t >= start && t < end && end - start <= week + 1;
}
