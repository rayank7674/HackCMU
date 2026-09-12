import { isRecord, readString } from "@/lib/integrations/http";
import type { ChatMessage } from "./types";
import { AI_TIMEOUT_MS } from "./types";

export type ChatCompleteOk = {
  ok: true;
  text: string;
};

export type ChatCompleteErr = {
  ok: false;
  error: string;
  timedOut: boolean;
  status: number | null;
};

export type ChatCompleteResult = ChatCompleteOk | ChatCompleteErr;

export function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

export async function completeChat(options: {
  url: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
}): Promise<ChatCompleteResult> {
  try {
    const response = await fetch(options.url, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        temperature: options.temperature ?? 0,
        messages: options.messages,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}`,
        timedOut: false,
        status: response.status,
      };
    }

    const data: unknown = await response.json().catch(() => null);
    const text = readChatText(data);
    if (!text) {
      return {
        ok: false,
        error: "Model returned no text",
        timedOut: false,
        status: response.status,
      };
    }
    return { ok: true, text };
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ok: false,
      error: timedOut
        ? "Request timed out"
        : error instanceof Error
          ? error.message
          : "Request failed",
      timedOut,
      status: null,
    };
  }
}

export function readChatText(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const outputText = readString(data.output_text);
  if (outputText) return outputText;

  const choices = data.choices;
  if (Array.isArray(choices) && choices[0] && isRecord(choices[0])) {
    const message = choices[0].message;
    if (isRecord(message)) {
      const content = readString(message.content);
      if (content) return content;
    }
    const text = readString(choices[0].text);
    if (text) return text;
  }

  const output = data.output;
  if (Array.isArray(output)) {
    const pieces: string[] = [];
    for (const item of output) {
      if (!isRecord(item)) continue;
      const content = item.content;
      if (typeof content === "string") {
        const piece = readString(content);
        if (piece) pieces.push(piece);
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (isRecord(part)) {
            const piece = readString(part.text) ?? readString(part.content);
            if (piece) pieces.push(piece);
          }
        }
      }
    }
    if (pieces.length > 0) return pieces.join("\n").trim();
  }

  return null;
}

export function stripFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}
