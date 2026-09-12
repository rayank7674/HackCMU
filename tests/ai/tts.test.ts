import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/tts/route";
import { TTS_MAX_CHARS } from "@/lib/ai/types";

const KEYS = ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] as const;
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

describe("POST /api/tts", () => {
  it("fails closed without ELEVENLABS_API_KEY", async () => {
    stash();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "plan",
          text: "Fill water containers. This is already-approved plan text.",
        }),
      }),
    );
    const body = await response.json();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("elevenlabs_not_configured");
    expect(body.inventedPolicy).toBe(false);
  });

  it("does not invent narration for empty text even when a key exists", async () => {
    stash();
    process.env.ELEVENLABS_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "   " }),
      }),
    );
    const body = await response.json();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(body.reason).toBe("invalid_input");
  });

  it("rejects overlong text instead of sending it", async () => {
    stash();
    process.env.ELEVENLABS_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "a".repeat(TTS_MAX_CHARS + 1) }),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
  });

  it("returns mpeg audio for approved text", async () => {
    stash();
    process.env.ELEVENLABS_API_KEY = "test-key";
    const bytes = new Uint8Array([1, 2, 3, 4]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => bytes.buffer,
      }),
    );
    const response = await POST(
      new Request("http://localhost/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "stress",
          text: "Modeled disruption is major. This is not a forecast.",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.length).toBe(4);
  });

  it("rejects GET", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
  });
});
