import { describe, expect, it } from "vitest";
import { createEmptyHomeProfile } from "@/lib/profile-store";
import {
  REINFORCEMENT_DEMO_ADDRESS,
  reinforcementGuide,
  reinforcementNeeds,
} from "@/lib/map/reinforcements";

describe("reinforcement needs", () => {
  it("stays empty when roof and shutters are not confirmed problems", () => {
    const home = createEmptyHomeProfile({
      yearBuilt: 2015,
      roofAgeYears: 4,
      hasHurricaneShutters: true,
    });
    expect(reinforcementNeeds(home)).toEqual([]);
  });

  it("flags an old roof and missing shutters for the Oakland demo address", () => {
    const home = createEmptyHomeProfile({
      ...REINFORCEMENT_DEMO_ADDRESS,
      location: {
        ...createEmptyHomeProfile().location,
        latitude: 40.4443,
        longitude: -79.9532,
      },
    });
    const needs = reinforcementNeeds(home).map((need) => need.id);
    expect(needs).toContain("roof");
    expect(needs).toContain("windows");
    const guide = reinforcementGuide(home);
    expect(guide.places.length).toBeGreaterThanOrEqual(2);
    expect(guide.areaLabel).toMatch(/Pittsburgh/);
    expect(guide.places.every((place) => place.example)).toBe(true);
    expect(guide.places.every((place) => place.rating >= 1 && place.rating <= 5)).toBe(
      true,
    );
  });
});
