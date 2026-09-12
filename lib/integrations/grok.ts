/**
 * Server-only xAI Chat Completions adapter for StormReady explanations.
 * Do not import from client components — call POST /api/ai/explain instead.
 *
 * Missing XAI_API_KEY fails closed: { ok: false, status: "unavailable" }.
 * Never invent explanation text, recommendations, alerts, or infrastructure.
 */

import { fetchJson, isRecord, readNumber, readString } from "./http";
import { STRESS_DISCLAIMER, type StressScenario } from "@/lib/stress";
import type { OptimizationConstraints, OptimizationDiff } from "@/lib/optimization";

export const DEFAULT_XAI_BASE_URL = "https://api.x.ai/v1";
/** Documented Chat Completions slug; grok-3 remains a valid XAI_MODEL override. */
export const DEFAULT_XAI_MODEL = "grok-4";

export type ExplainIntent =
  | "why_top_priority"
  | "what_with_constraints"
  | "why_plan_changed"
  | "why_combination"
  | "propose_scenario";

export const EXPLAIN_INTENTS: readonly ExplainIntent[] = [
  "why_top_priority",
  "what_with_constraints",
  "why_plan_changed",
  "why_combination",
  "propose_scenario",
] as const;

export const GROK_EXPLAIN_RULES = [
  "Explain only the structured planner or stress-test result provided.",
  "Do not add, remove, or reorder recommendations.",
  "Do not invent new recommendations.",
  "Do not invent infrastructure, topology, or unofficial alerts.",
  "Do not issue evacuation orders.",
  "Do not claim a safety percentage, survival score, or all-clear.",
  "Preparedness utility and modeled household access are ranking/model values, not safety.",
].join(" ");

export type GrokUnavailableReason =
  | "missing_key"
  | "invalid_input"
  | "upstream_unavailable"
  | "upstream_error";

export type GrokUnavailable = {
  ok: false;
  status: "unavailable";
  reason: GrokUnavailableReason;
  message: string;
  service: "grok";
};

export type GrokExplainOk = {
  ok: true;
  status: "ok";
  service: "grok";
  text: string;
  model: string;
};

export type GrokExplainResult = GrokExplainOk | GrokUnavailable;

export type GrokActionSnippet = {
  id: string;
  title: string;
  ruleId: string;
  hardConstraint: boolean;
};

export type GrokRejectedSnippet = {
  id: string;
  ruleId: string;
  reasons: string[];
};

export type GrokConstraintOverlay = {
  budgetUnits: number | null;
  availableTimeMinutes: number | null;
  transport: string;
};

export type GrokExplainFacts = {
  intent: ExplainIntent;
  rules: typeof GROK_EXPLAIN_RULES;
  selectedIds: string[];
  selected: GrokActionSnippet[];
  rejected: GrokRejectedSnippet[];
  hardConstraintIds: string[];
  constraints: GrokConstraintOverlay | null;
  notes: string[];
  officialHeadlines: string[];
  planDelta: {
    addedIds: string[];
    removedIds: string[];
    reordered: boolean;
    summary: string;
  } | null;
  cascadeNodeLabels: string[];
  firstBreakLabel: string | null;
  disruptionLevel: string | null;
  assumptions: string[];
  modeledHouseholdAccess: number | null;
  userText: string | null;
};

export type GrokExplainSource = {
  intent: ExplainIntent;
  selectedIds?: string[];
  selected?: Array<{
    id?: string;
    title?: string;
    ruleId?: string;
    hardConstraint?: boolean;
  }>;
  rejected?: Array<{
    id?: string;
    ruleId?: string;
    reasons?: string[];
  }>;
  hardConstraintIds?: string[];
  constraints?: Partial<OptimizationConstraints> | null;
  notes?: string[];
  officialHeadlines?: string[];
  planDelta?: Pick<
    OptimizationDiff,
    "addedIds" | "removedIds" | "reordered" | "summary"
  > | null;
  cascadeNodeLabels?: string[];
  firstBreakLabel?: string | null;
  disruptionLevel?: string | null;
  assumptions?: string[];
  modeledHouseholdAccess?: number | null;
  userText?: string | null;
};

