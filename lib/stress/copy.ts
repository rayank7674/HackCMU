import type { DisruptionLevel } from "./types";

/** Default demo CTA — 12-hour modeled power outage from STRESS_PRESETS. */
export const SIMPLE_POWER_OUTAGE_PRESET_ID = "power-12h";

export const STRESS_FLOW_COPY = "Prepare → Stress Test → see weakest link → fortify";

export const STRESS_HEADLINE = "What could go wrong?";
export const STRESS_WEAKEST_LINK = "Weakest link";
export const STRESS_NEXT_STEPS = "What to do next";

export const STRESS_RUN_POWER_OUTAGE = "Run a power outage";
export const STRESS_RUN_THIS_SCENARIO = "Run this scenario";
export const STRESS_UPDATE_PLAN = "Update your plan";
export const STRESS_SEE_ON_MAP = "See on map";
export const STRESS_SUGGEST_NEXT = "Suggest next steps";

export const STRESS_SCENE_DISCLAIMER =
  "Modeled household view — a simulated planning scene, not a prediction or official infrastructure twin.";

export const STRESS_WEBGL_FALLBACK =
  "3D view needs WebGL on this device. Showing the 2D dependency diagram instead.";

export const STRESS_ADVANCED_SUMMARY = "Advanced details";

export const STRESS_MIN_SEARCH_LABEL = "Smallest change that breaks things";
export const STRESS_WORST_SEARCH_LABEL = "Toughest modeled case";

const LEVEL_COPY: Record<
  DisruptionLevel,
  { short: string; sentence: string }
> = {
  none: {
    short: "Holding up",
    sentence: "Holding up in this model",
  },
  constrained: {
    short: "Strained",
    sentence: "Strained in this model",
  },
  major: {
    short: "Likely to fail",
    sentence: "Likely to fail in this model",
  },
  critical: {
    short: "Fails",
    sentence: "Fails in this model",
  },
};

export function friendlyDisruptionLabel(level: DisruptionLevel): string {
  return `${LEVEL_COPY[level].short} (modeled)`;
}

export function friendlyDisruptionSentence(level: DisruptionLevel): string {
  return `${LEVEL_COPY[level].sentence} — not a forecast.`;
}

export function shortSceneLabel(label: string): string {
  const known: Record<string, string> = {
    Home: "Home",
    "Grid power": "Power",
    "Water service": "Water",
    "Nearby road access": "Roads",
    "Household transportation": "Transport",
    "Household mobility": "Mobility",
    "Phones and information": "Phones",
    "Food and pharmacy access": "Food",
    "Healthcare access": "Care",
    "Staying in place": "Shelter",
    "Device charging": "Charging",
    "Building elevator": "Elevator",
    Roof: "Roof",
    "Windows and openings": "Openings",
    "Lowest floor": "Floor",
    Pipes: "Pipes",
    "Modeled local supply": "Supply",
  };
  if (known[label]) return known[label];
  return label.length <= 12 ? label : `${label.slice(0, 10)}…`;
}
