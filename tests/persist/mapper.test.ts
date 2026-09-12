import { describe, expect, it } from "vitest";
import {
  UNKNOWN,
  createEmptyHomeProfile,
  createEmptyHouseholdProfile,
} from "@/lib/stormready";
import {
  homeProfileToRow,
  homeRowToProfile,
  householdProfileToRow,
  householdRowToProfile,
  snapshotFromRows,
  toUnknownableJson,
  toUnknownableText,
} from "@/lib/supabase/persist";

describe("unknownable column mapping", () => {
  it("keeps unknown distinct from confirmed no / zero", () => {
    const home = createEmptyHomeProfile({
      hasBackupPower: UNKNOWN,
      stories: UNKNOWN,
      roofAgeYears: UNKNOWN,
      addressLine: UNKNOWN,
    });
    const household = createEmptyHouseholdProfile({
      petCount: UNKNOWN,
      petTypes: UNKNOWN,
      hasPregnancy: UNKNOWN,
      budgetClass: UNKNOWN,
    });

    const homeRow = homeProfileToRow("user-1", home);
    const householdRow = householdProfileToRow("user-1", household);

    expect(homeRow.has_backup_power).toBe(UNKNOWN);
    expect(homeRow.stories).toBe(UNKNOWN);
    expect(homeRow.roof_age_years).toBe(UNKNOWN);
    expect(homeRow.address_line).toBe(UNKNOWN);
    expect(householdRow.pet_count).toBe(UNKNOWN);
    expect(householdRow.pet_types).toBe(UNKNOWN);
    expect(householdRow.has_pregnancy).toBe(UNKNOWN);
    expect(householdRow.budget_class).toBe(UNKNOWN);

    const restoredHome = homeRowToProfile(homeRow);
    const restoredHousehold = householdRowToProfile(householdRow);
    expect(restoredHome?.hasBackupPower).toBe(UNKNOWN);
    expect(restoredHome?.hasBackupPower).not.toBe(false);
    expect(restoredHome?.roofAgeYears).not.toBe(0);
    expect(restoredHousehold?.petCount).toBe(UNKNOWN);
    expect(restoredHousehold?.petCount).not.toBe(0);
    expect(restoredHousehold?.budgetClass).toBe(UNKNOWN);
    expect(restoredHousehold?.budgetClass).not.toBe("zero");
  });

  it("round-trips confirmed negatives and empty pet types", () => {
    const home = createEmptyHomeProfile({
      hasBackupPower: false,
      stories: 1,
      dwellingType: "mobile_home",
    });
    const household = createEmptyHouseholdProfile({
      petCount: 0,
      petTypes: [],
      hasPregnancy: false,
      occupantCount: 3,
    });

    const restoredHome = homeRowToProfile(homeProfileToRow("user-1", home));
    const restoredHousehold = householdRowToProfile(
      householdProfileToRow("user-1", household),
    );

    expect(restoredHome?.hasBackupPower).toBe(false);
    expect(restoredHome?.stories).toBe(1);
    expect(restoredHome?.dwellingType).toBe("mobile_home");
    expect(restoredHousehold?.petCount).toBe(0);
    expect(restoredHousehold?.petTypes).toEqual([]);
    expect(restoredHousehold?.hasPregnancy).toBe(false);
    expect(restoredHousehold?.occupantCount).toBe(3);
  });

  it("does not treat a missing generated snapshot as an all-clear", () => {
    const snapshot = snapshotFromRows({
      home: null,
      household: null,
      generated: null,
    });
    expect(snapshot.hazards).toBeNull();
    expect(snapshot.recommendations).toEqual([]);
  });

  it("stores blank strings as unknown", () => {
    expect(toUnknownableText("")).toBe(UNKNOWN);
    expect(toUnknownableText(null)).toBe(UNKNOWN);
    expect(toUnknownableJson(undefined)).toBe(UNKNOWN);
    expect(toUnknownableJson(false)).toBe(false);
    expect(toUnknownableJson(0)).toBe(0);
    expect(toUnknownableJson([])).toEqual([]);
  });
});