export function grokUnavailable(
  reason: GrokUnavailableReason,
  message: string,
): GrokUnavailable {
  return {
    ok: false,
    status: "unavailable",
    reason,
    message,
    service: "grok",
  };
}

type GrokEnv = Record<string, string | undefined>;

export function readXaiApiKey(env: GrokEnv = process.env): string | null {
  return readString(env.XAI_API_KEY);
}

export function readXaiBaseUrl(env: GrokEnv = process.env): string {
  return (readString(env.XAI_BASE_URL) ?? DEFAULT_XAI_BASE_URL).replace(
    /\/+$/,
    "",
  );
}

export function readXaiModel(env: GrokEnv = process.env): string {
  return readString(env.XAI_MODEL) ?? DEFAULT_XAI_MODEL;
}

export function isExplainIntent(value: unknown): value is ExplainIntent {
  return (
    typeof value === "string" &&
    (EXPLAIN_INTENTS as readonly string[]).includes(value)
  );
}

/**
 * Privacy-preserving facts for Grok. Titles, rule ids, hard flags, rejected
 * reasons, constraint overlay, official headlines already shown, and cascade
 * node labels only — no addresses, names, coordinates, or other PII.
 */
export function buildGrokExplainPayload(
  source: GrokExplainSource,
): GrokExplainFacts {
  const selected = (source.selected ?? [])
    .map((item) => ({
      id: readString(item.id) ?? "",
      title: readString(item.title) ?? "",
      ruleId: readString(item.ruleId) ?? "",
      hardConstraint: item.hardConstraint === true,
    }))
    .filter((item) => item.id || item.title || item.ruleId);

  const selectedIds = uniqueStrings([
    ...(source.selectedIds ?? []).map((id) => readString(id)).filter(isNonEmpty),
    ...selected.map((item) => item.id).filter(isNonEmpty),
  ]);

  const rejected = (source.rejected ?? [])
    .map((item) => ({
      id: readString(item.id) ?? "",
      ruleId: readString(item.ruleId) ?? "",
      reasons: Array.isArray(item.reasons)
        ? item.reasons.map((reason) => String(reason)).filter(Boolean)
        : [],
    }))
    .filter((item) => item.id || item.ruleId);

  const constraints = source.constraints
    ? {
        budgetUnits:
          readNumber(source.constraints.budgetUnits) ??
          readNumber(source.constraints.budgetDollars) ??
          null,
        availableTimeMinutes:
          source.constraints.availableTimeMinutes === null
            ? null
            : (readNumber(source.constraints.availableTimeMinutes) ?? null),
        transport: readString(source.constraints.transport) ?? "unknown",
      }
    : null;

  const delta = source.planDelta
    ? {
        addedIds: uniqueStrings(source.planDelta.addedIds ?? []),
        removedIds: uniqueStrings(source.planDelta.removedIds ?? []),
        reordered: source.planDelta.reordered === true,
        summary: readString(source.planDelta.summary) ?? "",
      }
    : null;

  return {
    intent: source.intent,
    rules: GROK_EXPLAIN_RULES,
    selectedIds,
    selected,
    rejected,
    hardConstraintIds: uniqueStrings(source.hardConstraintIds ?? []),
    constraints,
    notes: (source.notes ?? []).map((note) => String(note)).filter(Boolean),
    officialHeadlines: (source.officialHeadlines ?? [])
      .map((headline) => readString(headline))
      .filter(isNonEmpty),
    planDelta: delta,
    cascadeNodeLabels: (source.cascadeNodeLabels ?? [])
      .map((label) => readString(label))
      .filter(isNonEmpty),
    firstBreakLabel: readString(source.firstBreakLabel) ?? null,
    disruptionLevel: readString(source.disruptionLevel) ?? null,
    assumptions: (source.assumptions ?? [])
      .map((item) => String(item))
      .filter(Boolean),
    modeledHouseholdAccess:
      source.modeledHouseholdAccess === null ||
      source.modeledHouseholdAccess === undefined
        ? null
        : readNumber(source.modeledHouseholdAccess),
    userText:
      source.intent === "propose_scenario"
        ? readString(source.userText)
        : null,
  };
}

