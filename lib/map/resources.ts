import { TAMPA_DEMO_CENTER, type LatLon } from "./location";

export type MapPinKind = "emergency_management" | "forecast_office" | "red_cross";

export type MapResourcePin = {
  id: string;
  title: string;
  kind: MapPinKind;
  latitude: number;
  longitude: number;
  source: string;
  description: string;
  href: string;
  /** Tampa demo examples - never labeled verified or best. */
  example: true;
};

export type MapLocatorLink = {
  id: string;
  title: string;
  href: string;
  source: string;
  description: string;
};

/**
 * Static Tampa-area example pins. Public offices only - not scraped
 * businesses, not “verified” contractors, not ranked shelters.
 */
export const TAMPA_RESOURCE_PINS: MapResourcePin[] = [
  {
    id: "nws-tbw",
    title: "NWS Tampa Bay Area",
    kind: "forecast_office",
    latitude: 27.7056,
    longitude: -82.4019,
    source: "National Weather Service (Weather.gov)",
    description:
      "Tampa Bay forecast office in Ruskin. Official forecasts and warnings for the demo area.",
    href: "https://www.weather.gov/tbw/",
    example: true,
  },
  {
    id: "hillsborough-em-office",
    title: "Hillsborough County Emergency Management",
    kind: "emergency_management",
    latitude: 27.9636,
    longitude: -82.3408,
    source: "Hillsborough County (example office)",
    description:
      "County emergency-management office for the Tampa demo. Confirm hours and services on the county site.",
    href: "https://www.hillsboroughcounty.org/en/residents/public-safety/emergency-management",
    example: true,
  },
  {
    id: "red-cross-tampa-chapter",
    title: "American Red Cross Tampa Bay chapter",
    kind: "red_cross",
    latitude: 27.9606,
    longitude: -82.5028,
    source: "American Red Cross (chapter office example)",
    description:
      "Chapter office example - not a live shelter list. Use the Red Cross site for current shelters.",
    href: "https://www.redcross.org/get-help.html",
    example: true,
  },
];

/** Official locators - links, not business rankings. */
export const MAP_LOCATOR_LINKS: MapLocatorLink[] = [
  {
    id: "find-shelters",
    title: "Find official shelters",
    href: "https://www.floridadisaster.org/planprepare/shelters/",
    source: "Florida Division of Emergency Management",
    description:
      "State shelter information for Florida. Confirm openings on the official site before you travel.",
  },
  {
    id: "ready-sheltering",
    title: "Sheltering guidance",
    href: "https://www.ready.gov/sheltering",
    source: "Ready.gov",
    description: "National guidance on when and how to shelter. Not a local facility list.",
  },
  {
    id: "nws-alerts",
    title: "National Weather Service alerts",
    href: "https://www.weather.gov/",
    source: "National Weather Service",
    description: "Official watches and warnings. FaultLine will not invent an all-clear.",
  },
  {
    id: "disaster-assistance-map",
    title: "Apply for disaster assistance",
    href: "https://www.disasterassistance.gov/",
    source: "DisasterAssistance.gov",
    description:
      "Households may be eligible after a federal declaration. Apply on the official site only.",
  },
];

export type MapTileProvider = "osm" | "mapbox";

export type MapTileLayer = {
  provider: MapTileProvider;
  url: string;
  attribution: string;
  tileSize?: number;
  zoomOffset?: number;
};

/**
 * Leaflet tiles. OpenStreetMap is the default so the map works with no
 * Mapbox token. Optional `NEXT_PUBLIC_MAPBOX_TOKEN` swaps in Mapbox tiles.
 */
export function getMapTileLayer(
  env: Record<string, string | undefined> = process.env,
): MapTileLayer {
  const token = env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? "";
  const style = env.NEXT_PUBLIC_MAPBOX_STYLE?.trim() || "mapbox/streets-v12";

  if (token) {
    return {
      provider: "mapbox",
      url: `https://api.mapbox.com/styles/v1/${style}/tiles/{z}/{x}/{y}?access_token=${token}`,
      attribution:
        '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      tileSize: 512,
      zoomOffset: -1,
    };
  }

  return {
    provider: "osm",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  };
}

export function pinsForView(showTampaExamplePins: boolean): MapResourcePin[] {
  return showTampaExamplePins ? TAMPA_RESOURCE_PINS : [];
}

export function pinLatLon(pin: MapResourcePin): LatLon {
  return { latitude: pin.latitude, longitude: pin.longitude };
}

export { TAMPA_DEMO_CENTER };

export const FORBIDDEN_MAP_LABELS = ["verified", "best contractor"] as const;
