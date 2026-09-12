import {
  isKnown,
  type ActiveHazard,
  type BudgetClass,
  type GeocodedLocation,
  type HazardSeverity,
  type HazardState,
  type HomeProfile,
  type HouseholdProfile,
  type Recommendation,
  type RecommendationHorizon,
  type Unknownable,
} from "@/lib/stormready";
import type {
  ConstraintEffect,
  OptimizationConstraints,
  OptimizationResult,
} from "@/lib/optimization";

/**
 * Fail-closed client for routes that may land on parallel branches.
 * A 404/5xx/unparseable body is "unavailable" — never an all-clear or a
 * fabricated recommendation.
 */

export const GEOCODE_PATH = "/api/geocode";
export const ALERTS_PATH = "/api/alerts";
export const RECOMMENDATIONS_PATH = "/api/recommendations";

export type ApiFailureReason = "unavailable" | "error";

export type ApiFailure = {
  ok: false;
  reason: ApiFailureReason;
  status: number | null;
};

/** Shared UI status for geocode, alerts, and recommendations. */
export type ResourceStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "unavailable";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type GeocodeResult = {
  location: GeocodedLocation;
  city: Unknownable<string>;
  state: Unknownable<string>;
  postalCode: Unknownable<string>;
};

export type HazardSource = "live" | "unavailable" | "fixture";

export type RecommendationRequest = {
  home: HomeProfile | null;
  household: HouseholdProfile | null;
  hazards: HazardState | null;
  hazardSource: HazardSource;
  constraints?: Partial<OptimizationConstraints>;
};

/** Recommendation plus engine display fields when the route is present. */
export type RecommendationView = Recommendation & {
  costClass?: Unknownable<BudgetClass | string>;
  horizon?: Unknownable<RecommendationHorizon | string>;
  official?: boolean;
  hardConstraint?: boolean;
  estimatedTimeMinutes?: number;
  estimatedCostRange?: { min: number; max: number };
  utilityScore?: number;
  hazardRelevance?: number;
  householdFit?: number;
  urgency?: number;
  costEstimateSource?: string;
  costEstimateConfidence?: string;
  constraintEffects?: ConstraintEffect[] | string[];
};

export type OptimizationView = {
  solver: "knapsack_dp";
  objective: "maximize_preparedness_utility";
  selectedIds: string[];
  hardConstraintIds: string[];
  planningCostUnits: number;
  planningCostDollars: number;
  planningMinutes: number;
  hardCount: number;
  discretionaryCount: number;
  constraintsUsed: OptimizationConstraints;
  notes: string[];
  shortfall: string | null;
  candidates: OptimizationResult["candidates"];
  rejected: { id: string; ruleId: string; reasons: string[] }[];
};

export type RecommendationsPayload = {
  recommendations: RecommendationView[];
  optimization: OptimizationView | null;
};

export type DemoScenario = "quiet" | "watch" | "warning" | "evac" | "flood";

export async function fetchGeocode(input: {
  addressLine?: string;
  postalCode?: string;
  city?: string;
  state?: string;
}): Promise<ApiResult<GeocodeResult>> {
  const params = new URLSearchParams();
  const query = [input.addressLine, input.city, input.state, input.postalCode]
    .filter(Boolean)
    .join(", ");
  if (query) params.set("q", query);
  if (input.addressLine) params.set("address", input.addressLine);
  if (input.postalCode) params.set("postalCode", input.postalCode);
  if (input.city) params.set("city", input.city);
  if (input.state) params.set("state", input.state);

  const payload = await requestJson(`${GEOCODE_PATH}?${params.toString()}`);
  if (!payload.ok) {
    return tryAlternateMethod(GEOCODE_PATH, "POST", input, parseGeocode);
  }
  return parseOrUnavailable(payload.data, parseGeocode);
}

