/**
 * Contract checks for geocode / NWS mapping (no network).
 * Run: npm run test:integrations
 */
import assert from "node:assert/strict";
import {
  applyGeocodeToHomeProfile,
  applyNwsLocationToHomeProfile,
  geocode,
  mapNwsEventToKind,
  mapNwsSeverity,
  mapNwsUrgency,
  unknownHazardState,
} from "../lib/integrations";
import {
  UNKNOWN,
  createEmptyHomeProfile,
} from "../lib/stormready";

assert.equal(mapNwsEventToKind("Flash Flood Warning"), "flash_flood");
assert.equal(mapNwsEventToKind("Flood Watch"), "flood");
assert.equal(mapNwsEventToKind("Hurricane Warning"), "hurricane");
assert.equal(mapNwsEventToKind("Hurricane Force Wind Warning"), "wind");
assert.equal(mapNwsEventToKind("Tropical Storm Watch"), "tropical_storm");
assert.equal(mapNwsEventToKind("Storm Surge Warning"), "storm_surge");
assert.equal(mapNwsEventToKind("Tornado Emergency"), "tornado");
assert.equal(mapNwsEventToKind("Severe Thunderstorm Warning"), "severe_thunderstorm");
assert.equal(mapNwsEventToKind("Excessive Heat Warning"), "extreme_heat");
assert.equal(mapNwsEventToKind("Wind Chill Advisory"), "extreme_cold");
assert.equal(mapNwsEventToKind("Winter Storm Warning"), "winter_storm");
assert.equal(mapNwsEventToKind("Rip Current Statement"), "rip_current");
assert.equal(mapNwsEventToKind("Red Flag Warning"), "other");

assert.equal(mapNwsSeverity("Tornado Emergency", "Extreme"), "emergency");
assert.equal(mapNwsSeverity("Tornado Warning", "Severe"), "warning");
assert.equal(mapNwsSeverity("Flood Watch", "Moderate"), "watch");
assert.equal(mapNwsSeverity("Heat Advisory", "Minor"), "advisory");
assert.equal(mapNwsSeverity("Special Weather Statement", "Unknown"), "unknown");
assert.equal(mapNwsSeverity("Special Weather Statement", "Extreme"), "emergency");

assert.equal(mapNwsUrgency("Immediate"), "immediate");
assert.equal(mapNwsUrgency("Expected"), "expected");
assert.equal(mapNwsUrgency(""), UNKNOWN);

const unknownHazards = unknownHazardState();
assert.equal(unknownHazards.allClear, UNKNOWN);
assert.deepEqual(unknownHazards.hazards, []);
assert.equal(unknownHazards.provenance, UNKNOWN);

const home = createEmptyHomeProfile({
  addressLine: "100 N Ashley Dr",
  city: "Tampa",
  state: "FL",
  postalCode: "33602",
  location: {
    latitude: UNKNOWN,
    longitude: UNKNOWN,
    county: UNKNOWN,
    nwsForecastOffice: UNKNOWN,
    nwsForecastZone: UNKNOWN,
    nwsCountyZone: UNKNOWN,
    provenance: UNKNOWN,
  },
});

const applied = applyGeocodeToHomeProfile(home, {
  ok: true,
  status: "ok",
  matchKind: "address",
  query: { address: "100 N Ashley Dr, Tampa, FL 33602" },
  normalizedAddress: {
    matchedAddress: "100 N ASHLEY DR, TAMPA, FL, 33602",
    addressLine: "100 N ASHLEY DR",
    city: "TAMPA",
    state: "FL",
    postalCode: "33602",
  },
  location: {
    latitude: 27.944991620036,
    longitude: -82.458403778985,
    county: "Hillsborough County",
    nwsForecastOffice: UNKNOWN,
    nwsForecastZone: UNKNOWN,
    nwsCountyZone: UNKNOWN,
    provenance: "external_source",
  },
});

assert.equal(applied.location.latitude, 27.944991620036);
assert.equal(applied.location.longitude, -82.458403778985);
assert.equal(applied.location.county, "Hillsborough County");
assert.equal(applied.location.nwsForecastOffice, UNKNOWN);
assert.equal(applied.location.provenance, "external_source");
assert.equal(applied.addressProvenance, "external_source");
assert.equal(applied.addressLine, "100 N ASHLEY DR");

const withZones = applyNwsLocationToHomeProfile(applied, {
  county: UNKNOWN,
  nwsForecastOffice: "TBW",
  nwsForecastZone: "FLZ050",
  nwsCountyZone: "FLC057",
  locationLabel: "Tampa, FL",
});
assert.equal(withZones.location.nwsForecastOffice, "TBW");
assert.equal(withZones.location.nwsForecastZone, "FLZ050");
assert.equal(withZones.location.county, "Hillsborough County");

const zctaApplied = applyGeocodeToHomeProfile(home, {
  ok: true,
  status: "ok",
  matchKind: "zcta",
  query: { postalCode: "33602" },
  normalizedAddress: {
    matchedAddress: UNKNOWN,
    addressLine: UNKNOWN,
    city: UNKNOWN,
    state: UNKNOWN,
    postalCode: "33602",
  },
  location: {
    latitude: 27.9536679,
    longitude: -82.4566999,
    county: "Hillsborough County",
    nwsForecastOffice: UNKNOWN,
    nwsForecastZone: UNKNOWN,
    nwsCountyZone: UNKNOWN,
    provenance: "external_source",
  },
});
assert.equal(zctaApplied.addressLine, "100 N Ashley Dr");
assert.equal(zctaApplied.addressProvenance, "user_reported");
assert.equal(zctaApplied.location.latitude, 27.9536679);
assert.equal(zctaApplied.location.provenance, "external_source");

async function main() {
  const empty = await geocode({});
  assert.equal(empty.ok, false);
  if (!empty.ok) {
    assert.equal(empty.status, "unavailable");
    assert.equal(empty.reason, "invalid_input");
    assert.equal(empty.service, "geocode");
  }

  console.log("integrations smoke: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
