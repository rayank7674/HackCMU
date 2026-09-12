import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getK2Env,
  isElevenLabsConfigured,
  isGrokConfigured,
  isK2Configured,
} from "@/lib/ai/env";
import { chatCompletionsUrl } from "@/lib/ai/chat";
import { validateExplainRequest } from "@/lib/ai/explain";
import { inspectPreparednessDocuments } from "@/lib/ai/inspect";
import { elevenLabsSpeak } from "@/lib/integrations/elevenlabs";
import { grokComplete } from "@/lib/integrations/grok";
import { k2Complete } from "@/lib/integrations/k2";

const KEYS = [
  "XAI_API_KEY",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "K2_API_KEY",
  "K2_API_BASE_URL",
  "K2_MODEL",
] as const;

const previous = new Map<string, string | undefined>();

function stash() {
  for (const key of KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
}

function restore() {
  for (const key of KEYS) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AI env fail-closed", () => {
  it("treats missing XAI_API_KEY as unconfigured", () => {
    stash();
    expect(isGrokConfigured()).toBe(false);
  });

  it("treats missing ElevenLabs key as unconfigured", () => {
    stash();
    expect(isElevenLabsConfigured()).toBe(false);
  });

  it("does not invent a K2 host when base URL or model is missing", () => {
    stash();
    process.env.K2_API_KEY = "secret";
    expect(isK2Configured()).toBe(false);
    expect(getK2Env()).toBeNull();

    process.env.K2_API_BASE_URL = "https://example.invalid/v1";
    expect(isK2Configured()).toBe(false);

    process.env.K2_MODEL = "k2";
    expect(isK2Configured()).toBe(true);
    expect(getK2Env()?.baseUrl).toBe("https://example.invalid/v1");
  });

  it("builds chat completions URLs from the provided base only", () => {
    expect(chatCompletionsUrl("https://partner.example/v1")).toBe(
      "https://partner.example/v1/chat/completions",
    );
    expect(
      chatCompletionsUrl("https://partner.example/v1/chat/completions"),
    ).toBe("https://partner.example/v1/chat/completions");
  });
});

describe("clients fail closed without keys", () => {
  it("does not call xAI without XAI_API_KEY", async () => {
    stash();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await grokComplete([
      { role: "user", content: "explain" },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("xai_not_configured");
      expect(result.inventedPolicy).toBe(false);
    }
  });

  it("does not call K2 without a configured host", async () => {
    stash();
    process.env.K2_API_KEY = "secret";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await k2Complete([{ role: "user", content: "inspect" }]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("k2_not_configured");
  });

  it("does not call ElevenLabs without ELEVENLABS_API_KEY", async () => {
    stash();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await elevenLabsSpeak("Approved plan text.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("elevenlabs_not_configured");
  });
});

describe("explain / inspect guards", () => {
  it("refuses to explain without structured JSON even when a key exists", () => {
    stash();
    process.env.XAI_API_KEY = "test-key";
    const result = validateExplainRequest({
      task: "top_priority",
      input: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_structured_json");
  });

  it("does not inspect documents without K2 env", async () => {
    stash();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await inspectPreparednessDocuments();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("k2_not_configured");
  });
});
