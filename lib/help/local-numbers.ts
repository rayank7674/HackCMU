/**
 * Official published help numbers for the saved home address.
 * Fail closed: if state/county is unknown or not in this table, we do not
 * invent a local office or a phone number.
 */

import { normalizeState } from "@/lib/integrations/season";
import { isKnown, type HomeProfile, type Unknownable } from "@/lib/stormready";
import {
  REGIONAL_EXAMPLE_LINKS,
  type OfficialLink,
} from "@/lib/help/content";

export type LocalNumberScope = "national" | "state" | "county";

export type LocalNumber = {
  id: string;
  label: string;
  /** Digits only for tel: links. Null when we only have a website. */
  tel: string | null;
  display: string;
  href: string | null;
  source: string;
  note: string;
  scope: LocalNumberScope;
};

type StateHelp = {
  name: string;
  emLabel: string;
  emPhone: string | null;
  emHref: string;
  twoOneOneHref: string | null;
};

type CountyHelp = {
  state: string;
  county: string;
  label: string;
  phone: string | null;
  href: string;
  source: string;
};

const NATIONAL_NUMBERS: LocalNumber[] = [
  {
    id: "911",
    label: "Emergency",
    tel: "911",
    display: "911",
    href: "tel:911",
    source: "National emergency number",
    note: "Police, fire, or medical emergency. Use this over the app.",
    scope: "national",
  },
  {
    id: "211",
    label: "211 local help",
    tel: "211",
    display: "211",
    href: "https://www.211.org/",
    source: "United Way 211",
    note: "Health, shelter referrals, and disaster recovery help for your ZIP.",
    scope: "national",
  },
  {
    id: "311",
    label: "311 non-emergency city services",
    tel: "311",
    display: "311",
    href: "tel:311",
    source: "Local government (where offered)",
    note: "Only in cities that run 311. If it does not connect, use the county or city website.",
    scope: "national",
  },
  {
    id: "poison",
    label: "Poison Control",
    tel: "18002221222",
    display: "1-800-222-1222",
    href: "tel:18002221222",
    source: "America's Poison Centers",
    note: "National poison-help line. Official, 24/7.",
    scope: "national",
  },
  {
    id: "fema-helpline",
    label: "FEMA helpline",
    tel: "18006213362",
    display: "1-800-621-3362",
    href: "https://www.disasterassistance.gov/",
    source: "Federal Emergency Management Agency",
    note: "Disaster assistance questions. Eligibility is decided by FEMA, not this app.",
    scope: "national",
  },
  {
    id: "red-cross-phone",
    label: "American Red Cross",
    tel: "18007332767",
    display: "1-800-733-2767",
    href: "https://www.redcross.org/get-help.html",
    source: "American Red Cross",
    note: "Shelter, reconnect, and recovery. Confirm current openings on the official site.",
    scope: "national",
  },
];

