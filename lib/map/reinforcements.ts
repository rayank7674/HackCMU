import { isKnown, type HomeProfile } from "@/lib/stormready";
import { isOlderRoof } from "@/lib/rules/helpers";
import {
  distanceKm,
  knownCoordinates,
  type LatLon,
} from "@/lib/map/location";

export type ReinforcementNeed = {
  id: "roof" | "windows" | "older_house";
  label: string;
  search: string;
};

export type ReinforcementPlace = {
  id: string;
  name: string;
  kind: string;
  address: string;
  rating: number;
  reviewCount: number;
  mapsHref: string;
  sells: string;
  latitude: number;
  longitude: number;
  /** Public listing snapshot - not a FaultLine score or endorsement. */
  example: true;
};

export type ReinforcementGuide = {
  needs: ReinforcementNeed[];
  places: ReinforcementPlace[];
  areaLabel: string | null;
  searchHref: string;
};

/** Oakland / CMU - use this in onboarding to see the nearby list. */
export const REINFORCEMENT_DEMO_ADDRESS = {
  addressLine: "5000 Forbes Avenue",
  city: "Pittsburgh",
  state: "PA",
  postalCode: "15213",
  yearBuilt: 1924,
  roofAgeYears: 28,
  hasHurricaneShutters: false,
} as const;

const PITTSBURGH_CENTER: LatLon = { latitude: 40.4443, longitude: -79.9532 };

const PITTSBURGH_PLACES: ReinforcementPlace[] = [
  {
    id: "homedepot-homestead",
    name: "The Home Depot",
    kind: "Home improvement",
    address: "600 Waterfront Dr E, Homestead, PA 15120",
    rating: 4.2,
    reviewCount: 4200,
    mapsHref: "https://www.google.com/maps/search/?api=1&query=Home+Depot+Homestead+PA",
    sells: "Plywood, roofing underlayment, fasteners, and storm-window kits",
    latitude: 40.4116,
    longitude: -79.9153,
    example: true,
  },
  {
    id: "lowes-homestead",
    name: "Lowe's Home Improvement",
    kind: "Home improvement",
    address: "200 Waterfront Dr E, Homestead, PA 15120",
    rating: 4.3,
    reviewCount: 3100,
    mapsHref: "https://www.google.com/maps/search/?api=1&query=Lowes+Homestead+PA",
    sells: "Shingles, flashing, and window well / opening covers",
    latitude: 40.4098,
    longitude: -79.9181,
    example: true,
  },
  {
    id: "84lumber-lawrenceville",
    name: "84 Lumber",
    kind: "Building supply",
    address: "15 26th St, Pittsburgh, PA 15222",
    rating: 4.1,
    reviewCount: 280,
    mapsHref: "https://www.google.com/maps/search/?api=1&query=84+Lumber+Pittsburgh+26th",
    sells: "Dimensional lumber and sheathing for roof and opening work",
    latitude: 40.4568,
    longitude: -79.9786,
    example: true,
  },
];

const TAMPA_PLACES: ReinforcementPlace[] = [
  {
    id: "homedepot-tampa-s",
    name: "The Home Depot",
    kind: "Home improvement",
    address: "1810 N Dale Mabry Hwy, Tampa, FL 33607",
    rating: 4.1,
    reviewCount: 3800,
    mapsHref: "https://www.google.com/maps/search/?api=1&query=Home+Depot+Dale+Mabry+Tampa",
    sells: "Plywood, roofing, and shutter hardware",
    latitude: 27.9608,
    longitude: -82.506,
    example: true,
  },
  {
    id: "lowes-tampa",
    name: "Lowe's Home Improvement",
    kind: "Home improvement",
    address: "2700 Gandy Blvd, Tampa, FL 33611",
    rating: 4.2,
    reviewCount: 2600,
    mapsHref: "https://www.google.com/maps/search/?api=1&query=Lowes+Gandy+Tampa",
    sells: "Shingles, flashing, and window protection kits",
    latitude: 27.8934,
    longitude: -82.4935,
    example: true,
  },
];

export function reinforcementNeeds(home: HomeProfile | null): ReinforcementNeed[] {
  if (!home) return [];
  const needs: ReinforcementNeed[] = [];
  const oldRoof = isOlderRoof(home.roofAgeYears);
  const oldHouse = isKnown(home.yearBuilt) && home.yearBuilt <= 1980;

  if (oldRoof) {
    needs.push({
      id: "roof",
      label: "Roof covering or flashing",
      search: "roofing supplies",
    });
  }
  if (home.hasHurricaneShutters === false) {
    needs.push({
      id: "windows",
      label: "Window reinforcement",
      search: "storm windows plywood shutters",
    });
  }
  if (oldHouse && !oldRoof) {
    needs.push({
      id: "older_house",
      label: "Older-house openings and roof check",
      search: "home improvement plywood roofing",
    });
  }
  return needs;
}

export function mapsSearchHref(home: HomeProfile | null, query: string): string {
  const bits = [query];
  if (home && isKnown(home.city)) bits.push(home.city);
  if (home && isKnown(home.state)) bits.push(home.state);
  if (home && isKnown(home.postalCode)) bits.push(home.postalCode);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bits.join(" "))}`;
}

export function reinforcementGuide(home: HomeProfile | null): ReinforcementGuide {
  const needs = reinforcementNeeds(home);
  const query = needs.map((need) => need.search).join(" ") || "home improvement";
  const here = knownCoordinates(home?.location ?? null);
  const postal = home && isKnown(home.postalCode) ? home.postalCode : "";
  const city = home && isKnown(home.city) ? home.city.toLowerCase() : "";
  const state = home && isKnown(home.state) ? home.state.toUpperCase() : "";

  const inPittsburgh =
    postal.startsWith("152") ||
    ((city.includes("pittsburgh") || city.includes("oakland")) && state === "PA") ||
    (here !== null && distanceKm(here, PITTSBURGH_CENTER) <= 25);

  const inTampa =
    postal.startsWith("336") ||
    (city.includes("tampa") && state === "FL") ||
    (here !== null && distanceKm(here, { latitude: 27.9506, longitude: -82.4572 }) <= 40);

  let places: ReinforcementPlace[] = [];
  let areaLabel: string | null = null;
  if (inPittsburgh) {
    places = PITTSBURGH_PLACES;
    areaLabel = "Near Oakland / Pittsburgh";
  } else if (inTampa) {
    places = TAMPA_PLACES;
    areaLabel = "Near Tampa";
  }

  return {
    needs,
    places,
    areaLabel,
    searchHref: mapsSearchHref(home, query),
  };
}

export function milesFromHome(
  home: HomeProfile | null,
  place: ReinforcementPlace,
): number | null {
  const here = knownCoordinates(home?.location ?? null);
  if (!here) return null;
  return distanceKm(here, place) * 0.621371;
}
