import { hurricaneRules } from "./hurricane";
import { wildfireRules } from "./wildfire";
import { winterStormRules } from "./winter_storm";
import type { Rule } from "./types";

export const ALL_RULES: Rule[] = [
  ...hurricaneRules,
  ...wildfireRules,
  ...winterStormRules,
];

export const RULE_COUNT = ALL_RULES.length;

export { hurricaneRules } from "./hurricane";
export { wildfireRules } from "./wildfire";
export { winterStormRules } from "./winter_storm";
export type { Rule, RuleContext, RuleMatch } from "./types";
export { ruleMatch } from "./types";