/** Official state emergency-management offices. Phones are published agency lines. */
const STATE_HELP: Record<string, StateHelp> = {
  AL: {
    name: "Alabama",
    emLabel: "Alabama Emergency Management Agency",
    emPhone: "2052802200",
    emHref: "https://ema.alabama.gov/",
    twoOneOneHref: "https://www.211.org/",
  },
  AK: {
    name: "Alaska",
    emLabel: "Alaska Division of Homeland Security and Emergency Management",
    emPhone: "9074287000",
    emHref: "https://ready.alaska.gov/",
    twoOneOneHref: "https://www.alaska211.org/",
  },
  AZ: {
    name: "Arizona",
    emLabel: "Arizona Department of Emergency and Military Affairs",
    emPhone: "6022440504",
    emHref: "https://dema.az.gov/",
    twoOneOneHref: "https://211arizona.org/",
  },
  AR: {
    name: "Arkansas",
    emLabel: "Arkansas Division of Emergency Management",
    emPhone: "5016836700",
    emHref: "https://www.dps.arkansas.gov/emergency-management/adem/",
    twoOneOneHref: "https://www.211.org/",
  },
  CA: {
    name: "California",
    emLabel: "California Governor's Office of Emergency Services",
    emPhone: "9168458510",
    emHref: "https://www.caloes.ca.gov/",
    twoOneOneHref: "https://www.211ca.org/",
  },
  CO: {
    name: "Colorado",
    emLabel: "Colorado Division of Homeland Security and Emergency Management",
    emPhone: "7208526600",
    emHref: "https://dhsem.colorado.gov/",
    twoOneOneHref: "https://www.211colorado.org/",
  },
  CT: {
    name: "Connecticut",
    emLabel: "Connecticut Division of Emergency Management and Homeland Security",
    emPhone: "8602560800",
    emHref: "https://portal.ct.gov/demhs",
    twoOneOneHref: "https://www.211ct.org/",
  },
  DE: {
    name: "Delaware",
    emLabel: "Delaware Emergency Management Agency",
    emPhone: "3026593362",
    emHref: "https://dema.delaware.gov/",
    twoOneOneHref: "https://www.delaware211.org/",
  },
  DC: {
    name: "District of Columbia",
    emLabel: "DC Homeland Security and Emergency Management Agency",
    emPhone: "2027276161",
    emHref: "https://hsema.dc.gov/",
    twoOneOneHref: "https://www.211.org/",
  },
  FL: {
    name: "Florida",
    emLabel: "Florida Division of Emergency Management",
    emPhone: "8508154000",
    emHref: "https://www.floridadisaster.org/",
    twoOneOneHref: "https://www.211.org/",
  },
  GA: {
    name: "Georgia",
    emLabel: "Georgia Emergency Management and Homeland Security",
    emPhone: "8008794362",
    emHref: "https://gema.georgia.gov/",
    twoOneOneHref: "https://www.unitedwayatlanta.org/2-1-1/",
  },
  HI: {
    name: "Hawaii",
    emLabel: "Hawaii Emergency Management Agency",
    emPhone: "8087334300",
    emHref: "https://dod.hawaii.gov/hiema/",
    twoOneOneHref: "https://www.auw.org/211",
  },
  ID: {
    name: "Idaho",
    emLabel: "Idaho Office of Emergency Management",
    emPhone: "2082586500",
    emHref: "https://ioem.idaho.gov/",
    twoOneOneHref: "https://www.idahocareline.org/",
  },
  IL: {
    name: "Illinois",
    emLabel: "Illinois Emergency Management Agency",
    emPhone: "2177827860",
    emHref: "https://iema.illinois.gov/",
    twoOneOneHref: "https://www.211illinois.org/",
  },
  IN: {
    name: "Indiana",
    emLabel: "Indiana Department of Homeland Security",
    emPhone: "8006697362",
    emHref: "https://www.in.gov/dhs/",
    twoOneOneHref: "https://in211.communityos.org/",
  },
  IA: {
    name: "Iowa",
    emLabel: "Iowa Homeland Security and Emergency Management",
    emPhone: "5157253231",
    emHref: "https://homelandsecurity.iowa.gov/",
    twoOneOneHref: "https://www.211iowa.org/",
  },
  KS: {
    name: "Kansas",
    emLabel: "Kansas Division of Emergency Management",
    emPhone: "7852741409",
    emHref: "https://www.kansastag.gov/KDEM.asp",
    twoOneOneHref: "https://www.211.org/",
  },
  KY: {
    name: "Kentucky",
    emLabel: "Kentucky Emergency Management",
    emPhone: "8002552587",
    emHref: "https://kyem.ky.gov/",
    twoOneOneHref: "https://www.211.org/",
  },
  LA: {
    name: "Louisiana",
    emLabel: "Louisiana Governor's Office of Homeland Security and Emergency Preparedness",
    emPhone: "2259257500",
    emHref: "https://gohsep.la.gov/",
    twoOneOneHref: "https://www.louisiana211.org/",
  },
  ME: {
    name: "Maine",
    emLabel: "Maine Emergency Management Agency",
    emPhone: "8004528735",
    emHref: "https://www.maine.gov/mema/",
    twoOneOneHref: "https://www.211maine.org/",
  },
  MD: {
    name: "Maryland",
    emLabel: "Maryland Emergency Management Agency",
    emPhone: "8776362872",
    emHref: "https://mdem.maryland.gov/",
    twoOneOneHref: "https://211md.org/",
  },
  MA: {
    name: "Massachusetts",
    emLabel: "Massachusetts Emergency Management Agency",
    emPhone: "5088202000",
    emHref: "https://www.mass.gov/orgs/massachusetts-emergency-management-agency",
    twoOneOneHref: "https://www.mass211.org/",
  },
  MI: {
    name: "Michigan",
    emLabel: "Michigan Emergency Management and Homeland Security Division",
    emPhone: "5172843660",
    emHref: "https://www.michigan.gov/mine",
    twoOneOneHref: "https://www.mi211.org/",
  },
  MN: {
    name: "Minnesota",
    emLabel: "Minnesota Homeland Security and Emergency Management",
    emPhone: "8004220798",
    emHref: "https://dps.mn.gov/divisions/hsem",
    twoOneOneHref: "https://www.211unitedway.org/",
  },
  MS: {
    name: "Mississippi",
    emLabel: "Mississippi Emergency Management Agency",
    emPhone: "6019336362",
    emHref: "https://www.msema.org/",
    twoOneOneHref: "https://www.211ms.org/",
  },
  MO: {
    name: "Missouri",
    emLabel: "Missouri State Emergency Management Agency",
    emPhone: "5735269100",
    emHref: "https://sema.dps.mo.gov/",
    twoOneOneHref: "https://www.211.org/",
  },
  MT: {
    name: "Montana",
    emLabel: "Montana Disaster and Emergency Services",
    emPhone: "4063244777",
    emHref: "https://des.mt.gov/",
    twoOneOneHref: "https://www.montana211.org/",
  },
  NE: {
    name: "Nebraska",
    emLabel: "Nebraska Emergency Management Agency",
    emPhone: "4024717421",
    emHref: "https://nema.nebraska.gov/",
    twoOneOneHref: "https://www.ne211.org/",
  },
  NV: {
    name: "Nevada",
    emLabel: "Nevada Division of Emergency Management",
    emPhone: "7756870300",
    emHref: "https://dem.nv.gov/",
    twoOneOneHref: "https://www.nevada211.org/",
  },
  NH: {
    name: "New Hampshire",
    emLabel: "New Hampshire Homeland Security and Emergency Management",
    emPhone: "8008523792",
    emHref: "https://www.nh.gov/safety/divisions/hsem/",
    twoOneOneHref: "https://www.211nh.org/",
  },
  NJ: {
    name: "New Jersey",
    emLabel: "New Jersey Office of Emergency Management",
    emPhone: "6099636900",
    emHref: "https://www.nj.gov/njoem/",
    twoOneOneHref: "https://www.nj211.org/",
  },
  NM: {
    name: "New Mexico",
    emLabel: "New Mexico Department of Homeland Security and Emergency Management",
    emPhone: "5054769600",
    emHref: "https://www.nmdhsem.org/",
    twoOneOneHref: "https://www.nm211.org/",
  },
  NY: {
    name: "New York",
    emLabel: "New York State Division of Homeland Security and Emergency Services",
    emPhone: "5182425000",
    emHref: "https://www.dhses.ny.gov/",
    twoOneOneHref: "https://www.211nys.org/",
  },
  NC: {
    name: "North Carolina",
    emLabel: "North Carolina Emergency Management",
    emPhone: "8008580368",
    emHref: "https://www.ncdps.gov/our-organization/emergency-management",
    twoOneOneHref: "https://www.nc211.org/",
  },
  ND: {
    name: "North Dakota",
    emLabel: "North Dakota Department of Emergency Services",
    emPhone: "7013288100",
    emHref: "https://www.des.nd.gov/",
    twoOneOneHref: "https://www.211.org/",
  },
  OH: {
    name: "Ohio",
    emLabel: "Ohio Emergency Management Agency",
    emPhone: "6148897150",
    emHref: "https://ema.ohio.gov/",
    twoOneOneHref: "https://www.ohio211.org/",
  },
  OK: {
    name: "Oklahoma",
    emLabel: "Oklahoma Department of Emergency Management",
    emPhone: "4055212481",
    emHref: "https://oklahoma.gov/oem.html",
    twoOneOneHref: "https://www.211oklahoma.org/",
  },
  OR: {
    name: "Oregon",
    emLabel: "Oregon Department of Emergency Management",
    emPhone: "5033782911",
    emHref: "https://www.oregon.gov/oem",
    twoOneOneHref: "https://www.211info.org/",
  },
  PA: {
    name: "Pennsylvania",
    emLabel: "Pennsylvania Emergency Management Agency",
    emPhone: "7176512001",
    emHref: "https://www.pema.pa.gov/",
    twoOneOneHref: "https://www.pa211.org/",
  },
  PR: {
    name: "Puerto Rico",
    emLabel: "Puerto Rico Emergency Management Bureau",
    emPhone: "7877240124",
    emHref: "https://www.manejodeemergencias.pr.gov/",
    twoOneOneHref: "https://www.211.org/",
  },
  RI: {
    name: "Rhode Island",
    emLabel: "Rhode Island Emergency Management Agency",
    emPhone: "4019469996",
    emHref: "https://riema.ri.gov/",
    twoOneOneHref: "https://www.211ri.org/",
  },
  SC: {
    name: "South Carolina",
    emLabel: "South Carolina Emergency Management Division",
    emPhone: "8037378500",
    emHref: "https://www.scemd.org/",
    twoOneOneHref: "https://sc211.org/",
  },
  SD: {
    name: "South Dakota",
    emLabel: "South Dakota Office of Emergency Management",
    emPhone: "6057733231",
    emHref: "https://dps.sd.gov/emergency-services/emergency-management",
    twoOneOneHref: "https://helplinecenter.org/2-1-1-resources/",
  },
  TN: {
    name: "Tennessee",
    emLabel: "Tennessee Emergency Management Agency",
    emPhone: "6157410001",
    emHref: "https://www.tn.gov/tema.html",
    twoOneOneHref: "https://www.211tn.org/",
  },
  TX: {
    name: "Texas",
    emLabel: "Texas Division of Emergency Management",
    emPhone: "5124242208",
    emHref: "https://tdem.texas.gov/",
    twoOneOneHref: "https://www.211texas.org/",
  },
  UT: {
    name: "Utah",
    emLabel: "Utah Division of Emergency Management",
    emPhone: "8015383400",
    emHref: "https://dem.utah.gov/",
    twoOneOneHref: "https://211utah.org/",
  },
  VT: {
    name: "Vermont",
    emLabel: "Vermont Emergency Management",
    emPhone: "8003470488",
    emHref: "https://vem.vermont.gov/",
    twoOneOneHref: "https://www.vermont211.org/",
  },
  VA: {
    name: "Virginia",
    emLabel: "Virginia Department of Emergency Management",
    emPhone: "8048976500",
    emHref: "https://www.vaemergency.gov/",
    twoOneOneHref: "https://www.211virginia.org/",
  },
  WA: {
    name: "Washington",
    emLabel: "Washington Emergency Management Division",
    emPhone: "8005626108",
    emHref: "https://mil.wa.gov/emergency-management-division",
    twoOneOneHref: "https://wa211.org/",
  },
  WV: {
    name: "West Virginia",
    emLabel: "West Virginia Emergency Management",
    emPhone: "3045585380",
    emHref: "https://dhsem.wv.gov/",
    twoOneOneHref: "https://www.wv211.org/",
  },
  WI: {
    name: "Wisconsin",
    emLabel: "Wisconsin Emergency Management",
    emPhone: "6082423232",
    emHref: "https://wem.wi.gov/",
    twoOneOneHref: "https://www.211wisconsin.org/",
  },
  WY: {
    name: "Wyoming",
    emLabel: "Wyoming Office of Homeland Security",
    emPhone: "3077774663",
    emHref: "https://hls.wyo.gov/",
    twoOneOneHref: "https://www.wyoming211.org/",
  },
};

