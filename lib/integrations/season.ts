import { isKnown, type HomeProfile, type Unknownable } from "@/lib/stormready";

export type SeasonKind = "hurricane" | "winter" | "none";

export type SeasonContext = {
  applicable: boolean;
  kind: SeasonKind;
  inWindow: boolean;
  daysUntilWindow: number | null;
  daysRemainingInWindow: number | null;
  label: string;
  sourceNote: string;
  modeled: true;
  forecast: false;
};

const ATLANTIC_HURRICANE = { startMonth: 6, startDay: 1, endMonth: 11, endDay: 30 };

/** Atlantic/Gulf tropical-coast states. Calendar only — not a forecast. */
export const HURRICANE_SEASON_STATES = new Set([
  "AL",
  "FL",
  "GA",
  "LA",
  "MS",
  "NC",
  "SC",
  "TX",
  "VA",
  "HI",
  "PR",
]);

/** Meteorological-winter emphasis (Dec–Feb). Not a blizzard forecast. */
export const WINTER_SEASON_STATES = new Set([
  "AK",
  "CO",
  "CT",
  "IA",
  "ID",
  "IL",
  "IN",
  "MA",
  "MD",
  "ME",
  "MI",
  "MN",
  "MT",
  "ND",
  "NE",
  "NH",
  "NJ",
  "NV",
  "NY",
  "OH",
  "PA",
  "RI",
  "SD",
  "UT",
  "VT",
  "WI",
  "WV",
  "WY",
]);

const NORTHERN_CWA = new Set([
  "ALY",
  "BGM",
  "BOX",
  "BTV",
  "BUF",
  "CAR",
  "CLE",
  "CTP",
  "DLH",
  "DTX",
  "DVN",
  "FGF",
  "GRB",
  "GRR",
  "GYX",
  "ILN",
  "ILX",
  "IWX",
  "LOT",
  "MKX",
  "MPX",
  "OKX",
  "PHI",
  "PBZ",
  "RLX",
]);

const TROPICAL_CWA = new Set([
  "BRO",
  "CRP",
  "HGX",
  "LCH",
  "LIX",
  "MOB",
  "TAE",
  "TBW",
  "MFL",
  "MLB",
  "JAX",
  "CHS",
  "ILM",
  "MHX",
  "AKQ",
  "KEY",
  "SJU",
  "HFO",
]);

export function normalizeState(state: Unknownable<string> | null | undefined): string | null {
  if (state == null || !isKnown(state)) return null;
  const trimmed = state.trim().toUpperCase();
  return trimmed.length === 2 ? trimmed : null;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

function hurricaneWindow(now: Date): {
  inWindow: boolean;
  daysUntilWindow: number | null;
  daysRemainingInWindow: number | null;
} {
  const year = now.getUTCFullYear();
  const start = utcDate(year, ATLANTIC_HURRICANE.startMonth, ATLANTIC_HURRICANE.startDay);
  const end = utcDate(year, ATLANTIC_HURRICANE.endMonth, ATLANTIC_HURRICANE.endDay);
  if (now >= start && now <= end) {
    return {
      inWindow: true,
      daysUntilWindow: 0,
      daysRemainingInWindow: Math.max(0, daysBetween(now, end)),
    };
  }
  if (now < start) {
    return { inWindow: false, daysUntilWindow: daysBetween(now, start), daysRemainingInWindow: null };
  }
  const next = utcDate(year + 1, ATLANTIC_HURRICANE.startMonth, ATLANTIC_HURRICANE.startDay);
  return { inWindow: false, daysUntilWindow: daysBetween(now, next), daysRemainingInWindow: null };
}

function winterWindow(now: Date): {
  inWindow: boolean;
  daysUntilWindow: number | null;
  daysRemainingInWindow: number | null;
} {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if (month === 12 || month <= 2) {
    const endYear = month === 12 ? year + 1 : year;
    const end = utcDate(endYear, 2, 28);
    return {
      inWindow: true,
      daysUntilWindow: 0,
      daysRemainingInWindow: Math.max(0, daysBetween(now, end)),
    };
  }
  const start = utcDate(year, 12, 1);
  return { inWindow: false, daysUntilWindow: daysBetween(now, start), daysRemainingInWindow: null };
}

export function resolveSeasonContext(input: {
  state?: Unknownable<string> | null;
  nwsForecastOffice?: Unknownable<string> | null;
  now?: Date;
}): SeasonContext {
  const now = input.now ?? new Date();
  const state = normalizeState(input.state ?? null);
  const office = input.nwsForecastOffice;
  const cwa =
    office != null && isKnown(office) ? office.trim().toUpperCase() : null;
  const hurricaneRegion =
    (state !== null && HURRICANE_SEASON_STATES.has(state)) ||
    (cwa !== null && TROPICAL_CWA.has(cwa));
  const winterRegion =
    (state !== null && WINTER_SEASON_STATES.has(state)) ||
    (cwa !== null && NORTHERN_CWA.has(cwa));

  if (hurricaneRegion) {
    const window = hurricaneWindow(now);
    return {
      applicable: true,
      kind: "hurricane",
      inWindow: window.inWindow,
      daysUntilWindow: window.daysUntilWindow,
      daysRemainingInWindow: window.daysRemainingInWindow,
      label: window.inWindow
        ? "Atlantic hurricane season is open (calendar)"
        : `About ${window.daysUntilWindow} days until Atlantic hurricane season`,
      sourceNote:
        "NOAA Atlantic hurricane season is 1 June–30 November. Calendar context only — not a forecast.",
      modeled: true,
      forecast: false,
    };
  }

  if (winterRegion) {
    const window = winterWindow(now);
    return {
      applicable: true,
      kind: "winter",
      inWindow: window.inWindow,
      daysUntilWindow: window.daysUntilWindow,
      daysRemainingInWindow: window.daysRemainingInWindow,
      label: window.inWindow
        ? "Meteorological winter window (calendar)"
        : `About ${window.daysUntilWindow} days until meteorological winter`,
      sourceNote:
        "Meteorological winter is December–February. Calendar context only — not a blizzard forecast.",
      modeled: true,
      forecast: false,
    };
  }

  return {
    applicable: false,
    kind: "none",
    inWindow: false,
    daysUntilWindow: null,
    daysRemainingInWindow: null,
    label: "No regional season window is modeled for this place",
    sourceNote: "Season chips use state or NWS office only. This is not an all-clear.",
    modeled: true,
    forecast: false,
  };
}

export function seasonFromHome(home: HomeProfile | null | undefined, now?: Date): SeasonContext {
  return resolveSeasonContext({
    state: home?.state,
    nwsForecastOffice: home?.location.nwsForecastOffice,
    now,
  });
}
