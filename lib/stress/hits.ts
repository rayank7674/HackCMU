import { seasonFromHome, type SeasonContext } from "@/lib/integrations/season";
import type { HomeProfile } from "@/types";
import { STRESS_PRESETS } from "./presets";
import type { StressScenario } from "./types";

export type HouseHit = "wind" | "water" | "freeze" | "power" | "tampa";

export const HOUSE_HITS: {
  id: HouseHit;
  label: string;
  body: string;
}[] = [
  {
    id: "wind",
    label: "Wind on this house",
    body: "Modeled wind on roof and openings - not a forecast.",
  },
  {
    id: "water",
    label: "Water at the lowest floor",
    body: "Modeled flood or water service stress on this dwelling.",
  },
  {
    id: "freeze",
    label: "Freeze / winter on this house",
    body: "Modeled pipe and heat stress. Hidden when winter is not in season unless you show all.",
  },
  {
    id: "power",
    label: "Power outage",
    body: "Starts at a modeled local supply - not a real utility map.",
  },
  {
    id: "tampa",
    label: "Tampa demo",
    body: "Fixture only. Not live NWS for your home.",
  },
];

const HIT_PRESET_IDS: Record<HouseHit, readonly string[]> = {
  wind: ["wind-power"],
  water: ["flood-road", "water"],
  freeze: ["winter-power"],
  power: ["power-12h", "power-6h"],
  tampa: ["tampa-demo"],
};

export function parseHouseHit(value: string | null | undefined): HouseHit | null {
  if (
    value === "wind" ||
    value === "water" ||
    value === "freeze" ||
    value === "power" ||
    value === "tampa"
  ) {
    return value;
  }
  return null;
}

export function hitFromRecommendation(ruleId: string | null | undefined): HouseHit {
  const id = (ruleId ?? "").toLowerCase();
  if (id.includes("roof") || id.includes("shutter") || id.includes("wind") || id.includes("hurricane")) {
    return "wind";
  }
  if (id.includes("flood") || id.includes("water")) return "water";
  if (id.includes("winter") || id.includes("freeze") || id.includes("pipe")) return "freeze";
  if (id.includes("power") || id.includes("outage") || id.includes("generator")) return "power";
  return "power";
}

export function presetsForHit(
  hit: HouseHit,
  presets: readonly StressScenario[] = STRESS_PRESETS,
): StressScenario[] {
  const ids = HIT_PRESET_IDS[hit];
  return presets.filter((item) => ids.includes(item.id));
}

export function hitIsInSeason(hit: HouseHit, season: SeasonContext): boolean {
  if (hit === "freeze") return season.kind === "winter";
  return true;
}

export function visibleHits(season: SeasonContext, showAll: boolean): HouseHit[] {
  return HOUSE_HITS.map((item) => item.id).filter(
    (hit) => showAll || hit === "tampa" || hitIsInSeason(hit, season),
  );
}

export function seasonForHome(home: HomeProfile | null | undefined): SeasonContext {
  return seasonFromHome(home ?? null);
}