export function systemPromptFor(intent: ExplainIntent): string {
  const task =
    intent === "why_top_priority"
      ? "Explain why the first selected action is the top priority, using only selected titles, rule ids, and hard flags."
      : intent === "what_with_constraints"
        ? "Explain what the household can still do under the constraint overlay, using selected and rejected reasons. Do not suggest actions that are not in the selected list."
        : intent === "why_plan_changed"
          ? "Explain the plan delta (added/removed ids and constraint changes) without inventing new actions."
          : intent === "why_combination"
            ? "Explain why this modeled stress combination produces the listed cascade node labels. Do not invent infrastructure."
            : "Convert the user text into StressScenario JSON only. Allowed keys: id, label, powerAvailability (100|75|50|25|0), roadAccessibility (100|75|50), transport (car|limited|none|unchanged), waterAvailability (100|50|0), outageHours (6|12|null), hazardBoost (wind|flood|winter|null). Do not run a simulation. Do not add extra infrastructure fields.";

  return [
    "You are StormReady's explanation layer. The knapsack planner and stress engine already decided.",
    GROK_EXPLAIN_RULES,
    task,
    intent === "propose_scenario"
      ? "Reply with a single JSON object. No markdown."
      : "Reply with a short plain-language explanation. No JSON. No new checklist items.",
  ].join(" ");
}

export async function explainWithGrok(
  source: GrokExplainSource,
  env: GrokEnv = process.env,
): Promise<GrokExplainResult> {
  const key = readXaiApiKey(env);
  if (!key) {
    return grokUnavailable(
      "missing_key",
      "Grok is not connected. StormReady will not invent an AI explanation.",
    );
  }

  const facts = buildGrokExplainPayload(source);
  const model = readXaiModel(env);
  const url = `${readXaiBaseUrl(env)}/chat/completions`;
  const fetched = await fetchJson(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPromptFor(facts.intent) },
        { role: "user", content: JSON.stringify(facts) },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!fetched.ok) {
    return grokUnavailable(
      fetched.timedOut || fetched.status === null
        ? "upstream_unavailable"
        : "upstream_error",
      fetched.error,
    );
  }

  const text = readCompletionText(fetched.data);
  if (!text) {
    return grokUnavailable(
      "upstream_error",
      "Grok returned an empty completion. StormReady will not invent an explanation.",
    );
  }

  return {
    ok: true,
    status: "ok",
    service: "grok",
    text,
    model,
  };
}

export async function proposeScenarioWithGrok(
  userText: string,
  env: GrokEnv = process.env,
): Promise<
  | {
      ok: true;
      status: "ok";
      service: "grok";
      proposedScenario: StressScenario;
      source: "grok";
    }
  | GrokUnavailable
> {
  const key = readXaiApiKey(env);
  if (!key) {
    return grokUnavailable(
      "missing_key",
      "Grok is not connected. StormReady will not invent scenario prose.",
    );
  }

  const explained = await explainWithGrok(
    { intent: "propose_scenario", userText },
    env,
  );
  if (!explained.ok) return explained;

  const parsed = parseProposedScenarioJson(explained.text);
  if (!parsed) {
    return grokUnavailable(
      "upstream_error",
      "Grok did not return a valid StressScenario. StormReady will not invent infrastructure.",
    );
  }

  return {
    ok: true,
    status: "ok",
    service: "grok",
    proposedScenario: parsed,
    source: "grok",
  };
}

/**
 * Deterministic mapping onto discrete StressScenario fields.
 * Used when Grok is unavailable so the client can still confirm params.
 * Does not run the simulator and does not invent explanation text.
 */
