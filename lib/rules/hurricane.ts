import { isUnknown } from "@/types";
import type { Rule } from "./types";
import { ruleMatch } from "./types";
import {
  FLOOD_KINDS,
  HURRICANE_KINDS,
  OUTAGE_RISK_KINDS,
  WIND_KINDS,
  accessUnknown,
  fallbackKinds,
  hasKind,
  hasOfficialWarning,
  hasPets,
  inHurricaneRegion,
  isAllClear,
  isManufactured,
  isOfficialProduct,
  isOlderRoof,
  isUnknownRoof,
  kindsFrom,
  knownFalse,
  knownTrue,
  needsAccessHelp,
  officialHazards,
  petsUnknown,
} from "./helpers";

export const hurricaneRules: Rule[] = [
  {
    id: "hurricane.official_warning",
    evaluate(ctx) {
      const official = officialHazards(ctx, [
        ...HURRICANE_KINDS,
        "wind",
        "storm_surge",
        "tornado",
      ]);
      if (official.length === 0) return null;
      return ruleMatch(this.id, {
        title: "Follow the official hurricane / wind warning now",
        body: "A warning or evacuation product is in effect. Leave if told to evacuate, move to your identified safe place, and do not wait for discretionary prep. Take IDs, medications, pets, and phones.",
        priority: "critical",
        category: "evacuate",
        hazardKinds: fallbackKinds(official, HURRICANE_KINDS),
        rationale:
          "Official NWS warning/emergency/evacuation outranks discretionary preparedness.",
        horizon: "now",
        official: true,
        costClass: "zero",
      });
    },
  },
  {
    id: "hurricane.watch_kit",
    evaluate(ctx) {
      if (hasOfficialWarning(ctx, [...HURRICANE_KINDS, "wind"])) return null;
      const watches = ctx.hazards.hazards.filter(
        (hazard) =>
          (HURRICANE_KINDS as readonly string[]).includes(hazard.kind) &&
          (hazard.severity === "watch" || hazard.severity === "advisory"),
      );
      if (watches.length === 0) return null;
      return ruleMatch(this.id, {
        title: "Finish a hurricane go-kit before the watch expires",
        body: "Charge devices, set aside water and ready-to-eat food, fuel the vehicle if you have one, and stage documents by the door. A watch is not an all-clear.",
        priority: "high",
        category: "supplies",
        hazardKinds: kindsFrom(watches),
        rationale: "Active hurricane/tropical storm watch or advisory.",
        horizon: "now",
        official: false,
        costClass: "low",
      });
    },
  },
  {
    id: "hurricane.manufactured_wind",
    evaluate(ctx) {
      if (!isManufactured(ctx.home)) return null;
      const wind = ctx.hazards.hazards.filter((hazard) =>
        (WIND_KINDS as readonly string[]).includes(hazard.kind),
      );
      if (wind.length === 0 && !isAllClear(ctx)) return null;

      const official = wind.some(isOfficialProduct);
      if (official) {
        return ruleMatch(this.id, {
          title: "Leave the manufactured or mobile home — it is not a wind shelter",
          body: "An official wind or tropical warning is active. Manufactured and mobile homes fail in high wind. Go now to a sturdier building or public shelter. Do not stay to 'ride it out'.",
          priority: "critical",
          category: "evacuate",
          hazardKinds: fallbackKinds(wind, WIND_KINDS),
          rationale:
            "Manufactured/mobile dwelling plus official wind/tropical warning.",
          horizon: "now",
          official: true,
          costClass: "zero",
        });
      }

      if (wind.length > 0) {
        return ruleMatch(this.id, {
          title: "Plan to leave a manufactured home before damaging wind arrives",
          body: "Identify a sturdier place to stay and the time you will leave. Manufactured and mobile homes are not rated for hurricane or severe wind.",
          priority: "high",
          category: "evacuate",
          hazardKinds: kindsFrom(wind),
          rationale: "Manufactured/mobile dwelling plus active wind-family hazard.",
          horizon: "now",
          official: false,
          costClass: "zero",
        });
      }

      if (isAllClear(ctx) && inHurricaneRegion(ctx.home)) {
        return ruleMatch(this.id, {
          title: "Pre-identify a sturdy place to go when wind is forecast",
          body: "Because this is a manufactured or mobile home, choose a friend, hotel, or public shelter now — before the next tropical event. Do not plan to shelter in the home.",
          priority: "high",
          category: "evacuate",
          hazardKinds: ["hurricane", "wind"],
          rationale:
            "Hurricane-region manufactured home; all-clear is not a reason to skip this plan.",
          horizon: "before_next_event",
          official: false,
          costClass: "zero",
        });
      }

      return null;
    },
  },
  {
    id: "hurricane.old_roof",
    evaluate(ctx) {
      if (!isOlderRoof(ctx.home.roofAgeYears)) return null;
      const wind = ctx.hazards.hazards.filter((hazard) =>
        (WIND_KINDS as readonly string[]).includes(hazard.kind),
      );
      const activeWind = wind.length > 0;
      if (!activeWind && !(isAllClear(ctx) && inHurricaneRegion(ctx.home))) {
        return null;
      }
      if (activeWind) {
        return ruleMatch(this.id, {
          title: "Treat the aging roof as a wind failure point",
          body: "A roof this old is more likely to lose covering in tropical or severe wind. Move to an interior room away from the attic, gather buckets and plastic sheeting, and photograph the roof only if it is still safe to do so.",
          priority: "high",
          category: "shelter",
          hazardKinds: fallbackKinds(wind, WIND_KINDS),
          rationale: `Known roof age ${ctx.home.roofAgeYears} years is in the older-roof class.`,
          horizon: "now",
          official: false,
          costClass: "zero",
        });
      }
      return ruleMatch(this.id, {
        title: "Schedule a roof check before the next tropical event",
        body: "This roof is in the older-age class. Have it inspected and fasten loose covering when you can. Until then, keep a no-cost indoor shelter plan. Do not assume an old roof will hold.",
        priority: "medium",
        category: "other",
        hazardKinds: ["hurricane", "wind"],
        rationale: `Known roof age ${ctx.home.roofAgeYears} years; quiet weather is the time to act.`,
        horizon: "before_next_event",
        official: false,
        costClass: "moderate",
      });
    },
  },
  {
    id: "hurricane.unknown_roof",
    evaluate(ctx) {
      if (!isUnknownRoof(ctx.home.roofAgeYears)) return null;
      const wind = ctx.hazards.hazards.filter((hazard) =>
        (WIND_KINDS as readonly string[]).includes(hazard.kind),
      );
      const activeWind = wind.length > 0;
      if (!activeWind && !(isAllClear(ctx) && inHurricaneRegion(ctx.home))) {
        return null;
      }
      if (activeWind) {
        return ruleMatch(this.id, {
          title: "Unknown roof age — do not assume the roof is fine",
          body: "Roof age was never confirmed, so this plan treats the roof as a possible weak point. Stay out of rooms under the roof deck if wind becomes severe, and document the roof from the ground when it is safe. Unknown is not 'no problem'.",
          priority: "high",
          category: "shelter",
          hazardKinds: fallbackKinds(wind, WIND_KINDS),
          rationale: "Roof age is unknown; unknown is not scored as a sound roof.",
          horizon: "now",
          official: false,
          costClass: "zero",
        });
      }
      return ruleMatch(this.id, {
        title: "Confirm roof age and condition before hurricane season next peaks",
        body: "The roof age is unanswered. Find out how old it is, look for missing shingles from the ground, and write the answer into the household profile. Do not treat a blank roof field as a new or safe roof.",
        priority: "medium",
        category: "other",
        hazardKinds: ["hurricane", "wind"],
        rationale: "Unknown roof age during quiet weather in a hurricane region.",
        horizon: "before_next_event",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "hurricane.no_shutters",
    evaluate(ctx) {
      if (!knownFalse(ctx.home.hasHurricaneShutters)) return null;
      const tropical = hasKind(ctx, [...HURRICANE_KINDS, "wind"]);
      if (!tropical && !(isAllClear(ctx) && inHurricaneRegion(ctx.home))) {
        return null;
      }
      return ruleMatch(this.id, {
        title: "Protect windows — this home has no hurricane shutters",
        body: tropical
          ? "Cover or stay away from glass. Use existing plywood, storm panels, or an interior room. Buying a full shutter system is a later, higher-cost step — it is not required to act now."
          : "This home has no shutters. Before the next tropical event, stage plywood or inexpensive panels if the budget class allows, or plan to shelter in an interior room with no glass.",
        priority: tropical ? "high" : "medium",
        category: "shelter",
        hazardKinds: tropical ? ["hurricane", "wind"] : ["hurricane"],
        rationale: "hasHurricaneShutters is confirmed false.",
        horizon: tropical ? "now" : "before_next_event",
        official: false,
        costClass: tropical ? "zero" : "low",
      });
    },
  },
  {
    id: "hurricane.unknown_shutters",
    evaluate(ctx) {
      if (!isUnknown(ctx.home.hasHurricaneShutters)) return null;
      const tropical = hasKind(ctx, [...HURRICANE_KINDS, "wind"]);
      if (!tropical && !(isAllClear(ctx) && inHurricaneRegion(ctx.home))) {
        return null;
      }
      return ruleMatch(this.id, {
        title: "Confirm whether openings have wind protection",
        body: "Shutter coverage is unanswered, so this plan does not assume the windows are protected. Walk the home, note every glass opening, and cover what you can with materials you already have.",
        priority: tropical ? "high" : "low",
        category: "shelter",
        hazardKinds: ["hurricane", "wind"],
        rationale: "hasHurricaneShutters is unknown — unknown is not 'protected'.",
        horizon: tropical ? "now" : "before_next_event",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "hurricane.identify_safe_room",
    evaluate(ctx) {
      if (knownTrue(ctx.home.hasSafeInteriorRoom)) return null;
      const wind = hasKind(ctx, WIND_KINDS);
      if (!wind && !(isAllClear(ctx) && inHurricaneRegion(ctx.home))) {
        return null;
      }
      const unknown = isUnknown(ctx.home.hasSafeInteriorRoom);
      return ruleMatch(this.id, {
        title: unknown
          ? "Pick a small interior room — a safe room has not been confirmed"
          : "This home has no marked safe interior room — choose one now",
        body: "Use a closet, hallway, or bathroom with no or few windows, on the lowest floor that is not flooding. Stay there if wind becomes severe. Unknown or 'no' is not a reason to stay near glass.",
        priority: wind ? "high" : "medium",
        category: "shelter",
        hazardKinds: wind ? [...WIND_KINDS] : ["hurricane", "wind"],
        rationale: unknown
          ? "hasSafeInteriorRoom is unknown."
          : "hasSafeInteriorRoom is false.",
        horizon: wind ? "now" : "before_next_event",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "hurricane.apartment_wind",
    evaluate(ctx) {
      if (ctx.home.dwellingType !== "apartment") return null;
      const wind = hasKind(ctx, [...HURRICANE_KINDS, "wind", "tornado"]);
      if (!wind && !(isAllClear(ctx) && inHurricaneRegion(ctx.home))) {
        return null;
      }
      return ruleMatch(this.id, {
        title: "Follow the building plan; you cannot harden this structure alone",
        body: "Ask the manager where residents should go, bring balcony items inside, and use an interior hallway if wind becomes severe. Structural upgrades are not a renter no-cost option.",
        priority: wind ? "high" : "low",
        category: "shelter",
        hazardKinds: ["hurricane", "wind"],
        rationale: "Apartment dwelling type — limited structural control.",
        horizon: wind ? "now" : "before_next_event",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "hurricane.storm_surge",
    evaluate(ctx) {
      const surge = ctx.hazards.hazards.filter(
        (hazard) => hazard.kind === "storm_surge",
      );
      if (surge.length === 0) return null;
      const official = surge.some(isOfficialProduct);
      return ruleMatch(this.id, {
        title: official
          ? "Leave surge-prone ground — an official surge product is active"
          : "Move people, pets, and the car off the lowest ground",
        body: "Storm surge is not ordinary rain flooding. Get to higher ground or a sturdier inland building. Do not walk or drive through surge water.",
        priority: official ? "critical" : "high",
        category: official ? "evacuate" : "shelter",
        hazardKinds: ["storm_surge"],
        rationale: "Active storm_surge product on the hazard state.",
        horizon: "now",
        official,
        costClass: "zero",
      });
    },
  },
  {
    id: "flood.official_warning",
    evaluate(ctx) {
      const official = officialHazards(ctx, FLOOD_KINDS);
      if (official.length === 0) return null;
      return ruleMatch(this.id, {
        title: "Move to higher ground — official flood or flash-flood warning",
        body: "This is an official flood product, not a discretionary checklist. Get to higher ground now, avoid underpasses, and never drive into flood water. Take medications, IDs, and pets if you can do so without delay.",
        priority: "critical",
        category: "evacuate",
        hazardKinds: fallbackKinds(official, FLOOD_KINDS),
        rationale: "NWS flood, flash flood, or surge warning/emergency.",
        horizon: "now",
        official: true,
        costClass: "zero",
      });
    },
  },
  {
    id: "flood.move_valuables",
    evaluate(ctx) {
      if (hasOfficialWarning(ctx, FLOOD_KINDS)) return null;
      const floods = ctx.hazards.hazards.filter((hazard) =>
        (FLOOD_KINDS as readonly string[]).includes(hazard.kind),
      );
      if (floods.length === 0) return null;
      return ruleMatch(this.id, {
        title: "Move people and belongings off the lowest floor",
        body: "A flood watch or advisory is active. Lift electronics, documents, and chemicals onto counters or upper floors. Fill clean containers with tap water before pressure drops.",
        priority: "high",
        category: "supplies",
        hazardKinds: kindsFrom(floods),
        rationale: "Non-warning flood-family product.",
        horizon: "now",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "flood.basement",
    evaluate(ctx) {
      if (!knownTrue(ctx.home.hasBasement)) return null;
      if (!hasKind(ctx, FLOOD_KINDS)) return null;
      return ruleMatch(this.id, {
        title: "Get out of the basement and shut off power at the breaker if safe",
        body: "This home has a basement and a flood product is active. Do not wait in below-grade rooms. Move upstairs. Only flip the main breaker if you can reach it with dry hands and dry floors.",
        priority: "critical",
        category: "shelter",
        hazardKinds: [...FLOOD_KINDS],
        rationale: "Confirmed basement plus active flood-family hazard.",
        horizon: "now",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "flood.unknown_zone",
    evaluate(ctx) {
      if (!isUnknown(ctx.home.floodZone)) return null;
      const floodActive = hasKind(ctx, [...FLOOD_KINDS, ...HURRICANE_KINDS]);
      if (!floodActive && !(isAllClear(ctx) && inHurricaneRegion(ctx.home))) {
        return null;
      }
      return ruleMatch(this.id, {
        title: "Flood zone is unknown — do not assume the lot is dry",
        body: "Look up the FEMA/NWS flood zone for this address and write it on the profile. Until then, treat nearby canals, storm drains, and first-floor living as a risk. Unknown is not 'not in a flood zone'.",
        priority: floodActive ? "high" : "medium",
        category: "other",
        hazardKinds: floodActive ? [...FLOOD_KINDS] : ["flood", "hurricane"],
        rationale: "floodZone is unknown.",
        horizon: floodActive ? "now" : "before_next_event",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "household.pets_official",
    evaluate(ctx) {
      if (!hasPets(ctx.household) && !petsUnknown(ctx.household)) return null;
      const official = officialHazards(ctx);
      if (official.length === 0) return null;
      const unknown = petsUnknown(ctx.household);
      return ruleMatch(this.id, {
        title: unknown
          ? "Confirm pets before you leave — pet count is unanswered"
          : "Take pets with you; do not leave them for a 'quick' official warning",
        body: unknown
          ? "The profile does not say whether pets live here. Check rooms and carriers before you lock the door. Unknown is not 'no pets'."
          : "Bring carriers, leashes, food, and bowls. Confirm the destination accepts animals. Official warnings do not pause for a return trip.",
        priority: "critical",
        category: "pets",
        hazardKinds: fallbackKinds(official, ["other"]),
        rationale: unknown
          ? "Official product plus unknown petCount."
          : "Official product plus confirmed pets.",
        horizon: "now",
        official: true,
        costClass: "zero",
      });
    },
  },
  {
    id: "household.access_evac",
    evaluate(ctx) {
      const official = officialHazards(ctx);
      if (official.length === 0) return null;
      if (!needsAccessHelp(ctx.household) && !accessUnknown(ctx.household)) {
        return null;
      }
      const unknown = accessUnknown(ctx.household);
      return ruleMatch(this.id, {
        title: unknown
          ? "Confirm how this household will leave — evacuation ability is unknown"
          : "Request accessible transport — this household cannot assume a self-evac",
        body: unknown
          ? "Mobility and self-evacuation were never answered. Call a neighbor, building staff, or local emergency management now. Unknown is not 'we can leave on our own'."
          : "Do not wait for flood or fire to block the exit. Contact emergency management or a pre-arranged helper and say you need accessible evacuation help.",
        priority: "critical",
        category: "evacuate",
        hazardKinds: fallbackKinds(official, ["other"]),
        rationale: unknown
          ? "Official product plus unknown mobility / canSelfEvacuate."
          : "Official product plus mobility needs or cannot self-evacuate.",
        horizon: "now",
        official: true,
        costClass: "zero",
      });
    },
  },
  {
    id: "household.meds_go_bag",
    evaluate(ctx) {
      if (isAllClear(ctx)) {
        if (
          !knownTrue(ctx.household.hasPrescriptionMedications) &&
          !isUnknown(ctx.household.hasPrescriptionMedications)
        ) {
          return null;
        }
        return ruleMatch(this.id, {
          title: "Stage a medication pouch before the next warning",
          body: "Keep a few days of prescriptions, copies of the list, and charger cables in one bag. If medications are unanswered, find out now — unknown is not 'no meds'.",
          priority: "medium",
          category: "medical",
          hazardKinds: ["hurricane", "wildfire", "winter_storm"],
          rationale: "Quiet-weather medication staging; unknown meds stay in scope.",
          horizon: "before_next_event",
          official: false,
          costClass: "zero",
        });
      }
      if (ctx.hazards.hazards.length === 0) return null;
      if (
        knownFalse(ctx.household.hasPrescriptionMedications) &&
        knownFalse(ctx.household.hasPowerDependentMedicalDevice)
      ) {
        return null;
      }
      return ruleMatch(this.id, {
        title: "Put medications and device supplies in the bag you will actually grab",
        body: "Prescription status or a power-dependent device is not a confirmed no. Pack meds, charging cables, and the written list now so an official update does not strand them.",
        priority: "high",
        category: "medical",
        hazardKinds: kindsFrom(ctx.hazards.hazards),
        rationale: "Active hazards plus medications/device not confirmed absent.",
        horizon: "now",
        official: false,
        costClass: "zero",
      });
    },
  },
  {
    id: "household.power_outage_unknown",
    evaluate(ctx) {
      if (knownTrue(ctx.home.hasBackupPower)) return null;
      const outage = hasKind(ctx, OUTAGE_RISK_KINDS);
      if (!outage && !isAllClear(ctx)) return null;
      const unknown = isUnknown(ctx.home.hasBackupPower);
      return ruleMatch(this.id, {
        title: unknown
          ? "Plan for an outage — backup power is unconfirmed"
          : "This home has no backup power — use a no-cost outage plan",
        body: unknown
          ? "Do not assume a generator or battery is on site. Charge phones, fill some water containers, and pick a cooling/warming place you can reach. Unknown backup power is not 'we have a generator'."
          : "Charge phones from the wall while it still works, fill containers with water, and identify a library, cooling center, or neighbor with power. Skip buying a generator unless the budget class is flexible.",
        priority: outage ? "high" : "medium",
        category: "power",
        hazardKinds: outage ? [...OUTAGE_RISK_KINDS] : ["hurricane", "winter_storm"],
        rationale: unknown
          ? "hasBackupPower is unknown."
          : "hasBackupPower is false.",
        horizon: outage ? "now" : "before_next_event",
        official: false,
        costClass: "zero",
      });
    },
  },
];
