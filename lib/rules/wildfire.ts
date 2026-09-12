import type { Rule } from "./types";
import { ruleMatch } from "./types";
import {
  WILDFIRE_KINDS,
  hasKind,
  hasOfficialWarning,
  inWildfireRegion,
  isAllClear,
  isOfficialProduct,
  kindsFrom,
} from "./helpers";

export const wildfireRules: Rule[] = [
  {
    id: "wildfire.official_evac",
    evaluate(ctx) {
      const official = ctx.hazards.hazards.filter(
        (hazard) =>
          hazard.kind === "wildfire" && isOfficialProduct(hazard),
      );
      if (official.length === 0) return null;
      return ruleMatch(this.id, {
        title: "Leave now - official wildfire warning or evacuation",
        body: "This is an official fire product. Go to your pre-planned place. Close windows as you leave if you have seconds, but do not stay to wet the roof or pack extras. Official fire orders outrank property prep.",
        priority: "critical",
        category: "evacuate",
        hazardKinds: ["wildfire"],
        rationale: "Official wildfire warning, emergency, or evacuation language.",
        horizon: "now",
        official: true,
        costClass: "zero",
      });
    },
  },
  {
    id: "wildfire.ready_to_go",
    evaluate(ctx) {
      if (hasOfficialWarning(ctx, WILDFIRE_KINDS)) return null;
      const watches = ctx.hazards.hazards.filter(
        (hazard) =>
          hazard.kind === "wildfire" &&
          (hazard.severity === "watch" || hazard.severity === "advisory"),
      );
      if (watches.length === 0) return null;
      return ruleMatch(this.id, {
        title: "Stage the go-bag and two ways out",
        body: "A wildfire watch or advisory is not an order and not an all-clear. Park the car facing out, set the bag by the door, and keep pets leashed or crated so you can leave in minutes.",
        priority: "high",
        category: "supplies",
        hazardKinds: kindsFrom(watches),
        rationale: "Non-warning wildfire product.",
        horizon: "now",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "wildfire.documents",
    evaluate(ctx) {
      if (!hasKind(ctx, WILDFIRE_KINDS)) return null;
      return ruleMatch(this.id, {
        title: "Take IDs, medications, and one packet of documents",
        body: "Grab the already-staged envelope: IDs, insurance, medications, and a phone charger. Do not search the house for valuables once an official update tells you to go.",
        priority: "high",
        category: "documents",
        hazardKinds: ["wildfire"],
        rationale: "Active wildfire product - documents travel with the household.",
        horizon: "now",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "wildfire.defensible_space",
    evaluate(ctx) {
      if (!isAllClear(ctx) || !inWildfireRegion(ctx.home)) return null;
      return ruleMatch(this.id, {
        title: "Clear embers paths on a no-cost or low-cost afternoon",
        body: "Move grill propane, doormats, and leftover cardboard away from walls. Sweep dry leaves off the first 5 feet. Larger vegetation work can wait for a higher budget class.",
        priority: "low",
        category: "other",
        hazardKinds: ["wildfire"],
        rationale: "Quiet weather in a wildfire-prone state; long-term ember hygiene.",
        horizon: "long_term",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "wildfire.region_go_bag",
    evaluate(ctx) {
      if (!isAllClear(ctx) || !inWildfireRegion(ctx.home)) return null;
      return ruleMatch(this.id, {
        title: "Keep a wildfire go-bag packed before the next red-flag day",
        body: "N95s, NWS alert notifications, pet gear, and a paper map of two routes. This is readiness, not an invented fire alert.",
        priority: "medium",
        category: "supplies",
        hazardKinds: ["wildfire"],
        rationale: "All-clear wildfire-region preparedness.",
        horizon: "before_next_event",
        official: false,
        costClass: "low",
      });
    },
  },
];
