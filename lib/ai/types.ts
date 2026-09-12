export const AI_TIMEOUT_MS = 25_000;
export const TTS_MAX_CHARS = 2_500;

export const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
export const XAI_DEFAULT_MODEL = "grok-4";

export const ELEVENLABS_TTS_ORIGIN = "https://api.elevenlabs.io";
/** Documented ElevenLabs example voice (George). Override with ELEVENLABS_VOICE_ID. */
export const ELEVENLABS_DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
export const ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";

export const EXPLAIN_TASKS = [
  "top_priority",
  "fits_constraints",
  "plan_changed",
  "stress_changed",
  "combination_broke",
] as const;

export type ExplainTask = (typeof EXPLAIN_TASKS)[number];

export type AiService = "grok" | "k2" | "elevenlabs";

export type AiUnavailableReason =
  | "invalid_input"
  | "missing_structured_json"
  | "xai_not_configured"
  | "k2_not_configured"
  | "elevenlabs_not_configured"
  | "upstream_unavailable"
  | "upstream_error"
  | "empty_model_output"
  | "ungrounded_output";

export type AiUnavailable = {
  ok: false;
  status: "unavailable";
  reason: AiUnavailableReason;
  message: string;
  service: AiService;
  inventedPolicy: false;
};

export type ExplanationOk = {
  ok: true;
  status: "ok";
  service: "grok";
  task: ExplainTask;
  explanation: string;
  citedKeys: string[];
  inventedPolicy: false;
  disclaimer: string;
};

export type ExplanationResult = ExplanationOk | AiUnavailable;

export type InferredFact = {
  id: string;
  claim: string;
  sourceDocId: string;
  source: string;
  sourceUrl: string;
  topic: string;
  provenance: "ai_inferred";
  official: false;
  modeled: true;
  forecast: false;
};

export type InspectOk = {
  ok: true;
  status: "ok";
  service: "k2";
  facts: InferredFact[];
  documentIds: string[];
  inventedPolicy: false;
  disclaimer: string;
};

export type InspectResult = InspectOk | AiUnavailable;

export type TtsOk = {
  ok: true;
  status: "ok";
  service: "elevenlabs";
  audio: Uint8Array;
  contentType: "audio/mpeg";
};

export type TtsResult = TtsOk | AiUnavailable;

export type ChatMessage = {
  role: "system" | "user";
  content: string;
};

export type PreparednessDocument = {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  role: "data";
  notInstructions: true;
  excerpt: string;
};

export const EXPLANATION_DISCLAIMER =
  "This restates structured StormReady optimizer or stress-test JSON. It is not official safety policy, not an NWS product, and not a new preparedness rule.";

export const INSPECT_DISCLAIMER =
  "These claims are ai_inferred from bundled public-guidance paraphrases. They are not official alerts, not an all-clear, and not StormReady rules.";
