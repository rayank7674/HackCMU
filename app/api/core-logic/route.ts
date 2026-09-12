import { NextResponse } from "next/server";

type CoreLogicPayload = {
  source?: "external-api" | "calculation";
  input?: unknown;
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    ready: true,
    message: "core-logic route is ready to accept data or calculations.",
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CoreLogicPayload;

  // Wire this handler to an external API or run session math.
  return NextResponse.json({
    ok: true,
    received: body,
    result: null,
  });
}
