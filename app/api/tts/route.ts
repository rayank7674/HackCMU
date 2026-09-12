import { NextResponse } from "next/server";
import { elevenLabsSpeak } from "@/lib/integrations/elevenlabs";
import { httpStatusForAi } from "@/lib/ai";
import { isRecord, readString } from "@/lib/integrations/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/tts
 * Speaks already-approved plan or stress summary text.
 * Fail-closed without ELEVENLABS_API_KEY. Does not generate new copy.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = isRecord(body) ? readString(body.text) : null;
  const result = await elevenLabsSpeak(text);

  if (!result.ok) {
    return NextResponse.json(result, { status: httpStatusForAi(result) });
  }

  return new NextResponse(Buffer.from(result.audio), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      status: "unavailable",
      reason: "invalid_input",
      message:
        "POST already-approved text to /api/tts. StormReady will not invent narration.",
      service: "elevenlabs",
      inventedPolicy: false,
    },
    { status: 405 },
  );
}
