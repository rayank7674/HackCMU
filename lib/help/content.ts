/**
 * Official Help links and copy. Source labels stay on every outbound
 * resource. Financial wording is may-be-eligible only — never a promise.
 */

export type OfficialLink = {
  id: string;
  title: string;
  href: string;
  source: string;
  description: string;
};

export const HOW_STORMREADY_WORKS = [
  "You answer a few questions about this home and household. No account is required to finish a plan.",
  "Official alerts stay fail-closed: if a lookup is down you see unavailable — never an invented warning or all-clear. Optional Save My Plan stores a copy after you sign in.",
  "The Map tab is an approximate locator with official examples, not a live emergency GIS.",
] as const;

export const PREPAREDNESS_LINKS: OfficialLink[] = [
  {
    id: "ready-gov",
    title: "Ready.gov",
    href: "https://www.ready.gov/",
    source: "Ready.gov / U.S. Department of Homeland Security",
    description:
      "Build a kit, make a household plan, and learn how official alerts work.",
  },
  {
    id: "fema",
    title: "FEMA",
    href: "https://www.fema.gov/",
    source: "Federal Emergency Management Agency",
    description:
      "National emergency-management guidance, disaster updates, and recovery programs.",
  },
  {
    id: "weather-gov",
    title: "Weather.gov / National Weather Service",
    href: "https://www.weather.gov/",
    source: "National Weather Service",
    description:
      "Official forecasts, watches, and warnings. Use this over social media during a storm.",
  },
];

export const LOCAL_HELP_INTRO =
  "Numbers below come from the address on this device plus national official lines. StormReady will not invent a local office if your county is unknown.";

export const LOCAL_HELP_EXAMPLE_NOTE =
  "Florida and Tampa-area links appear only when this home is in Florida. They are examples, not an exhaustive list for every place.";

export const LOCAL_HELP_LINKS: OfficialLink[] = [
  {
    id: "211",
    title: "211",
    href: "https://www.211.org/",
    source: "United Way 211",
    description:
      "Find local health and human services, including disaster recovery help, by ZIP or phone.",
  },
  {
    id: "red-cross",
    title: "American Red Cross — Get Help",
    href: "https://www.redcross.org/get-help.html",
    source: "American Red Cross",
    description:
      "Shelter, family reconnect, and recovery resources. Confirm current openings on the official site.",
  },
  {
    id: "ready-alerts",
    title: "Find local alerts and emergency management",
    href: "https://www.ready.gov/alerts",
    source: "Ready.gov",
    description:
      "How to receive official alerts and where to look up your local emergency-management office.",
  },
];

/** Shown only when the saved home is in Florida / Tampa. Labeled examples. */
export const REGIONAL_EXAMPLE_LINKS: OfficialLink[] = [
  {
    id: "florida-dem",
    title: "Florida Division of Emergency Management",
    href: "https://www.floridadisaster.org/",
    source: "Florida Division of Emergency Management (example)",
    description:
      "State preparedness, shelter information, and disaster resources for Florida. Example for this address, not a national list.",
  },
  {
    id: "hillsborough-em",
    title: "Hillsborough County Emergency Management",
    href: "https://www.hillsboroughcounty.org/en/residents/public-safety/emergency-management",
    source: "Hillsborough County (Tampa-area example)",
    description:
      "County emergency-management office for this Tampa-area address. Search your own county if you live elsewhere.",
  },
  {
    id: "211-tampa",
    title: "211 Tampa Bay",
    href: "https://www.211tampabay.org/",
    source: "211 Tampa Bay Cares (example)",
    description:
      "Local 211 for the Tampa Bay area. Use 211.org to find the service that covers another ZIP.",
  },
];

export const FINANCIAL_ASSISTANCE_INTRO =
  "After a federally declared disaster, households may be eligible for assistance. StormReady cannot determine eligibility and never promises that you will qualify. Apply only on official government sites.";

export const FINANCIAL_LINKS: OfficialLink[] = [
  {
    id: "disaster-assistance",
    title: "DisasterAssistance.gov",
    href: "https://www.disasterassistance.gov/",
    source: "FEMA / DisasterAssistance.gov",
    description:
      "The official place to start an application for federal disaster assistance if a declaration covers your area.",
  },
  {
    id: "fema-individual",
    title: "FEMA Individual Assistance",
    href: "https://www.fema.gov/assistance/individual",
    source: "Federal Emergency Management Agency",
    description:
      "Explains what Individual Assistance can cover. Review the official page — eligibility is decided by FEMA, not this app.",
  },
  {
    id: "sba-disaster",
    title: "SBA disaster assistance",
    href: "https://www.sba.gov/funding-programs/disaster-assistance",
    source: "U.S. Small Business Administration",
    description:
      "Disaster loans that households and small businesses may be eligible for after a declaration. Apply on the SBA site only.",
  },
];

export const SAFETY_DISCLAIMER =
  "StormReady is not a substitute for official orders. If emergency management, law enforcement, or the National Weather Service tells you to evacuate or shelter, follow those instructions over anything in this app.";

export const DATA_AND_TRUST = [
  "StormReady does not invent alerts or local phone books. An empty list is not an all-clear unless an official check says so.",
  "Home and household details stay in this browser until you choose Save My Plan.",
] as const;

export const FORBIDDEN_HELP_PROMISES = [
  "you are eligible",
  "you qualify",
  "guaranteed assistance",
  "approved for aid",
] as const;
