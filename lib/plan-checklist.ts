import type { RecommendationView } from "@/lib/stormready-api";

export type ImportanceTone = "critical" | "high" | "ok";

export function importanceFromAction(
  action: RecommendationView,
): ImportanceTone {
  if (action.priority === "critical" || action.hardConstraint || action.official) {
    return "critical";
  }
  if (action.priority === "high") return "high";
  return "ok";
}

export function importanceRank(action: RecommendationView): number {
  const tone = importanceFromAction(action);
  if (tone === "critical") return 0;
  if (tone === "high") return 1;
  return 2;
}

/** Same ordering as Plan checklist Step 1 → 3. */
export function checklistActions(
  recommendations: RecommendationView[],
  limit = 3,
): RecommendationView[] {
  return [...recommendations]
    .sort((a, b) => importanceRank(a) - importanceRank(b))
    .slice(0, limit);
}

export function topChecklistAction(
  recommendations: RecommendationView[],
): RecommendationView | undefined {
  return checklistActions(recommendations, 1)[0];
}
