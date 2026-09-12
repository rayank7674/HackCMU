/**
 * Runtime contract checks for the anonymous profile store.
 * Run: node --experimental-strip-types scripts/profile-store.smoke.ts
 */
import assert from "node:assert/strict";
import {
  UNKNOWN,
  PROFILE_STORAGE_KEY,
  clearProfile,
  createEmptyHomeProfile,
  createEmptyHouseholdProfile,
  hasStoredProfile,
  loadProfile,
  saveHomeProfile,
  saveHouseholdProfile,
  saveProfile,
} from "../lib/stormready";

const memory = new Map<string, string>();

const localStorage = {
  getItem(key: string) {
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
  },
  removeItem(key: string) {
    memory.delete(key);
  },
};

Object.defineProperty(globalThis, "window", {
  value: { localStorage },
  configurable: true,
});

clearProfile();
assert.equal(hasStoredProfile(), false);
assert.equal(loadProfile().home, null);
assert.equal(loadProfile().household, null);

const home = createEmptyHomeProfile();
assert.equal(home.hasBackupPower, UNKNOWN);
assert.equal(home.dwellingType, UNKNOWN);
assert.equal(home.roofAgeYears, UNKNOWN);
assert.equal(home.location.latitude, UNKNOWN);
assert.notEqual(home.hasBackupPower, false);
assert.notEqual(home.roofAgeYears, 0);

const savedHome = saveHomeProfile({
  ...home,
  dwellingType: "mobile_home",
  hasBackupPower: false,
  stories: 1,
});
assert.equal(savedHome.home?.dwellingType, "mobile_home");
assert.equal(savedHome.home?.hasBackupPower, false);
assert.equal(savedHome.home?.hasHurricaneShutters, UNKNOWN);
assert.equal(savedHome.household, null);

const household = createEmptyHouseholdProfile({
  occupantCount: 3,
  petCount: 0,
});
assert.equal(household.petCount, 0);
assert.equal(household.hasPowerDependentMedicalDevice, UNKNOWN);
assert.equal(household.budgetClass, UNKNOWN);
assert.notEqual(household.petCount, UNKNOWN);
assert.notEqual(household.budgetClass, "zero");

saveHouseholdProfile(household);
const loaded = loadProfile();
assert.equal(loaded.home?.dwellingType, "mobile_home");
assert.equal(loaded.home?.hasBackupPower, false);
assert.equal(loaded.household?.petCount, 0);
assert.equal(loaded.household?.hasPregnancy, UNKNOWN);
assert.equal(hasStoredProfile(), true);

memory.set(
  PROFILE_STORAGE_KEY,
  JSON.stringify({
    version: 1,
    updatedAt: "2026-09-12T00:00:00.000Z",
    home: {
      id: "home-1",
      hasBackupPower: "unknown",
      addressLine: "",
      stories: null,
    },
    household: {
      id: "hh-1",
      petCount: 0,
      petTypes: [],
      hasPregnancy: false,
    },
  }),
);

const recovered = loadProfile();
assert.equal(recovered.home?.hasBackupPower, UNKNOWN);
assert.equal(recovered.home?.addressLine, UNKNOWN);
assert.equal(recovered.home?.stories, UNKNOWN);
assert.equal(recovered.household?.petCount, 0);
assert.deepEqual(recovered.household?.petTypes, []);
assert.equal(recovered.household?.hasPregnancy, false);

saveProfile({ home: null });
assert.equal(loadProfile().home, null);
assert.equal(loadProfile().household?.petCount, 0);

clearProfile();
assert.equal(memory.has(PROFILE_STORAGE_KEY), false);
assert.equal(hasStoredProfile(), false);

console.log("profile-store smoke: ok");