/**
 * County offices we have an official published page (and phone) for.
 * Unknown county is not treated as a nearby county.
 */
const COUNTY_HELP: CountyHelp[] = [
  {
    state: "FL",
    county: "hillsborough",
    label: "Hillsborough County Emergency Management",
    phone: "8132726900",
    href: "https://www.hillsboroughcounty.org/en/residents/public-safety/emergency-management",
    source: "Hillsborough County",
  },
  {
    state: "FL",
    county: "pinellas",
    label: "Pinellas County Emergency Management",
    phone: "7274643800",
    href: "https://pinellas.gov/emergency-management/",
    source: "Pinellas County",
  },
  {
    state: "FL",
    county: "miami-dade",
    label: "Miami-Dade Emergency Management",
    phone: "3054685400",
    href: "https://www.miamidade.gov/global/emergency/home.page",
    source: "Miami-Dade County",
  },
  {
    state: "FL",
    county: "orange",
    label: "Orange County Emergency Management",
    phone: "4078369140",
    href: "https://www.orangecountyfl.net/EmergencySafety/EmergencyManagement.aspx",
    source: "Orange County, Florida",
  },
  {
    state: "NY",
    county: "new york",
    label: "NYC Emergency Management",
    phone: "311",
    href: "https://www.nyc.gov/site/em/index.page",
    source: "City of New York",
  },
  {
    state: "CA",
    county: "los angeles",
    label: "Los Angeles County Emergency Management",
    phone: "3239802260",
    href: "https://ceo.lacounty.gov/emergency-management/",
    source: "Los Angeles County",
  },
];

