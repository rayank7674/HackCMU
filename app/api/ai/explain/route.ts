import { NextResponse } from "next/server";
import {
  buildGrokExplainPayload,
  explainWithGrok,
  grokUnavailable,
  isExplainIntent,
  proposeScenarioWithGrok,
  proposeStressScenarioFromText,
  type ExplainIntent,
  type GrokExplainSource,
} from "@/lib/integrations/grok";
import { isRecord, readString } from "@/lib/integrations/http";
import type { TransportMode } from "@/lib/optimization";

export const dynamic = "force-dynamic";

/**
 * Grok explains a structured knapsack / stress result. It does not run
 * the planner or simulator, and it never invents recommendations.
 *
 * POST { intent, payload }
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json(
      grokUnavailable(
        "invalid_input",
        "Request body must be JSON with intent and payload.",
      ),
      { status: 400 },
    );
  }

  const intentValue = body.intent;
  if (!isExplainIntent(intentValue)) {
    return NextResponse.json(
      grokUnavailable(
        "invalid_input",
        "intent must be why_top_priority, what_with_constraints, why_plan_changed, why_combination, or propose_scenario.",
      ),
      { status: 400 },
    );
  }

  const payload = isRecord(body.payload) ? body.payload : {};
  const source = sourceFromPayload(intentValue, payload, body);

  if (intentValue === "propose_scenario") {
    return respondPropose(source);
  }

  const facts = buildGrokExplainPayload(source);
  const explained = await explainWithGrok(source);
  if (!explained.ok) {
    return NextResponse.json(
      {
        ...explained,
        facts,
        proposedScenario: null,
      },
      { status: explained.reason === "invalid_input" ? 400 : 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: "ok",
    service: "grok",
    intent: intentValue,
    text: explained.text,
    model: explained.model,
    facts,
    proposedScenario: null,
  });
}

async function respondPropose(source: GrokExplainSource) {
  const userText = source.userText ?? "";
  if (!userText) {
    return NextResponse.json(
      grokUnavailable(
        "invalid_input",
        "propose_scenario needs payload.userText describing the modeled disruption.",
      ),
      { status: 400 },
    );
  }

  const heuristic = proposeStressScenarioFromText(userText);
  const grok = await proposeScenarioWithGrok(userText);
  const facts = buildGrokExplainPayload(source);

  if (!grok.ok) {
    return NextResponse.json(
      {
        ...grok,
        facts,
        proposedScenario: heuristic,
        proposedSource: "heuristic",
      },
      { status: grok.reason === "invalid_input" ? 400 : 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: "ok",
    service: "grok",
    intent: "propose_scenario" as const,
    text: null,
    facts,
    proposedScenario: grok.proposedScenario,
    proposedSource: "grok",
  });
}

function sourceFromPayload(
  intent: ExplainIntent,
  payload: Record<string, unknown>,
  body: Record<string, unknown>,
): GrokExplainSource {
  const constraints = isRecord(payload.constraints)
    ? payload.constraints
    : isRecord(body.constraints)
      ? body.constraints
      : null;
  const planDelta = firstRecord(payload.diff, payload.planDelta, body.diff);
  const stress = firstRecord(payload.stress, payload.stressResult);
  const optimization = isRecord(payload.optimization)
    ? payload.optimization
    : isRecord(payload.plan)
      ? payload.plan
      : null;

  const selected = Array.isArray(payload.selected)
    ? payload.selected
    : optimization && Array.isArray(optimization.selected)
      ? optimization.selected
      : optimization && Array.isArray(optimization.candidates)
        ? optimization.candidates.filter(
            (item) => isRecord(item) && item.selected === true,
          )
        : [];

  const selectedIds = Array.isArray(payload.selectedIds)
    ? payload.selectedIds
    : optimization && Array.isArray(optimization.selectedIds)
      ? optimization.selectedIds
      : undefined;

  const rejected = Array.isArray(payload.rejected)
    ? payload.rejected
    : optimization && Array.isArray(optimization.rejected)
      ? optimization.rejected
      : undefined;

  const cascadeFromResult = Array.isArray(stress?.cascadePath)
    ? stress.cascadePath.map((id) => {
        const nodes = Array.isArray(stress.nodes) ? stress.nodes : [];
        const match = nodes.find((node) => isRecord(node) && node.id === id);
        return isRecord(match) ? (match.label ?? id) : id;
      })
    : payload.cascadeNodeLabels;

  return {
    intent,
    selectedIds: asStringArray(selectedIds),
    selected: Array.isArray(selected)
      ? selected.filter(isRecord).map((item) => ({
          id: readString(item.id) ?? undefined,
          title: readString(item.title) ?? undefined,
          ruleId: readString(item.ruleId) ?? undefined,
          hardConstraint: item.hardConstraint === true,
        }))
      : undefined,
    rejected: Array.isArray(rejected)
      ? rejected.filter(isRecord).map((item) => ({
          id: readString(item.id) ?? undefined,
          ruleId: readString(item.ruleId) ?? undefined,
          reasons: Array.isArray(item.reasons)
            ? item.reasons.map((reason) => String(reason))
            : [],
        }))
      : undefined,
    hardConstraintIds: asStringArray(
      payload.hardConstraintIds ?? optimization?.hardConstraintIds,
    ),
    constraints: constraints ? readConstraints(constraints) : undefined,
    notes: asStringArray(payload.notes ?? optimization?.notes),
    officialHeadlines: asStringArray(payload.officialHeadlines),
    planDelta: planDelta
      ? {
          addedIds: asStringArray(planDelta.addedIds) ?? [],
          removedIds: asStringArray(planDelta.removedIds) ?? [],
          reordered: planDelta.reordered === true,
          summary: readString(planDelta.summary) ?? "",
        }
      : null,
    cascadeNodeLabels: asStringArray(cascadeFromResult),
    firstBreakLabel: firstBreakLabel(stress, payload),
    disruptionLevel:
      readString(stress?.disruptionLevel) ?? readString(payload.disruptionLevel),
    assumptions: asStringArray(payload.assumptions ?? stress?.assumptions),
    modeledHouseholdAccess:
      typeof stress?.householdAccess === "number"
        ? stress.householdAccess
        : typeof payload.modeledHouseholdAccess === "number"
          ? payload.modeledHouseholdAccess
          : null,
    userText:
      readString(payload.userText) ??
      readString(payload.text) ??
      readString(body.userText),
  };
}

function readConstraints(
  constraints: Record<string, unknown>,
): GrokExplainSource["constraints"] {
  return {
    budgetUnits: asNullNumber(constraints.budgetUnits),
    budgetDollars: asNullNumber(constraints.budgetDollars),
    availableTimeMinutes: asNullNumber(constraints.availableTimeMinutes),
    transport: readTransport(constraints.transport),
  };
}

function readTransport(value: unknown): TransportMode | undefined {
  if (
    value === "car" ||
    value === "limited" ||
    value === "none" ||
    value === "unknown"
  ) {
    return value;
  }
  return undefined;
}

function firstBreakLabel(
  stress: Record<string, unknown> | null,
  payload: Record<string, unknown>,
): string | null {
  const fromPayload = readString(payload.firstBreakLabel);
  if (fromPayload) return fromPayload;
  const first = stress && isRecord(stress.firstBreak) ? stress.firstBreak : null;
  return first ? (readString(first.label) ?? readString(first.id)) : null;
}

function firstRecord(
  ...values: unknown[]
): Record<string, unknown> | null {
  for (const value of values) {
    if (isRecord(value)) return value;
  }
  return null;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => String(item)).filter((item) => item.length > 0);
}

function asNullNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const parsed: unknown = await request.json().catch(() => null);
  if (!isRecord(parsed)) return null;
  return parsed;
}
