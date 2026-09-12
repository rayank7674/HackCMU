import type { HomeProfile } from "@/lib/stormready";
import { isKnown } from "@/lib/stormready";

export type FuturePrepItem = {
  id: string;
  title: string;
  dueBy: string;
  why: string;
};

export type RegionalRisk = {
  id: string;
  label: string;
  summary: string;
  items: FuturePrepItem[];
};

const BY_STATE: Record<string, string[]> = {
  CA: ["earthquake", "wildfire"],
  OR: ["earthquake", "wildfire"],
  WA: ["earthquake", "wildfire"],
  AK: ["earthquake", "winter"],
  HI: ["hurricane", "tsunami"],
  FL: ["hurricane", "flood"],
  LA: ["hurricane", "flood"],
  TX: ["hurricane", "flood", "wildfire"],
  MS: ["hurricane", "flood"],
  AL: ["hurricane", "tornado"],
  GA: ["hurricane", "tornado"],
  SC: ["hurricane", "flood"],
  NC: ["hurricane", "flood"],
  VA: ["hurricane", "flood"],
  MD: ["flood", "winter"],
  DE: ["flood", "winter"],
  NJ: ["flood", "winter"],
  NY: ["flood", "winter"],
  PA: ["flood", "winter"],
  OH: ["flood", "tornado"],
  IN: ["flood", "tornado"],
  IL: ["flood", "tornado"],
  MO: ["flood", "tornado"],
  OK: ["tornado", "wildfire"],
  KS: ["tornado", "winter"],
  NE: ["tornado", "winter"],
  CO: ["wildfire", "winter"],
  AZ: ["wildfire", "extreme_heat"],
  NM: ["wildfire", "extreme_heat"],
  NV: ["wildfire", "earthquake"],
  UT: ["earthquake", "wildfire"],
  MT: ["wildfire", "winter"],
  ID: ["wildfire", "winter"],
  WY: ["wildfire", "winter"],
  ND: ["winter", "flood"],
  SD: ["winter", "flood"],
  MN: ["winter", "flood"],
  WI: ["winter", "flood"],
  MI: ["winter", "flood"],
  IA: ["flood", "tornado"],
  AR: ["flood", "tornado"],
  TN: ["flood", "tornado"],
  KY: ["flood", "tornado"],
  WV: ["flood", "winter"],
  CT: ["winter", "flood"],
  MA: ["winter", "flood"],
  RI: ["winter", "flood"],
  NH: ["winter", "flood"],
  VT: ["winter", "flood"],
  ME: ["winter", "flood"],
};

const RISK_COPY: Record<
  string,
  { label: string; summary: string; items: FuturePrepItem[] }
