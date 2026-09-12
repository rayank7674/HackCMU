import { GROK_SYSTEM_PROMPT } from "./prompts";
import { grokComplete } from "@/lib/integrations/grok";
import { getXaiApiKey } from "./env";
import { looksLikeInventedPolicy } from "./grounding";
import { grokUserPrompt, readExplanationPayload } from "./prompts";
import {
  EXPLAIN_TASKS,
  EXPLANATION_DISCLAIMER,
  type ExplainTask,
  type ExplanationResult,
} from "./types";
import { aiUnavailable } from "./unavailable";
import { isRecord } from "@/lib/integrations/http";

export function isExplainTask(value: unknown): value is ExplainTask {
  return typeof value === "string" && (EXPLAIN_TASKS as readonly string[]).includes(value);
}

export function hasStructuredJson(value: unknown): boolean {
  if (Array.isArray(value) && value.length > 0) return true;
  if (!isRecord(value)) return false;
  return Object.keys(value).length > 0;
}

function requiredPayload(task: ExplainTask, input: Record<string, unknown>): boolean {
  switch (task) {
    case "top_priority":
      return Array.isArray(input.selected) || Array.isArray(input.selectedIds);
    case "fits_constraints":
      return isRecord(input.constraintsUsed) || Array.isArray(input.rejected);
    case "plan_changed":
      return (
        isRecord(input.diff) ||
        Array.isArray(input.addedIds) ||
        (isRecord(input.before) && isRecord(input.after))
      );
    case "stress_changed":
      return isRecord(input.before) && isRecord(input.after);
    case "combination_broke":
      return (
        isRecord(input.result) ||
        isRecord(input.firstBreak) ||
        Array.isArray(input.cascadePath) ||
        input.status === "found" ||
        input.status === "no_breakdown"
      );
  }
}

export function validateExplainRequest(options: {
  task: unknown;
  input: unknown;
}): ExplanationResult | { ok: true; task: ExplainTask; input: Record<string, unknown> } {
  if (!isExplainTask(options.task)) {
    return aiUnavailable(
      "grok",
      "invalid_input",
      "Unknown explanation task. StormReady will not invent a narrative.",
    );
  }
  if (!hasStructuredJson(options.input) || !isRecord(options.input)) {
    return aiUnavailable(
      "grok",
      "missing_structured_json",
      "Explanation needs structured optimizer or stress JSON. StormReady will not invent one.",
    );
  }
  if (!requiredPayload(options.task, options.input)) {
    return aiUnavailable(
      "grok",
      "missing_structured_json",
      `Task ${options.task} is missing the required JSON fields. StormReady will not invent them.`,
    );
  }
  if (!getXaiApiKey()) {
    return aiUnavailable(
      "grok",
      "xai_not_configured",
      "XAI_API_KEY is not set. Ask StormReady stays unavailable instead of inventing an explanation.",
    );
  }
  return { ok: true, task: options.task, input: options.input };
}

export async function explainPlanOrStress(options: {
  task: unknown;
  input: unknown;
}): Promise<ExplanationResult> {
  const prepared = validateExplainRequest(options);
  if (!prepared.ok) return prepared;

  const completion = await grokComplete([
    { role: "system", content: GROK_SYSTEM_PROMPT },
    { role: "user", content: grokUserPrompt(prepared.task, prepared.input) },
  ]);

  if (!completion.ok) return completion;

  const parsed = readExplanationPayload(completion.text);
  if (!parsed) {
    return aiUnavailable(
      "grok",
      "empty_model_output",
      "Grok returned an empty explanation. StormReady will not invent one.",
    );
  }
  if (looksLikeInventedPolicy(parsed.explanation)) {
    return aiUnavailable(
      "grok",
      "ungrounded_output",
      "Grok output looked like invented safety policy and was discarded.",
    );
  }

  return {
    ok: true,
    status: "ok",
    service: "grok",
    task: prepared.task,
    explanation: parsed.explanation,
    citedKeys: parsed.citedKeys,
    inventedPolicy: false,
    disclaimer: EXPLANATION_DISCLAIMER,
  };
}