export async function fetchAlerts(input: {
  addressLine?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  location?: GeocodedLocation | null;
}): Promise<ApiResult<HazardState>> {
  const params = new URLSearchParams();
  if (input.addressLine) params.set("addressLine", input.addressLine);
  if (input.postalCode) params.set("postalCode", input.postalCode);
  if (input.city) params.set("city", input.city);
  if (input.state) params.set("state", input.state);
  const loc = input.location;
  if (loc && isKnown(loc.latitude)) params.set("lat", String(loc.latitude));
  if (loc && isKnown(loc.longitude)) params.set("lon", String(loc.longitude));
  if (loc && isKnown(loc.county)) params.set("county", loc.county);
  if (loc && isKnown(loc.nwsForecastZone)) {
    params.set("nwsForecastZone", loc.nwsForecastZone);
  }
  if (loc && isKnown(loc.nwsCountyZone)) {
    params.set("nwsCountyZone", loc.nwsCountyZone);
  }

  const payload = await requestJson(`${ALERTS_PATH}?${params.toString()}`);
  if (!payload.ok) {
    return tryAlternateMethod(
      ALERTS_PATH,
      "POST",
      {
        addressLine: input.addressLine,
        postalCode: input.postalCode,
        city: input.city,
        state: input.state,
        latitude: loc && isKnown(loc.latitude) ? loc.latitude : undefined,
        longitude: loc && isKnown(loc.longitude) ? loc.longitude : undefined,
        location: input.location,
      },
      parseHazardState,
    );
  }
  return parseOrUnavailable(payload.data, parseHazardState);
}

export async function fetchRecommendations(
  input: RecommendationRequest,
): Promise<ApiResult<RecommendationsPayload>> {
  const body: RecommendationRequest = {
    home: input.home,
    household: input.household,
    hazards: input.hazards,
    hazardSource: input.hazardSource,
    constraints: input.constraints,
  };

  const posted = await requestJson(RECOMMENDATIONS_PATH, {
    method: "POST",
    body,
  });
  if (posted.ok) {
    const parsed = parseEngineRecommendations(posted.data);
    if (parsed) return parsed;
  }

  const local = await tryLocalRecommend(body);
  if (local) return local;

  return posted.ok
    ? { ok: false, reason: "unavailable", status: 200 }
    : posted;
}

/** Explicit Tampa fixture only — never used as a silent stand-in for live alerts. */
export async function fetchTampaDemo(
  scenario: DemoScenario = "quiet",
): Promise<ApiResult<RecommendationsPayload>> {
  const queried = await requestJson(
    `${RECOMMENDATIONS_PATH}?fixture=tampa&scenario=${scenario}`,
  );
  if (!queried.ok) return queried;
  return parseEngineRecommendations(queried.data) ?? {
    ok: false,
    reason: "unavailable",
    status: 200,
  };
}

type RecommendFn = (input: RecommendationRequest) => {
  status?: string;
  recommendations?: unknown;
  optimization?: unknown;
};

async function tryLocalRecommend(
  input: RecommendationRequest,
): Promise<ApiResult<RecommendationsPayload> | null> {
  try {
    const mod = (await import("@/lib/stormready")) as {
      recommend?: RecommendFn;
    };
    if (typeof mod.recommend !== "function") return null;
    return parseEngineRecommendations(mod.recommend(input));
  } catch {
    return null;
  }
}

function parseEngineRecommendations(
  value: unknown,
): ApiResult<RecommendationsPayload> | null {
  if (!isRecord(value)) {
    const list = parseRecommendations(value);
    return list
      ? { ok: true, data: { recommendations: list, optimization: null } }
      : null;
  }
  if (value.status === "unavailable" || value.ok === false) {
    return { ok: false, reason: "unavailable", status: 200 };
  }
  const list = parseRecommendations(value);
  if (!list) return null;
  return {
    ok: true,
    data: {
      recommendations: list,
      optimization: parseOptimization(value.optimization),
    },
  };
}

async function tryAlternateMethod<T, B>(
  path: string,
  method: "GET" | "POST",
  body: B,
  parse: (value: unknown) => T | null,
): Promise<ApiResult<T>> {
  const payload = await requestJson(path, { method, body });
  if (!payload.ok) return payload;
  return parseOrUnavailable(payload.data, parse);
}

function parseOrUnavailable<T>(
  value: unknown,
  parse: (value: unknown) => T | null,
): ApiResult<T> {
  const data = parse(value);
  if (data === null) {
    return { ok: false, reason: "unavailable", status: 200 };
  }
  return { ok: true, data };
}

async function requestJson(
  url: string,
  init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<ApiResult<unknown>> {
  try {
    const method = init?.method ?? "GET";
    const response = await fetch(url, {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify(init?.body ?? {}) : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: classifyRequestFailure(response.status),
        status: response.status,
      };
    }

    const text = await response.text();
    if (!text.trim()) {
      return { ok: false, reason: "unavailable", status: response.status };
    }

    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: false, reason: "unavailable", status: response.status };
    }
  } catch {
    return { ok: false, reason: "error", status: null };
  }
}

/**
 * Transport failures are errors. Missing or fail-closed routes (404/400)
 * stay unavailable so the UI never treats them as an all-clear.
 */
