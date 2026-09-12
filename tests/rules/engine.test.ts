import { describe, expect, it } from "vitest";
import {
  ENGINE_REASONS,
  RULE_COUNT,
  TAMPA_DEMO_HOME,
  TAMPA_DEMO_HOUSEHOLD,
  TAMPA_QUIET_WEATHER,
  recommend,
  tampaDemoInput,
} from "@/lib/stormready";
import { ALL_RULES } from "@/lib/rules";
import {
  allClearHazards,
  makeHazard,
  makeHazards,
  makeHome,
  makeHousehold,
} from "./helpers";

describe("rule catalog", () => {
  it("has 20–30 unique deterministic rules", () => {
    const ids = ALL_RULES.map((rule) => rule.id);
    expect(RULE_COUNT).toBe(ids.length);
    expect(RULE_COUNT).toBeGreaterThanOrEqual(20);
    expect(RULE_COUNT).toBeLessThanOrEqual(35);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("no-hazard / all-clear", () => {
  it("returns 3–5 prep actions and never invents an official alert", () => {
    const result = recommend({
      home: makeHome({
        roofAgeYears: "unknown",
        hasHurricaneShutters: false,
        hasBackupPower: false,
        floodZone: "unknown",
        hasSafeInteriorRoom: "unknown",
      }),
      household: makeHousehold({
        budgetClass: "low",
        hasPrescriptionMedications: true,
        petCount: 1,
      }),
      hazards: allClearHazards(),
    });

    expect(result.status).toBe("ok");
    expect(result.reason).toBe(ENGINE_REASONS.allClear);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(result.recommendations.length).toBeLessThanOrEqual(5);
    expect(result.recommendations.every((rec) => rec.official === false)).toBe(
      true,
    );
    expect(
      result.recommendations.every((rec) => rec.category !== "evacuate"),
    ).toBe(true);
    expect(
      result.recommendations.every((rec) =>
        ["now", "before_next_event", "long_term"].includes(rec.horizon),
      ),
    ).toBe(true);
  });
});

describe("active evacuation or warning", () => {
  it("surfaces official warning first, ahead of discretionary prep", () => {
    const result = recommend({
      home: makeHome({
        hasHurricaneShutters: false,
        roofAgeYears: 25,
        hasBackupPower: false,
      }),
      household: makeHousehold({ budgetClass: "flexible" }),
      hazards: makeHazards([
        makeHazard({
          kind: "hurricane",
          severity: "warning",
          headline: "Hurricane Warning — Evacuation Order Zone A",
          instruction: "Evacuate now.",
        }),
      ]),
    });

    expect(result.status).toBe("ok");
    expect(result.reason).toBe(ENGINE_REASONS.activeHazards);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(result.recommendations.length).toBeLessThanOrEqual(5);
    expect(result.recommendations[0]?.official).toBe(true);
    expect(result.recommendations[0]?.horizon).toBe("now");
    expect(result.matchedRuleIds).toContain("hurricane.official_warning");

    const firstDiscretionary = result.recommendations.find((rec) => !rec.official);
    if (firstDiscretionary) {
      const lastOfficialIndex = result.recommendations
        .map((rec, index) => (rec.official ? index : -1))
        .filter((index) => index >= 0)
        .at(-1);
      const discretionaryIndex = result.recommendations.indexOf(
        firstDiscretionary,
      );
      expect(lastOfficialIndex).toBeLessThan(discretionaryIndex);
    }
  });

  it("fires flood rules on NWS flood products", () => {
    const result = recommend({
      home: makeHome({ hasBasement: true }),
      household: makeHousehold(),
      hazards: makeHazards([
        makeHazard({
          kind: "flash_flood",
          severity: "warning",
          headline: "Flash Flood Warning",
          instruction: "Move to higher ground.",
        }),
      ]),
    });

    expect(result.matchedRuleIds).toContain("flood.official_warning");
    expect(result.matchedRuleIds).toContain("flood.basement");
    expect(result.recommendations[0]?.official).toBe(true);
    expect(result.recommendations[0]?.ruleId).toBe("flood.official_warning");
  });
});

describe("manufactured home + wind", () => {
  it("tells manufactured homes to leave during a wind warning", () => {
    const result = recommend({
      home: makeHome({ dwellingType: "manufactured_home" }),
      household: makeHousehold(),
      hazards: makeHazards([
        makeHazard({
          kind: "wind",
          severity: "warning",
          headline: "High Wind Warning",
        }),
      ]),
    });

    expect(result.matchedRuleIds).toContain("hurricane.manufactured_wind");
    expect(
      result.recommendations.some(
        (rec) => rec.ruleId === "hurricane.manufactured_wind" && rec.official,
      ),
    ).toBe(true);
    expect(result.recommendations[0]?.official).toBe(true);
  });
});

describe("older roof", () => {
  it("treats a known older roof as a wind failure point", () => {
    const result = recommend({
      home: makeHome({ roofAgeYears: 22 }),
      household: makeHousehold({ budgetClass: "moderate" }),
      hazards: makeHazards([
        makeHazard({
          kind: "hurricane",
          severity: "watch",
          headline: "Hurricane Watch",
        }),
      ]),
    });

    expect(result.matchedRuleIds).toContain("hurricane.old_roof");
    expect(result.matchedRuleIds).not.toContain("hurricane.unknown_roof");
  });
});

describe("unknown roof", () => {
  it("does not treat an unknown roof as no problem", () => {
    const result = recommend({
      home: makeHome({ roofAgeYears: "unknown", yearBuilt: 2019 }),
      household: makeHousehold(),
      hazards: makeHazards([
        makeHazard({
          kind: "hurricane",
          severity: "watch",
          headline: "Hurricane Watch",
        }),
      ]),
    });

    expect(result.matchedRuleIds).toContain("hurricane.unknown_roof");
    expect(result.matchedRuleIds).not.toContain("hurricane.old_roof");
    const roof = result.recommendations.find(
      (rec) => rec.ruleId === "hurricane.unknown_roof",
    );
    expect(roof).toBeDefined();
    expect(roof?.rationale.toString().toLowerCase()).toMatch(/unknown/);
  });
});

describe("$0 / lowest budget class", () => {
  it("keeps official actions and prefers no-cost discretionary ones", () => {
    const result = recommend({
      home: makeHome({
        roofAgeYears: 30,
        hasHurricaneShutters: false,
        hasBackupPower: false,
        floodZone: "unknown",
      }),
      household: makeHousehold({ budgetClass: "zero" }),
      hazards: makeHazards([
        makeHazard({
          kind: "hurricane",
          severity: "warning",
          headline: "Hurricane Warning",
          instruction: "Evacuate coastal zones.",
        }),
      ]),
    });

    expect(result.recommendations[0]?.official).toBe(true);
    const discretionary = result.recommendations.filter((rec) => !rec.official);
    expect(discretionary.every((rec) => rec.costClass === "zero")).toBe(true);
    expect(
      result.recommendations.every((rec) => !/\$[\d,]/.test(`${rec.title} ${rec.body}`)),
    ).toBe(true);
  });
});

describe("API-unavailable / missing hazard inputs", () => {
  it("fails closed when hazards are missing", () => {
    const result = recommend({
      home: makeHome(),
      household: makeHousehold(),
      hazards: null,
    });
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe(ENGINE_REASONS.hazardStateMissing);
    expect(result.recommendations).toEqual([]);
  });

  it("fails closed when the hazard adapter reports unavailable", () => {
    const result = recommend({
      home: makeHome(),
      household: makeHousehold(),
      hazards: allClearHazards(),
      hazardSource: "unavailable",
    });
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe(ENGINE_REASONS.hazardApiUnavailable);
    expect(result.recommendations).toEqual([]);
  });

  it("fails closed when allClear is unknown (empty list is not all-clear)", () => {
    const result = recommend({
      home: makeHome(),
      household: makeHousehold(),
      hazards: makeHazards([], "unknown"),
    });
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe(ENGINE_REASONS.hazardStateUnconfirmed);
    expect(result.recommendations).toEqual([]);
  });

  it("fails closed when allClear is missing (empty list is not all-clear)", () => {
    const hazards = makeHazards([], true);
    const result = recommend({
      home: makeHome(),
      household: makeHousehold(),
      hazards: {
        ...hazards,
        allClear: undefined as unknown as typeof hazards.allClear,
      },
    });
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe(ENGINE_REASONS.hazardStateUnconfirmed);
    expect(result.recommendations).toEqual([]);
  });

  it("fails closed when allClear is false but the hazard list is empty", () => {
    const result = recommend({
      home: makeHome(),
      household: makeHousehold(),
      hazards: makeHazards([], false),
    });
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe(ENGINE_REASONS.hazardStateInconsistent);
    expect(result.recommendations).toEqual([]);
  });

  it("fails closed when the home profile is missing", () => {
    const result = recommend({
      home: null,
      household: makeHousehold(),
      hazards: allClearHazards(),
    });
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe(ENGINE_REASONS.profileMissing);
    expect(result.recommendations).toEqual([]);
  });
});

describe("Tampa demo fixture", () => {
  it("drives recommendations without live NWS", () => {
    const quiet = recommend(tampaDemoInput("quiet"));
    expect(quiet.status).toBe("ok");
    expect(quiet.reason).toBe(ENGINE_REASONS.allClear);
    expect(quiet.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(quiet.recommendations.every((rec) => !rec.official)).toBe(true);
    expect(TAMPA_QUIET_WEATHER.allClear).toBe(true);
    expect(TAMPA_DEMO_HOME.city).toBe("Tampa");
    expect(TAMPA_DEMO_HOME.roofAgeYears).toBe("unknown");
    expect(TAMPA_DEMO_HOUSEHOLD.budgetClass).toBe("low");

    const evac = recommend(tampaDemoInput("evac"));
    expect(evac.status).toBe("ok");
    expect(evac.recommendations[0]?.official).toBe(true);
  });
});
