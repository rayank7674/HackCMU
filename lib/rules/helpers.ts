import {
  isKnown,
  isUnknown,
  type ActiveHazard,
  type HazardKind,
  type HomeProfile,
  type HouseholdProfile,
  type MobilityAid,
  type Unknownable,
} from "@/types";
import type { RuleContext } from "./types";

export const HURRICANE_KINDS = [
  "hurricane",
  "tropical_storm",
] as const satisfies readonly HazardKind[];

export const WIND_KINDS = [
  "hurricane",
  "tropical_storm",
  "wind",
  "tornado",
  "severe_thunderstorm",
  "storm_surge",
] as const satisfies readonly HazardKind[];

export const FLOOD_KINDS = [
  "flood",
  "flash_flood",
  "storm_surge",
] as const satisfies readonly HazardKind[];

export const WINTER_KINDS = [
  "winter_storm",
  "extreme_cold",
] as const satisfies readonly HazardKind[];

export const WILDFIRE_KINDS = ["wildfire"] as const satisfies readonly HazardKind[];

export const OUTAGE_RISK_KINDS = [
  ...HURRICANE_KINDS,
  ...WINTER_KINDS,
  "wind",
  "wildfire",
] as const satisfies readonly HazardKind[];

const HURRICANE_STATES = new Set([
  "FL",
  "TX",
  "LA",
  "MS",
  "AL",
  "GA",
  "SC",
  "NC",
  "VA",
  "MD",
  "DE",
  "NJ",
  "NY",
  "CT",
  "RI",
  "MA",
  "NH",
  "ME",
  "HI",
  "PR",
]);

const WILDFIRE_STATES = new Set([
  "CA",
  "OR",
  "WA",
  "AZ",
  "NM",
  "NV",
  "CO",
  "UT",
  "ID",
  "MT",
  "WY",
  "AK",
  "HI",
  "TX",
  "OK",
]);

const WINTER_STATES = new Set([
  "AK",
  "ME",
  "NH",
  "VT",
  "NY",
  "MA",
  "RI",
  "CT",
  "PA",
  "NJ",
  "OH",
  "MI",
  "WI",
  "MN",
  "ND",
  "SD",
  "MT",
  "WY",
  "ID",
  "CO",
  "UT",
  "IL",
  "IN",
  "IA",
  "NE",
  "MO",
  "KS",
  "WV",
  "VA",
  "MD",
  "DE",
]);

export function hazardsOf(
  ctx: RuleContext,
  kinds: readonly HazardKind[],
): ActiveHazard[] {
  const allowed = new Set<HazardKind>(kinds);
  return ctx.hazards.hazards.filter((hazard) => allowed.has(hazard.kind));
}

export function hasKind(
  ctx: RuleContext,
  kinds: readonly HazardKind[],
): boolean {
  return hazardsOf(ctx, kinds).length > 0;
}

export function mentionsEvacuation(hazard: ActiveHazard): boolean {
  const text = `${hazard.headline} ${hazard.instruction}`.toLowerCase();
  return text.includes("evacua");
}

/** Grounded in an NWS (or user-reported) warning, emergency, or evac product. */
export function isOfficialProduct(hazard: ActiveHazard): boolean {
  if (hazard.severity === "warning" || hazard.severity === "emergency") {
    return true;
  }
  return mentionsEvacuation(hazard);
}

export function officialHazards(
  ctx: RuleContext,
  kinds?: readonly HazardKind[],
): ActiveHazard[] {
  const pool = kinds ? hazardsOf(ctx, kinds) : ctx.hazards.hazards;
  return pool.filter(isOfficialProduct);
}

export function hasOfficialWarning(
  ctx: RuleContext,
  kinds?: readonly HazardKind[],
): boolean {
  return officialHazards(ctx, kinds).length > 0;
}

export function isAllClear(ctx: RuleContext): boolean {
  return ctx.hazards.allClear === true && ctx.hazards.hazards.length === 0;
}

export function isManufactured(home: HomeProfile): boolean {
  return (
    home.dwellingType === "manufactured_home" ||
    home.dwellingType === "mobile_home"
  );
}

export function isOlderRoof(years: Unknownable<number>): boolean {
  return isKnown(years) && years >= 15;
}

export function isUnknownRoof(years: Unknownable<number>): boolean {
  return isUnknown(years);
}

export function knownPositive(value: Unknownable<number>): boolean {
  return isKnown(value) && value > 0;
}

export function knownTrue(value: Unknownable<boolean>): boolean {
  return value === true;
}

export function knownFalse(value: Unknownable<boolean>): boolean {
  return value === false;
}

export function hasPets(household: HouseholdProfile): boolean {
  return knownPositive(household.petCount);
}

export function petsUnknown(household: HouseholdProfile): boolean {
  return isUnknown(household.petCount);
}

export function needsAccessHelp(household: HouseholdProfile): boolean {
  return (
    household.hasMobilityNeeds === true || household.canSelfEvacuate === false
  );
}

export function hasMobilityAid(
  household: HouseholdProfile,
  aid: MobilityAid,
): boolean {
  return (
    Array.isArray(household.mobilityAids) &&
    household.mobilityAids.includes(aid)
  );
}

export function accessUnknown(household: HouseholdProfile): boolean {
  return (
    isUnknown(household.hasMobilityNeeds) &&
    isUnknown(household.canSelfEvacuate)
  );
}

export function inHurricaneRegion(home: HomeProfile): boolean {
  return isKnown(home.state) && HURRICANE_STATES.has(home.state.toUpperCase());
}

export function inWildfireRegion(home: HomeProfile): boolean {
  return isKnown(home.state) && WILDFIRE_STATES.has(home.state.toUpperCase());
}

export function inWinterRegion(home: HomeProfile): boolean {
  return isKnown(home.state) && WINTER_STATES.has(home.state.toUpperCase());
}

export function kindsFrom(hazards: ActiveHazard[]): HazardKind[] {
  return [...new Set(hazards.map((hazard) => hazard.kind))];
}

export function fallbackKinds(
  hazards: ActiveHazard[],
  defaults: readonly HazardKind[],
): HazardKind[] {
  const found = kindsFrom(hazards);
  return found.length > 0 ? found : [...defaults];
}
