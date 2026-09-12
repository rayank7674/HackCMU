import type { StressScenario } from "./types";

export const STRESS_DISCLAIMER =
  "Simulated planning scenario. Not a forecast and not an official alert.";

function scenario(
  partial: Omit<StressScenario, "disclaimer">,
): StressScenario {
  return { ...partial, disclaimer: STRESS_DISCLAIMER };
}

export const BASELINE_SCENARIO = scenario({
  id: "baseline",
  label: "No extra stress",
  powerAvailability: 100,
  roadAccessibility: 100,
  transport: "unchanged",
  waterAvailability: 100,
  outageHours: null,
  hazardBoost: null,
});

export const STRESS_PRESETS: StressScenario[] = [
  scenario({
    id: "power-12h",
    label: "12-hour power outage",
    powerAvailability: 0,
    roadAccessibility: 100,
    transport: "unchanged",
    waterAvailability: 100,
    outageHours: 12,
    hazardBoost: null,
  }),
  scenario({
    id: "power-6h",
    label: "6-hour power outage",
    powerAvailability: 25,
    roadAccessibility: 100,
    transport: "unchanged",
    waterAvailability: 100,
    outageHours: 6,
    hazardBoost: null,
  }),
  scenario({
    id: "road-closure",
    label: "Major road closure",
    powerAvailability: 100,
    roadAccessibility: 50,
    transport: "unchanged",
    waterAvailability: 100,
    outageHours: null,
    hazardBoost: null,
  }),
  scenario({
    id: "no-transport",
    label: "Transportation unavailable",
    powerAvailability: 100,
    roadAccessibility: 100,
    transport: "none",
    waterAvailability: 100,
    outageHours: null,
    hazardBoost: null,
  }),
  scenario({
    id: "water",
    label: "Water disruption",
    powerAvailability: 100,
    roadAccessibility: 100,
    transport: "unchanged",
    waterAvailability: 0,
    outageHours: null,
    hazardBoost: null,
  }),
  scenario({
    id: "wind-power",
    label: "Severe wind + power outage",
    powerAvailability: 50,
    roadAccessibility: 75,
    transport: "unchanged",
    waterAvailability: 100,
    outageHours: 12,
    hazardBoost: "wind",
  }),
  scenario({
    id: "flood-road",
    label: "Flood + road closure",
    powerAvailability: 100,
    roadAccessibility: 50,
    transport: "limited",
    waterAvailability: 50,
    outageHours: null,
    hazardBoost: "flood",
  }),
  scenario({
    id: "winter-power",
    label: "Winter storm + power outage",
    powerAvailability: 0,
    roadAccessibility: 75,
    transport: "limited",
    waterAvailability: 100,
    outageHours: 12,
    hazardBoost: "winter",
  }),
  scenario({
    id: "tampa-demo",
    label: "Tampa demo (modeled, not live NWS)",
    powerAvailability: 50,
    roadAccessibility: 75,
    transport: "limited",
    waterAvailability: 100,
    outageHours: 12,
    hazardBoost: "wind",
  }),
];

export function presetById(id: string): StressScenario | undefined {
  return STRESS_PRESETS.find((item) => item.id === id);
}

export function customScenario(input: {
  powerAvailability: StressScenario["powerAvailability"];
  roadAccessibility: StressScenario["roadAccessibility"];
  transport: StressScenario["transport"];
  waterAvailability?: StressScenario["waterAvailability"];
  outageHours?: StressScenario["outageHours"];
}): StressScenario {
  return scenario({
    id: "custom",
    label: "Custom modeled scenario",
    powerAvailability: input.powerAvailability,
    roadAccessibility: input.roadAccessibility,
    transport: input.transport,
    waterAvailability: input.waterAvailability ?? 100,
    outageHours: input.outageHours ?? null,
    hazardBoost: null,
  });
}