export function classifyRequestFailure(
  status: number | null,
): ApiFailureReason {
  if (status === null) return "error";
  if (status >= 500 || status === 408 || status === 429) return "error";
  return "unavailable";
}

export function statusFromResult(
  result: ApiResult<unknown>,
): Exclude<ResourceStatus, "idle" | "loading"> {
  return result.ok ? "ready" : result.reason;
}

function parseGeocode(value: unknown): GeocodeResult | null {
  if (!isRecord(value)) return null;
  const source = isRecord(value.location) ? value.location : value;
  const latitude = readCoord(source.latitude ?? source.lat);
  const longitude = readCoord(
    source.longitude ?? source.lon ?? source.lng ?? source.long,
  );
  const county = readUnknownableString(source.county);
  const nwsForecastOffice = readUnknownableString(
    source.nwsForecastOffice ?? source.office,
  );
  const nwsForecastZone = readUnknownableString(
    source.nwsForecastZone ?? source.forecastZone,
  );
  const nwsCountyZone = readUnknownableString(
    source.nwsCountyZone ?? source.countyZone,
  );
  const city = readUnknownableString(value.city ?? source.city);
  const state = readUnknownableString(value.state ?? source.state);
  const postalCode = readUnknownableString(
    value.postalCode ?? source.postalCode ?? value.zip,
  );

  const hasAnything =
    latitude !== "unknown" ||
    longitude !== "unknown" ||
    county !== "unknown" ||
    nwsForecastOffice !== "unknown" ||
    nwsForecastZone !== "unknown" ||
    nwsCountyZone !== "unknown" ||
    city !== "unknown" ||
    state !== "unknown" ||
    postalCode !== "unknown";

  if (!hasAnything) return null;

  return {
    location: {
      latitude,
      longitude,
      county,
      nwsForecastOffice,
      nwsForecastZone,
      nwsCountyZone,
      provenance: "external_source",
    },
    city,
    state,
    postalCode,
  };
}

function parseHazardState(value: unknown): HazardState | null {
  if (!isRecord(value)) return null;
  const root = isRecord(value.hazardState)
    ? value.hazardState
    : isRecord(value.hazards) && !Array.isArray(value.hazards)
      ? value.hazards
      : value;

  const rawHazards = Array.isArray(root.hazards)
    ? root.hazards
    : Array.isArray(value.alerts)
      ? value.alerts
      : null;

  if (rawHazards === null) return null;

  const hazards = rawHazards
    .map(parseActiveHazard)
    .filter((item): item is ActiveHazard => item !== null);

  const observedAt =
    readIso(root.observedAt) ??
    readIso(value.observedAt) ??
    readIso(value.updatedAt) ??
    readIso(value.timestamp);

  if (!observedAt) return null;

  const allClear = readAllClear(root.allClear ?? value.allClear);

  return {
    observedAt,
    locationLabel: readUnknownableString(
      root.locationLabel ?? value.locationLabel ?? value.location,
    ),
    hazards,
    allClear,
    provenance: readProvenance(root.provenance ?? value.provenance),
  };
}

function parseActiveHazard(value: unknown): ActiveHazard | null {
  if (!isRecord(value)) return null;
  const headline =
    typeof value.headline === "string" && value.headline.trim() !== ""
      ? value.headline.trim()
      : typeof value.title === "string" && value.title.trim() !== ""
        ? value.title.trim()
        : null;
  if (!headline) return null;

  return {
    id:
      typeof value.id === "string" && value.id.trim() !== ""
        ? value.id
        : `hazard_${headline}`,
    kind: readHazardKind(value.kind ?? value.event),
    headline,
    severity: readSeverity(value.severity),
    urgency: readUrgency(value.urgency),
    onsetAt: readUnknownableString(value.onsetAt ?? value.onset),
    endsAt: readUnknownableString(value.endsAt ?? value.ends),
    nwsEventId: readUnknownableString(value.nwsEventId ?? value.eventId),
    instruction: readUnknownableString(value.instruction ?? value.description),
    provenance: readProvenance(value.provenance, "external_source"),
  };
}

function parseRecommendations(value: unknown): RecommendationView[] | null {
  if (Array.isArray(value)) {
    const items = value
      .map(parseRecommendation)
      .filter((item): item is RecommendationView => item !== null);
    return items;
  }
  if (!isRecord(value)) return null;
  const list = Array.isArray(value.recommendations)
    ? value.recommendations
    : Array.isArray(value.data)
      ? value.data
      : Array.isArray(value.actions)
        ? value.actions
        : null;
  if (list === null) return null;
  return list
    .map(parseRecommendation)
    .filter((item): item is RecommendationView => item !== null);
}

