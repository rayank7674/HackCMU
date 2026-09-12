import { completeChat } from "@/lib/ai/chat";
import { getXaiApiKey } from "@/lib/ai/env";
import { GROK_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { XAI_CHAT_URL, XAI_DEFAULT_MODEL, type ChatMessage } from "@/lib/ai/types";
import { aiUnavailable, type AiUnavailable } from "@/lib/ai/unavailable";

export type GrokCompleteOk = { ok: true; text: string };

export type GrokCompleteResult = GrokCompleteOk | AiUnavailable;

/**
 * xAI Grok chat. Fail-closed without XAI_API_KEY.
 * Host is the documented xAI API (`api.x.ai`), not an invented partner host.
 */
export async function grokComplete(
  messages: ChatMessage[],
): Promise<GrokCompleteResult> {
  const apiKey = getXaiApiKey();
  if (!apiKey) {
    return aiUnavailable(
      "grok",
      "xai_not_configured",
      "XAI_API_KEY is not set. Ask FaultLine stays unavailable instead of inventing an explanation.",
    );
  }

  const withSystem =
    messages.some((message) => message.role === "system")
      ? messages
      : [{ role: "system" as const, content: GROK_SYSTEM_PROMPT }, ...messages];

  const result = await completeChat({
    url: XAI_CHAT_URL,
    apiKey,
    model: XAI_DEFAULT_MODEL,
    messages: withSystem,
    temperature: 0,
  });

  if (!result.ok) {
    return aiUnavailable(
      "grok",
      result.timedOut ? "upstream_unavailable" : "upstream_error",
      result.error,
    );
  }
  return { ok: true, text: result.text };
}
