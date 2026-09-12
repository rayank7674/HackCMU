import { NextResponse } from "next/server";
import { requirePlanRouteContext } from "@/lib/supabase/plan-api";
import { loadStormReadySnapshot } from "@/lib/supabase/persist";

/**
 * GET /api/load-plan
 *
 * 503 if Supabase env is missing.
 * 401 if Auth0 identity is not available (dev bypass is development-only).
 */
export async function GET(request: Request) {
  const context = await requirePlanRouteContext(request);
  if (!context.ok) return context.response;

  const result = await loadStormReadySnapshot(context.client, context.identity);
  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    snapshot: result.snapshot,
  });
}