export function proposeStressScenarioFromText(text: string): StressScenario {
  const t = text.toLowerCase();
  let powerAvailability: StressScenario["powerAvailability"] = 100;
  let roadAccessibility: StressScenario["roadAccessibility"] = 100;
  let transport: StressScenario["transport"] = "unchanged";
  let waterAvailability: StressScenario["waterAvailability"] = 100;
  let outageHours: StressScenario["outageHours"] = null;
  let hazardBoost: StressScenario["hazardBoost"] = null;

  if (/\b(power|outage|blackout|electric|grid)\b/.test(t)) {
    powerAvailability = 0;
    outageHours = /\b(tonight|overnight|this evening|6\s*h)\b/.test(t)
      ? 6
      : 12;
  }
  if (
    /\b(road|highway|bridge|street|route)\b/.test(t) &&
    /\b(close|closed|closes|closure|blocked|impass|shut)\b/.test(t)
  ) {
    roadAccessibility = 50;
  }
  if (/\b(no car|without a car|cannot drive|can't drive|no transport)\b/.test(t)) {
    transport = "none";
  } else if (/\b(limited transport|limited mobility)\b/.test(t)) {
    transport = "limited";
  }
  if (
    /\b(water|well|tap)\b/.test(t) &&
    /\b(out|off|disruption|shut|none|lose|lost)\b/.test(t)
  ) {
    waterAvailability = 0;
  }
  if (/\bflood\b/.test(t)) hazardBoost = "flood";
  else if (/\b(winter|ice|snow|freeze|blizzard)\b/.test(t)) hazardBoost = "winter";
  else if (/\b(wind|hurricane|tornado)\b/.test(t)) hazardBoost = "wind";

  return clampStressScenario({
    id: "proposed",
    label: "Proposed modeled scenario",
    disclaimer: STRESS_DISCLAIMER,
    powerAvailability,
    roadAccessibility,
    transport,
    waterAvailability,
    outageHours,
    hazardBoost,
  });
}

export function parseProposedScenarioJson(
  raw: string,
): StressScenario | null {
  const json = extractJsonObject(raw);
  if (!json) return null;
  return clampStressScenario(json);
}

export function clampStressScenario(
  value: Record<string, unknown>,
): StressScenario {
  return {
    id: readString(value.id) ?? "proposed",
    label: readString(value.label) ?? "Proposed modeled scenario",
    disclaimer: STRESS_DISCLAIMER,
    powerAvailability: pickNumberUnion(value.powerAvailability, [100, 75, 50, 25, 0], 100),
    roadAccessibility: pickNumberUnion(value.roadAccessibility, [100, 75, 50], 100),
    transport: pickStringUnion(
      value.transport,
      ["car", "limited", "none", "unchanged"],
      "unchanged",
    ),
    waterAvailability: pickNumberUnion(value.waterAvailability, [100, 50, 0], 100),
    outageHours:
      value.outageHours === null || value.outageHours === "null"
        ? null
        : pickNumberUnion(value.outageHours, [6, 12], null),
    hazardBoost:
      value.hazardBoost === null || value.hazardBoost === "null"
        ? null
        : pickStringUnion(value.hazardBoost, ["wind", "flood", "winter"], null),
  };
}

function readCompletionText(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const choices = data.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!isRecord(first)) return null;
  const message = first.message;
  if (!isRecord(message)) return readString(first.text);
  const content = message.content;
  if (typeof content === "string") return readString(content);
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (isRecord(part)) return readString(part.text) ?? readString(part.content);
        return null;
      })
      .filter(isNonEmpty);
    return parts.length > 0 ? parts.join("\n") : null;
  }
  return null;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(candidate.slice(start, end + 1));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => String(value)).filter(Boolean))];
}

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function pickNumberUnion<T extends number>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T;
function pickNumberUnion<T extends number>(
  value: unknown,
  allowed: readonly T[],
  fallback: T | null,
): T | null;
function pickNumberUnion<T extends number>(
  value: unknown,
  allowed: readonly T[],
  fallback: T | null,
): T | null {
  if (typeof value === "number" && (allowed as readonly number[]).includes(value)) {
    return value as T;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if ((allowed as readonly number[]).includes(parsed)) return parsed as T;
  }
  return fallback;
}

function pickStringUnion<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T;
function pickStringUnion<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T | null,
): T | null;
function pickStringUnion<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T | null,
): T | null {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}
