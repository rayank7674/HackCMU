import { describe, expect, it } from "vitest";
import {
  shouldMigrateLocalProfile,
  shouldRestoreCloudProfile,
} from "@/lib/auth/sync-rules";
import { emptyPersistedProfile, createEmptyHomeProfile } from "@/lib/stormready";

describe("cloud restore / migrate rules", () => {
  it("restores when local is empty", () => {
    expect(
      shouldRestoreCloudProfile(emptyPersistedProfile(), "2026-09-12T12:00:00.000Z"),
    ).toBe(true);
  });

  it("restores when cloud is newer", () => {
    const local = {
      ...emptyPersistedProfile(),
      home: createEmptyHomeProfile(),
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    expect(shouldRestoreCloudProfile(local, "2026-09-12T00:00:00.000Z")).toBe(
      true,
    );
    expect(shouldRestoreCloudProfile(local, "2026-08-01T00:00:00.000Z")).toBe(
      false,
    );
  });

  it("migrates local after an explicit save or when cloud is missing/older", () => {
    const local = {
      ...emptyPersistedProfile(),
      home: createEmptyHomeProfile(),
      updatedAt: "2026-09-12T00:00:00.000Z",
    };
    expect(shouldMigrateLocalProfile(local, null, false)).toBe(true);
    expect(
      shouldMigrateLocalProfile(local, "2026-09-01T00:00:00.000Z", false),
    ).toBe(true);
    expect(
      shouldMigrateLocalProfile(local, "2026-09-20T00:00:00.000Z", true),
    ).toBe(true);
    expect(shouldMigrateLocalProfile(emptyPersistedProfile(), null, true)).toBe(
      false,
    );
  });
});
