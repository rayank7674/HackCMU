import { NextResponse } from "next/server";
import { isRecord } from "@/lib/integrations/http";
import { explainPlanOrStress, httpStatusForAi } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/explain
 * Grok restates structured optimizer/stress JSON. Fail-closed without XAI_API_KEY.
 * Never invents safety policy, alerts, or an all-clear.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    const result = await explainPlanOrStress({ task: null, input: null });
    if (!result.ok) {
      return NextResponse.json(result, { status: httpStatusForAi(result) });
    }
    return NextResponse.json(result);
  }

  const task = body.task;
  const input = isRecord(body.input) ? body.input : omitTask(body);
  const result = await explainPlanOrStress({ task, input });
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
      message: "POST structured JSON to /api/explain. FaultLine will not invent an explanation.",
      service: "grok",
      inventedPolicy: false,
    },
    { status: 405 },
  );
}

function omitTask(body: Record<string, unknown>): Record<string, unknown> {
  const { task: _task, ...rest } = body;
  return rest;
}