> = {
  earthquake: {
    label: "Earthquake",
    summary: "This area can shake with little warning.",
    items: [
      {
        id: "eq-secure",
        title: "Secure tall furniture and water heaters",
        dueBy: "This month",
        why: "Unsecured items tip in a quake and can block exits or start leaks.",
      },
      {
        id: "eq-kit",
        title: "Keep shoes, flashlight, and water by each bed",
        dueBy: "This week",
        why: "You may need to move in the dark over broken glass.",
      },
      {
        id: "eq-meetup",
        title: "Pick an outdoor meetup spot for your household",
        dueBy: "This month",
        why: "Phone service often fails after a quake.",
      },
    ],
  },
  wildfire: {
    label: "Wildfire",
    summary: "Dry seasons can bring fast-moving fire risk.",
    items: [
      {
        id: "wf-defensible",
        title: "Clear dry brush and leaves near the home",
        dueBy: "Before fire season",
        why: "A clear buffer slows fire spread to the structure.",
      },
      {
        id: "wf-go-bag",
        title: "Pack a go-bag with masks, meds, and documents",
        dueBy: "This month",
        why: "Evacuation orders can come with little notice.",
      },
      {
        id: "wf-alerts",
        title: "Turn on local wildfire and air-quality alerts",
        dueBy: "This week",
        why: "Smoke and fire lines can change hour by hour.",
      },
    ],
  },
  hurricane: {
    label: "Hurricane",
    summary: "Coastal storm seasons return every year.",
    items: [
      {
        id: "hu-zone",
        title: "Know your evacuation zone and route",
        dueBy: "Before storm season",
        why: "Waiting until a warning wastes the safest exit window.",
      },
      {
        id: "hu-shutters",
        title: "Check shutters, plywood, or window protection",
        dueBy: "Before storm season",
        why: "Flying debris is a top cause of home damage.",
      },
      {
        id: "hu-water",
        title: "Store drinking water and shelf-stable food for 3 days",
        dueBy: "This month",
        why: "Power and stores may be down after landfall.",
      },
    ],
  },
  flood: {
    label: "Flood",
    summary: "Heavy rain and rivers can flood this region.",
    items: [
      {
        id: "fl-elevate",
        title: "Keep valuables and chemicals off the lowest floor",
        dueBy: "This month",
        why: "Even a short inundation ruins documents and contaminates supplies.",
      },
      {
        id: "fl-drains",
        title: "Clear gutters and check sump or basement drains",
        dueBy: "This week",
        why: "Blocked drains turn a storm into an indoor flood.",
      },
      {
        id: "fl-insurance",
        title: "Review flood insurance and photo your rooms",
        dueBy: "This season",
        why: "Claims are faster when you have proof of what you owned.",
      },
    ],
  },
  tornado: {
    label: "Tornado",
    summary: "Severe storms here can spawn tornadoes.",
    items: [
      {
        id: "to-shelter",
        title: "Choose a sturdy interior shelter room",
        dueBy: "This week",
        why: "You may have only minutes once a warning is issued.",
      },
      {
        id: "to-alerts",
        title: "Enable Wireless Emergency Alerts on every phone",
        dueBy: "Today",
        why: "Sirens are not everywhere and weather can form after dark.",
      },
      {
        id: "to-helmet",
        title: "Keep helmets or thick blankets in the shelter spot",
        dueBy: "This month",
        why: "Head protection reduces injury from debris.",
      },
    ],
  },
  winter: {
    label: "Winter storm",
    summary: "Cold snaps and ice storms are common here.",
    items: [
      {
        id: "wi-heat",
        title: "Test space heaters safely and know shutoff valves",
        dueBy: "Before winter",
        why: "Outages and cold combine into a fast health risk.",
      },
      {
        id: "wi-car",
        title: "Stock the car with blanket, charger, and scraper",
        dueBy: "Before winter",
        why: "Travel delays on ice can last hours.",
      },
      {
        id: "wi-meds",
        title: "Refill critical meds before big storms",
        dueBy: "This season",
        why: "Pharmacies may close when roads ice over.",
      },
    ],
  },
  extreme_heat: {
    label: "Extreme heat",
    summary: "Dangerous heat waves hit this area in summer.",
    items: [
      {
        id: "ht-cool",
        title: "Identify a cool place if AC fails",
        dueBy: "Before summer",
        why: "Heat illness can rise within a day without cooling.",
      },
      {
        id: "ht-water",
        title: "Store extra water and check on neighbors",
        dueBy: "This month",
        why: "Dehydration hits seniors and pets first.",
      },
      {
        id: "ht-shade",
        title: "Add window shades or reflective film on sunny sides",
        dueBy: "Before summer",
        why: "Cutting indoor heat lowers risk when power is strained.",
      },
    ],
  },
  tsunami: {
    label: "Tsunami",
    summary: "Coastal quakes can drive tsunami risk.",
    items: [
      {
        id: "ts-route",
        title: "Learn your high-ground evacuation route",
        dueBy: "This month",
        why: "You may need to move on foot with little notice.",
      },
      {
        id: "ts-kit",
        title: "Keep a small go-bag near the door",
        dueBy: "This week",
        why: "Grab-and-go beats packing after the alert.",
      },
    ],
  },
};

const DEFAULT_RISKS = ["flood", "severe_storm"];

const SEVERE_STORM: RegionalRisk = {
  id: "severe_storm",
  label: "Severe storm",
  summary: "Strong wind and lightning can hit with little notice.",
  items: [
    {
      id: "ss-trees",
      title: "Trim weak branches away from the roof and lines",
      dueBy: "This season",
      why: "Falling limbs are a top cause of outages and roof damage.",
    },
    {
      id: "ss-kit",
      title: "Charge power banks and check flashlights",
      dueBy: "This week",
      why: "Outages often start after dark.",
    },
    {
      id: "ss-docs",
      title: "Photograph rooms and back up key documents",
      dueBy: "This month",
      why: "Proof of belongings speeds recovery after damage.",
    },
  ],
};

export function regionalRisksForHome(home: HomeProfile | null): RegionalRisk[] {
  const state =
    home && isKnown(home.state) ? home.state.trim().toUpperCase() : "";
  const keys = (state && BY_STATE[state] ? BY_STATE[state] : DEFAULT_RISKS).slice(
    0,
    2,
  );

  return keys.map((key) => {
    if (key === "severe_storm") return SEVERE_STORM;
    const copy = RISK_COPY[key];
    if (!copy) return SEVERE_STORM;
    return {
      id: key,
      label: copy.label,
      summary: copy.summary,
      items: copy.items,
    };
  });
}
