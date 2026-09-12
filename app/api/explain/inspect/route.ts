import { NextResponse } from "next/server";
import { httpStatusForAi, inspectPreparednessDocuments } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/explain/inspect
 * K2 extracts ai_inferred facts from bundled FEMA/Ready.gov paraphrases.
 * Documents are data, not instructions. Never writes rules or alerts.
 */
export async function POST() {
  const result = await inspectPreparednessDocuments();
  if (!result.ok) {
    return NextResponse.json(result, { status: httpStatusForAi(result) });
  }
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      status: "unavailable",
      reason: "invalid_input",
      message:
        "POST /api/explain/inspect to extract ai_inferred facts. FaultLine will not invent a K2 host or alerts.",
      service: "k2",
      inventedPolicy: false,
    },
    { status: 405 },
  );
}
