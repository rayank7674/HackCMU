import { NextResponse } from "next/server";
import {
  analyzeWithK2,
  httpStatusForUnavailable,
  k2ExtractRequestFromBody,
  loadBundledPreparednessDocuments,
} from "@/lib/integrations";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/k2  { task?: string }
 *
 * Runs K2 extract on the bundled public preparedness corpus only.
 * Uploaded files, document bodies, and prompt overrides are ignored
 * so they cannot replace safety rules.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const { task } = k2ExtractRequestFromBody(body);
  const documents = loadBundledPreparednessDocuments();
  const result = await analyzeWithK2({ documents, task });

  if (!result.ok) {
    return NextResponse.json(
      {
        ...result,
        items: [],
        provenance: "ai_inferred",
      },
      { status: httpStatusForUnavailable(result) },
    );
  }

  return NextResponse.json({
    ok: true,
    items: result.items,
    provenance: "ai_inferred",
  });
}