export function formatPhoneDisplay(digits: string): string {
  if (digits === "911" || digits === "211" || digits === "311" || digits === "988") {
    return digits;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

export function normalizeCountyName(
  county: Unknownable<string> | null | undefined,
): string | null {
  if (county == null || !isKnown(county)) return null;
  return county
    .toLowerCase()
    .replace(/\s+county$/i, "")
    .replace(/\s+parish$/i, "")
    .replace(/\s+borough$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type LocalHelpResolved = {
  placeKnown: boolean;
  state: string | null;
  county: string | null;
  zip: string | null;
  numbers: LocalNumber[];
  links: OfficialLink[];
  missingNote: string | null;
};

function nationalWithZip(zip: string | null): LocalNumber[] {
  return NATIONAL_NUMBERS.map((item) => {
    if (item.id !== "211" || !zip) return item;
    return {
      ...item,
      note: `Ask 211 for ZIP ${zip}. Health, shelter referrals, and disaster recovery help.`,
      href: "https://www.211.org/",
    };
  });
}

function stateNumbers(state: string): LocalNumber[] {
  const row = STATE_HELP[state];
  if (!row) return [];
  const numbers: LocalNumber[] = [
    {
      id: `state-em-${state}`,
      label: row.emLabel,
      tel: row.emPhone,
      display: row.emPhone ? formatPhoneDisplay(row.emPhone) : row.name,
      href: row.emPhone ? `tel:${row.emPhone}` : row.emHref,
      source: row.emLabel,
      note: `State emergency-management office for ${row.name}. Confirm current guidance on the official site.`,
      scope: "state",
    },
  ];
  if (row.twoOneOneHref) {
    numbers.push({
      id: `state-211-${state}`,
      label: `${row.name} 211`,
      tel: "211",
      display: "211",
      href: row.twoOneOneHref,
      source: `211 ${row.name}`,
      note: `Statewide 211 directory for ${row.name}. Dial 211 or open the official site.`,
      scope: "state",
    });
  }
  return numbers;
}

function countyNumber(state: string, county: string | null): LocalNumber | null {
  if (!county) return null;
  const match = COUNTY_HELP.find(
    (row) => row.state === state && row.county === county,
  );
  if (!match) return null;
  return {
    id: `county-em-${state}-${match.county}`,
    label: match.label,
    tel: match.phone,
    display: match.phone ? formatPhoneDisplay(match.phone) : match.label,
    href: match.phone ? `tel:${match.phone}` : match.href,
    source: match.source,
    note: "County emergency-management office from the saved address. Not a live dispatch line unless they say so.",
    scope: "county",
  };
}

function nwsOfficeNumber(home: HomeProfile | null): LocalNumber | null {
  const office =
    home && isKnown(home.location.nwsForecastOffice)
      ? home.location.nwsForecastOffice.trim().toUpperCase()
      : null;
  if (!office || office.length < 3) return null;
  const slug = office.toLowerCase();
  return {
    id: `nws-${slug}`,
    label: `NWS ${office} forecast office`,
    tel: null,
    display: `weather.gov/${slug}`,
    href: `https://www.weather.gov/${slug}`,
    source: "National Weather Service",
    note: "Official products for the forecast office attached to this address. Not a safety score.",
    scope: "state",
  };
}

export function regionalLinksForHome(home: HomeProfile | null): OfficialLink[] {
  const state = normalizeState(home?.state ?? null);
  if (state !== "FL") return [];
  const county = normalizeCountyName(home?.location.county ?? null);
  const city = isKnown(home?.city) ? home!.city.toLowerCase() : "";
  return REGIONAL_EXAMPLE_LINKS.filter((link) => {
    if (link.id === "florida-dem") return true;
    if (link.id === "hillsborough-em" || link.id === "211-tampa") {
      return county === "hillsborough" || city.includes("tampa");
    }
    return false;
  });
}

export function resolveLocalHelp(home: HomeProfile | null): LocalHelpResolved {
  const state = normalizeState(home?.state ?? null);
  const county = normalizeCountyName(home?.location.county ?? null);
  const zip = home && isKnown(home.postalCode) ? home.postalCode : null;
  const placeKnown = Boolean(
    state ||
      zip ||
      (home && isKnown(home.city)) ||
      (home && isKnown(home.addressLine)),
  );

  const numbers: LocalNumber[] = [...nationalWithZip(zip)];
  if (state) {
    numbers.push(...stateNumbers(state));
    const countyHit = countyNumber(state, county);
    if (countyHit) numbers.push(countyHit);
  }
  const nws = nwsOfficeNumber(home);
  if (nws) numbers.push(nws);

  const links = regionalLinksForHome(home);

  let missingNote: string | null = null;
  if (!placeKnown) {
    missingNote =
      "Add an address or ZIP in setup so StormReady can attach state and county numbers. National lines still work.";
  } else if (state && !STATE_HELP[state]) {
    missingNote =
      "This state is not in the published office table. StormReady will not invent a local number — use 211 or Ready.gov to find your emergency-management office.";
  } else if (state && !county) {
    missingNote =
      "County is unknown for this address. State and national numbers are shown. Unknown is not a nearby county.";
  } else if (state && county && !countyNumber(state, county)) {
    missingNote =
      `No published county line is stored for ${county} County. Use 211 or the state office — StormReady will not invent one.`;
  }

  return {
    placeKnown,
    state,
    county,
    zip,
    numbers,
    links,
    missingNote,
  };
}
