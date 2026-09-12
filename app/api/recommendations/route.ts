import { NextResponse } from "next/server";
import {
  hazardFixtureFor,
  tampaDemoInput,
  type DemoScenario,
} from "@/lib/fixtures/tampa-demo";
import { recommend, isRecommendationInput } from "@/lib/recommendations/engine";
import type { RecommendationInput } from "@/lib/recommendations/types";

const SCENARIOS = new Set<DemoScenario>([
  "quiet",
  "watch",
  "warning",
  "evac",
  "flood",
]);

function parseScenario(value: string | null): DemoScenario {
  if (value && SCENARIOS.has(value as DemoScenario)) {
    return value as DemoScenario;
  }
  return "quiet";
}

/**
 * UI contract (Phase 1):
 *   POST /api/recommendations
 *   { home, household?, hazards, hazardSource? }
 *
 * `hazardSource: "unavailable"` or a missing/unconfirmed HazardState fails
 * closed with `status: "unavailable"` and an empty list — never an invented
 * official alert. Quiet weather for judging: GET ?fixture=tampa only.
 * A bare GET is unavailable — never a silent Tampa all-clear.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isRecommendationInput(body)) {
    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        reason: "invalid_request",
        recommendations: [],
        matchedRuleIds: [],
        ruleCount: 0,
      },
      { status: 400 },
    );
  }

  const input: RecommendationInput = {
    home: body.home ?? null,
    household: body.household ?? null,
    hazards: body.hazards ?? null,
    hazardSource: body.hazardSource,
  };

  const result = recommend(input);
  return NextResponse.json({
    ok: true,
    ...result,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fixture = url.searchParams.get("fixture");
  const scenario = parseScenario(url.searchParams.get("scenario"));

  if (fixture === "tampa") {
    const input = tampaDemoInput(scenario);
    const result = recommend(input);
    return NextResponse.json({
      ok: true,
      fixture: "tampa",
      scenario,
      profile: {
        home: input.home,
        household: input.household,
      },
      hazards: hazardFixtureFor(scenario),
      ...result,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      status: "unavailable",
      reason: fixture == null || fixture === "" ? "missing_fixture" : "unknown_fixture",
      recommendations: [],
    },
    { status: 400 },
  );
}
