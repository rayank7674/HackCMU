import { isUnknown } from "@/types";
import type { Rule } from "./types";
import { ruleMatch } from "./types";
import {
  WINTER_KINDS,
  fallbackKinds,
  hasKind,
  hasOfficialWarning,
  inWinterRegion,
  isAllClear,
  isOfficialProduct,
  kindsFrom,
  knownFalse,
  knownPositive,
  knownTrue,
} from "./helpers";

export const winterStormRules: Rule[] = [
  {
    id: "winter.official_warning",
    evaluate(ctx) {
      const official = ctx.hazards.hazards.filter(
        (hazard) =>
          (WINTER_KINDS as readonly string[]).includes(hazard.kind) &&
          isOfficialProduct(hazard),
      );
      if (official.length === 0) return null;
      return ruleMatch(this.id, {
        title: "Stay off the roads — official winter storm or freeze warning",
        body: "This is an official cold-weather product. Shelter in place if the home is safe and heated. Check on the household, drip a faucet if pipes are a risk, and do not travel to run errands.",
        priority: "critical",
        category: "shelter",
        hazardKinds: fallbackKinds(official, WINTER_KINDS),
        rationale: "Official winter storm or extreme cold warning/emergency.",
        horizon: "now",
        official: true,
        costClass: "zero",
      });
    },
  },
  {
    id: "winter.watch_prep",
    evaluate(ctx) {
      if (hasOfficialWarning(ctx, WINTER_KINDS)) return null;
      const watches = ctx.hazards.hazards.filter(
        (hazard) =>
          (WINTER_KINDS as readonly string[]).includes(hazard.kind) &&
          (hazard.severity === "watch" || hazard.severity === "advisory"),
      );
      if (watches.length === 0) return null;
      return ruleMatch(this.id, {
        title: "Stage heat, water, and a stay-home kit before the storm arrives",
        body: "Bring pets in, charge phones, and set extra blankets in one room you can close off. A watch or advisory is not an all-clear.",
        priority: "high",
        category: "supplies",
        hazardKinds: kindsFrom(watches),
        rationale: "Non-warning winter/cold product.",
        horizon: "now",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "winter.warming_plan",
    evaluate(ctx) {
      if (knownTrue(ctx.home.hasBackupPower)) return null;
      const winter = hasKind(ctx, WINTER_KINDS);
      if (!winter && !(isAllClear(ctx) && inWinterRegion(ctx.home))) {
        return null;
      }
      const unknownPower = isUnknown(ctx.home.hasBackupPower);
      return ruleMatch(this.id, {
        title: unknownPower
          ? "Name a warming place — backup heat/power is unconfirmed"
          : "Name a warming place; this home has no backup power",
        body: "If heat fails, go to a pre-chosen library, warming center, or neighbor. Do not run a generator or grill indoors. Unknown backup power is not a generator on site.",
        priority: winter ? "high" : "medium",
        category: "power",
        hazardKinds: winter ? [...WINTER_KINDS] : ["winter_storm", "extreme_cold"],
        rationale: unknownPower
          ? "Winter risk plus unknown hasBackupPower."
          : "Winter risk plus confirmed no backup power.",
        horizon: winter ? "now" : "before_next_event",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "winter.pipe_freeze",
    evaluate(ctx) {
      const winter = hasKind(ctx, WINTER_KINDS);
      if (!winter && !(isAllClear(ctx) && inWinterRegion(ctx.home))) {
        return null;
      }
      return ruleMatch(this.id, {
        title: "Keep pipes from freezing — open cabinets and drip a faucet",
        body: "Let a thin stream run on an outdoor-wall faucet and open the cabinet doors. If the home is on a well, keep extra stored water before a freeze. This is a no-cost step.",
        priority: winter ? "high" : "low",
        category: "water",
        hazardKinds: winter ? [...WINTER_KINDS] : ["winter_storm", "extreme_cold"],
        rationale: "Winter hazard or winter-region quiet-weather pipe risk.",
        horizon: winter ? "now" : "before_next_event",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "winter.medical_power",
    evaluate(ctx) {
      if (!knownTrue(ctx.household.hasPowerDependentMedicalDevice)) return null;
      const risk = hasKind(ctx, [...WINTER_KINDS, "hurricane", "wind", "wildfire"]);
      if (!risk && !isAllClear(ctx)) return null;
      return ruleMatch(this.id, {
        title: "Power-dependent medical devices need a backup site",
        body: "If the outlet dies, this household needs a facility or neighbor with power. Register for utility medical priority if it exists locally, and pack device supplies with the go-bag. Do not assume outage length.",
        priority: risk ? "critical" : "high",
        category: "medical",
        hazardKinds: risk ? kindsFrom(ctx.hazards.hazards) : ["winter_storm"],
        rationale: "Confirmed power-dependent medical device.",
        horizon: risk ? "now" : "before_next_event",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "winter.seniors_checkin",
    evaluate(ctx) {
      const seniorsUnknown = isUnknown(ctx.household.seniorsCount);
      const hasSeniors = knownPositive(ctx.household.seniorsCount);
      if (!hasSeniors && !seniorsUnknown) return null;
      const winter = hasKind(ctx, WINTER_KINDS);
      if (!winter && !(isAllClear(ctx) && inWinterRegion(ctx.home))) {
        return null;
      }
      return ruleMatch(this.id, {
        title: seniorsUnknown
          ? "Confirm whether seniors are in the home before a freeze"
          : "Set a check-in for older adults during the cold",
        body: seniorsUnknown
          ? "Senior count is unanswered. Find out who needs a check-in. Unknown is not 'no older adults'."
          : "Agree on a phone time. Watch for a cold house, missed meals, or a quiet phone. This is a no-cost step.",
        priority: winter ? "high" : "low",
        category: "communication",
        hazardKinds: winter ? [...WINTER_KINDS] : ["winter_storm", "extreme_cold"],
        rationale: seniorsUnknown
          ? "Unknown seniorsCount plus winter risk."
          : "Confirmed seniors plus winter risk.",
        horizon: winter ? "now" : "before_next_event",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "winter.well_water",
    evaluate(ctx) {
      if (knownFalse(ctx.home.hasWellWater)) return null;
      const winter = hasKind(ctx, WINTER_KINDS);
      if (!winter && !(isAllClear(ctx) && inWinterRegion(ctx.home))) {
        return null;
      }
      const unknown = isUnknown(ctx.home.hasWellWater);
      return ruleMatch(this.id, {
        title: unknown
          ? "If this home might be on a well, store water before a freeze"
          : "Store well water before pumps or pipes fail in the cold",
        body: "Fill clean jugs while the pump still has power. Unknown well status is not 'city water for sure'. Do not drink unsafe melt water.",
        priority: winter ? "high" : "low",
        category: "water",
        hazardKinds: winter ? [...WINTER_KINDS] : ["winter_storm"],
        rationale: unknown
          ? "hasWellWater is unknown."
          : "hasWellWater is true.",
        horizon: winter ? "now" : "before_next_event",
        official: false,
        costClass: "zero",
      });
    },
  },
];
