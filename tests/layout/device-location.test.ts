import { describe, expect, it } from "vitest";
import {
  parseDeviceCoordinates,
  shouldRequestGeolocation,
} from "@/lib/layout/device-location";

describe("device location opt-in", () => {
  it("does not request geolocation until a user click", () => {
    expect(shouldRequestGeolocation("idle")).toBe(false);
    expect(shouldRequestGeolocation("user_click")).toBe(true);
  });

  it("rejects coordinates that are not finite map points", () => {
    expect(parseDeviceCoordinates({ latitude: "27.95", longitude: "-82.46" })).toEqual({
      latitude: 27.95,
      longitude: -82.46,
    });
    expect(parseDeviceCoordinates({ latitude: 91, longitude: 0 })).toBeNull();
    expect(parseDeviceCoordinates({ latitude: Number.NaN, longitude: -82 })).toBeNull();
  });
});
