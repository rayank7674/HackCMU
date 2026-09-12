import { chatCompletionsUrl, completeChat } from "@/lib/ai/chat";
import { getK2Env } from "@/lib/ai/env";
import { K2_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { ChatMessage } from "@/lib/ai/types";
import { aiUnavailable, type AiUnavailable } from "@/lib/ai/unavailable";

export type K2CompleteOk = { ok: true; text: string };
export type K2CompleteResult = K2CompleteOk | AiUnavailable;

/**
 * Env-configured OpenAI-compatible K2 client.
 * Does not invent a host: K2_API_BASE_URL and K2_MODEL are required.
 */
export async function k2Complete(
  messages: ChatMessage[],
): Promise<K2CompleteResult> {
  const env = getK2Env();
  if (!env) {
    return aiUnavailable(
      "k2",
      "k2_not_configured",
      "K2_API_KEY, K2_API_BASE_URL, and K2_MODEL must all be set. StormReady will not invent a K2 host.",
    );
  }

  const withSystem =
    messages.some((message) => message.role === "system")
      ? messages
      : [{ role: "system" as const, content: K2_SYSTEM_PROMPT }, ...messages];

  const result = await completeChat({
    url: chatCompletionsUrl(env.baseUrl),
    apiKey: env.apiKey,
    model: env.model,
    messages: withSystem,
    temperature: 0,
  });

  if (!result.ok) {
    return aiUnavailable(
      "k2",
      result.timedOut ? "upstream_unavailable" : "upstream_error",
      result.error,
    );
  }
  return { ok: true, text: result.text };
}