function parseRecommendation(value: unknown): RecommendationView | null {
  if (!isRecord(value)) return null;
  const title =
    typeof value.title === "string" && value.title.trim() !== ""
      ? value.title.trim()
      : null;
  const body = typeof value.body === "string" ? value.body : "";
  if (!title) return null;

  return {
    id:
      typeof value.id === "string" && value.id.trim() !== ""
        ? value.id
        : `rec_${title}`,
    title,
    body,
    priority: readPriority(value.priority),
    category: readCategory(value.category),
    hazardKinds: Array.isArray(value.hazardKinds)
      ? value.hazardKinds.map((item) => readHazardKind(item))
      : [],
    ruleId: readUnknownableString(value.ruleId),
    rationale: readUnknownableString(value.rationale ?? value.reason),
    timeframe: readTimeframe(value.timeframe ?? value.horizon),
    provenance: readProvenance(value.provenance, "external_source"),
    costClass: readUnknownableString(value.costClass ?? value.cost_class),
    horizon: readUnknownableString(value.horizon),
    official: value.official === true,
    hardConstraint: value.hardConstraint === true,
    estimatedTimeMinutes:
      typeof value.estimatedTimeMinutes === "number"
        ? value.estimatedTimeMinutes
        : undefined,
    estimatedCostRange: parseCostRange(value.estimatedCostRange),
    utilityScore:
      typeof value.utilityScore === "number" ? value.utilityScore : undefined,
    hazardRelevance:
      typeof value.hazardRelevance === "number"
        ? value.hazardRelevance
        : undefined,
    householdFit:
      typeof value.householdFit === "number" ? value.householdFit : undefined,
    urgency: typeof value.urgency === "number" ? value.urgency : undefined,
    costEstimateSource:
      typeof value.costEstimateSource === "string"
        ? value.costEstimateSource
        : undefined,
    costEstimateConfidence:
      typeof value.costEstimateConfidence === "string"
        ? value.costEstimateConfidence
        : undefined,
    constraintEffects: Array.isArray(value.constraintEffects)
      ? (value.constraintEffects.filter(
          (item): item is ConstraintEffect => typeof item === "string",
        ) as ConstraintEffect[])
      : undefined,
  };
}

function parseCostRange(
  value: unknown,
): { min: number; max: number } | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.min !== "number" || typeof value.max !== "number") {
    return undefined;
  }
  return { min: value.min, max: value.max };
}

