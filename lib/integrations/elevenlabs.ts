import { getElevenLabsApiKey, getElevenLabsVoiceId } from "@/lib/ai/env";
import {
  ELEVENLABS_DEFAULT_VOICE_ID,
  ELEVENLABS_MODEL_ID,
  ELEVENLABS_TTS_ORIGIN,
  TTS_MAX_CHARS,
  type TtsResult,
} from "@/lib/ai/types";
import { aiUnavailable } from "@/lib/ai/unavailable";

function approvedText(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length > TTS_MAX_CHARS) return null;
  return trimmed;
}

/**
 * Read already-approved plan or stress summary text.
 * Fail-closed without ELEVENLABS_API_KEY. Does not generate new copy.
 */
export async function elevenLabsSpeak(text: unknown): Promise<TtsResult> {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) {
    return aiUnavailable(
      "elevenlabs",
      "elevenlabs_not_configured",
      "ELEVENLABS_API_KEY is not set. Read My Plan stays unavailable instead of inventing audio.",
    );
  }

  const approved = approvedText(text);
  if (!approved) {
    return aiUnavailable(
      "elevenlabs",
      "invalid_input",
      "Read My Plan needs already-approved text within the length limit. StormReady will not invent narration.",
    );
  }

  const voiceId = getElevenLabsVoiceId() ?? ELEVENLABS_DEFAULT_VOICE_ID;
  const url = `${ELEVENLABS_TTS_ORIGIN}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;

  try {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: approved,
        model_id: ELEVENLABS_MODEL_ID,
      }),
    });

    if (!response.ok) {
      return aiUnavailable(
        "elevenlabs",
        "upstream_error",
        `HTTP ${response.status}`,
      );
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength === 0) {
      return aiUnavailable(
        "elevenlabs",
        "upstream_error",
        "ElevenLabs returned empty audio.",
      );
    }

    return {
      ok: true,
      status: "ok",
      service: "elevenlabs",
      audio: buffer,
      contentType: "audio/mpeg",
    };
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return aiUnavailable(
      "elevenlabs",
      timedOut ? "upstream_unavailable" : "upstream_error",
      timedOut
        ? "Request timed out"
        : error instanceof Error
          ? error.message
          : "Request failed",
    );
  }
}
