import type {
  BudgetClass,
  HazardKind,
  HazardState,
  HomeProfile,
  HouseholdProfile,
  RecommendationCategory,
  RecommendationHorizon,
  RecommendationPriority,
} from "@/types";

export type RuleContext = {
  home: HomeProfile;
  household: HouseholdProfile;
  hazards: HazardState;
};

export type RuleMatch = {
  ruleId: string;
  title: string;
  body: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  hazardKinds: HazardKind[];
  rationale: string;
  horizon: RecommendationHorizon;
  official: boolean;
  costClass: BudgetClass;
};

export type Rule = {
  id: string;
  evaluate(ctx: RuleContext): RuleMatch | null;
};

export function ruleMatch(
  ruleId: string,
  fields: Omit<RuleMatch, "ruleId">,
): RuleMatch {
  return { ruleId, ...fields };
}