function parseOptimization(value: unknown): OptimizationView | null {
  if (!isRecord(value)) return null;
  if (value.solver !== "knapsack_dp") return null;
  const selectedIds = Array.isArray(value.selectedIds)
    ? value.selectedIds.filter((id): id is string => typeof id === "string")
    : [];
  const hardConstraintIds = Array.isArray(value.hardConstraintIds)
    ? value.hardConstraintIds.filter((id): id is string => typeof id === "string")
    : [];
  const used = isRecord(value.constraintsUsed) ? value.constraintsUsed : null;
  const unitCap =
    used && typeof used.budgetUnits === "number"
      ? used.budgetUnits
      : used && typeof used.budgetDollars === "number"
        ? used.budgetDollars
        : null;
  const constraintsUsed: OptimizationConstraints = used
    ? {
        budgetUnits: unitCap,
        budgetDollars: unitCap,
        availableTimeMinutes:
          typeof used.availableTimeMinutes === "number"
            ? used.availableTimeMinutes
            : null,
        transport: readTransport(used.transport),
      }
    : {
        budgetUnits: null,
        budgetDollars: null,
        availableTimeMinutes: null,
        transport: "unknown",
      };

  const planningCostUnits =
    typeof value.planningCostUnits === "number"
      ? value.planningCostUnits
      : typeof value.planningCostDollars === "number"
        ? value.planningCostDollars
        : 0;

  return {
    solver: "knapsack_dp",
    objective:
      value.objective === "maximize_preparedness_utility"
        ? "maximize_preparedness_utility"
        : "maximize_preparedness_utility",
    selectedIds,
    hardConstraintIds,
    planningCostUnits,
    planningCostDollars: planningCostUnits,
    planningMinutes:
      typeof value.planningMinutes === "number" ? value.planningMinutes : 0,
    hardCount: typeof value.hardCount === "number" ? value.hardCount : 0,
    discretionaryCount:
      typeof value.discretionaryCount === "number"
        ? value.discretionaryCount
        : 0,
    constraintsUsed,
    notes: Array.isArray(value.notes)
      ? value.notes.filter((item): item is string => typeof item === "string")
      : [],
    shortfall: typeof value.shortfall === "string" ? value.shortfall : null,
    candidates: Array.isArray(value.candidates)
      ? value.candidates.flatMap((item) => {
          if (!isRecord(item) || typeof item.id !== "string") return [];
          return [
            {
              id: item.id,
              ruleId: typeof item.ruleId === "string" ? item.ruleId : item.id,
              title: typeof item.title === "string" ? item.title : item.id,
              category: readCategory(item.category),
              hardConstraint: item.hardConstraint === true,
              official: item.official === true,
              selected: item.selected === true,
              utility: typeof item.utility === "number" ? item.utility : 0,
              estimatedCostUnits:
                typeof item.estimatedCostUnits === "number"
                  ? item.estimatedCostUnits
                  : typeof item.estimatedCostDollars === "number"
                    ? item.estimatedCostDollars
                    : 0,
              estimatedCostDollars:
                typeof item.estimatedCostDollars === "number"
                  ? item.estimatedCostDollars
                  : typeof item.estimatedCostUnits === "number"
                    ? item.estimatedCostUnits
                    : 0,
              estimatedTimeMinutes:
                typeof item.estimatedTimeMinutes === "number"
                  ? item.estimatedTimeMinutes
                  : 0,
            },
          ];
        })
      : [],
    rejected: Array.isArray(value.rejected)
      ? value.rejected.flatMap((item) => {
          if (!isRecord(item) || typeof item.id !== "string") return [];
          return [
            {
              id: item.id,
              ruleId: typeof item.ruleId === "string" ? item.ruleId : item.id,
              reasons: Array.isArray(item.reasons)
                ? item.reasons.filter((reason): reason is string => typeof reason === "string")
                : [],
            },
          ];
        })
      : [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTransport(value: unknown): OptimizationConstraints["transport"] {
  if (
    value === "car" ||
    value === "limited" ||
    value === "none" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function readUnknownableString(value: unknown): Unknownable<string> {
  if (typeof value !== "string") return "unknown";
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "unknown" ? "unknown" : trimmed;
}

function readCoord(value: unknown): Unknownable<number> {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return "unknown";
}

function readIso(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readAllClear(value: unknown): Unknownable<boolean> {
  if (value === true || value === false) return value;
  return "unknown";
}

function readProvenance(
  value: unknown,
  fallback: GeocodedLocation["provenance"] = "unknown",
): GeocodedLocation["provenance"] {
  if (
    value === "user_reported" ||
    value === "external_source" ||
    value === "unknown"
  ) {
    return value;
  }
  return fallback;
}

function readHazardKind(value: unknown): ActiveHazard["kind"] {
  const allowed: ActiveHazard["kind"][] = [
    "hurricane",
    "tropical_storm",
    "storm_surge",
    "flood",
    "flash_flood",
    "tornado",
    "severe_thunderstorm",
    "extreme_heat",
    "extreme_cold",
    "winter_storm",
    "wind",
    "wildfire",
    "rip_current",
    "other",
  ];
  return typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as ActiveHazard["kind"])
    : "other";
}

function readSeverity(value: unknown): HazardSeverity {
  if (
    value === "advisory" ||
    value === "watch" ||
    value === "warning" ||
    value === "emergency" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function readUrgency(value: unknown): ActiveHazard["urgency"] {
  if (
    value === "immediate" ||
    value === "expected" ||
    value === "future" ||
    value === "past"
  ) {
    return value;
  }
  return "unknown";
}

function readPriority(value: unknown): Recommendation["priority"] {
  if (
    value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low"
  ) {
    return value;
  }
  return "medium";
}

function readCategory(value: unknown): Recommendation["category"] {
  const allowed: Recommendation["category"][] = [
    "evacuate",
    "shelter",
    "supplies",
    "medical",
    "pets",
    "power",
    "water",
    "communication",
    "documents",
    "other",
  ];
  return typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as Recommendation["category"])
    : "other";
}

function readTimeframe(value: unknown): Recommendation["timeframe"] {
  if (
    value === "now" ||
    value === "before_event" ||
    value === "before_next_event" ||
    value === "during_event" ||
    value === "after_event" ||
    value === "long_term"
  ) {
    return value;
  }
  return "unknown";
}
