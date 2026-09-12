import { describe, expect, it } from "vitest";
import {
  SIMPLE_POWER_OUTAGE_PRESET_ID,
  STRESS_HEADLINE,
  STRESS_NEXT_STEPS,
  STRESS_SCENE_DISCLAIMER,
  STRESS_WEAKEST_LINK,
  friendlyDisruptionLabel,
  shortSceneLabel,
} from "@/lib/stress/copy";
import {
  buildStressScene,
  canUseWebGL,
  isFailedLevel,
  positionForNode,
  SCENE_NODE_LAYOUT,
} from "@/lib/stress/scene";
import type { NodeState, StressResult } from "@/lib/stress";
import { STRESS_PRESETS } from "@/lib/stress";

function node(partial: Partial<NodeState> & Pick<NodeState, "id" | "label">): NodeState {
  return {
    type: "power",
    source: "modeled",
    capacity: 40,
    level: "major",
    ...partial,
  };
}

const sampleResult: StressResult = {
  modeled: true,
  forecast: false,
  disruptionLevel: "major",
  householdAccess: 42,
  firstBreak: node({
    id: "power",
    type: "power",
    label: "Grid power",
    capacity: 0,
    level: "critical",
  }),
  cascadePath: ["power", "charging", "communication"],
  affected: [],
  nodes: [
    node({ id: "home", type: "home", label: "Home", capacity: 100, level: "none" }),
    node({
      id: "power",
      type: "power",
      label: "Grid power",
      capacity: 0,
      level: "critical",
    }),
    node({
      id: "charging",
      type: "charging",
      label: "Device charging",
      capacity: 10,
      level: "major",
    }),
    node({
      id: "communication",
      type: "communication",
      label: "Phones and information",
      capacity: 30,
      level: "constrained",
    }),
  ],
  assumptions: [],
  provenanceNote: "modeled",
  scenario: STRESS_PRESETS[0]!,
};

describe("stress scene mapping", () => {
  it("maps engine nodes onto the household layout and marks the cascade", () => {
    const scene = buildStressScene(sampleResult, {
      edges: [
        { from: "power", to: "charging" },
        { from: "charging", to: "communication" },
      ],
    });
    expect(scene.modeled).toBe(true);
    expect(scene.forecast).toBe(false);
    expect(scene.firstBreakId).toBe("power");
    const power = scene.nodes.find((item) => item.id === "power");
    const charging = scene.nodes.find((item) => item.id === "charging");
    const phones = scene.nodes.find((item) => item.id === "communication");
    expect(power?.isFirstBreak).toBe(true);
    expect(power?.failed).toBe(true);
    expect(power?.position).toEqual([...SCENE_NODE_LAYOUT.power!]);
    expect(charging?.inCascade).toBe(true);
    expect(phones?.shortLabel).toBe("Phones");
    expect(scene.edges.some((edge) => edge.inCascade && edge.from === "power")).toBe(true);
    expect(scene.houseLevel).toBe("none");
    expect(scene.houseParts.map((part) => part.id)).toEqual([
      "roof",
      "openings",
      "lowest_floor",
      "pipes",
    ]);
  });

  it("uses dwelling massing from the home profile, not the home node", () => {
    const scene = buildStressScene(
      sampleResult,
      { edges: [] },
      { dwellingType: "mobile_home", stories: 2 },
    );
    expect(scene.dwellingType).toBe("mobile_home");
    expect(scene.stories).toBe(2);
  });

  it("skips edges whose endpoints are missing and places unknown ids on a ring", () => {
    const scene = buildStressScene(
      {
        ...sampleResult,
        firstBreak: null,
        cascadePath: [],
        nodes: [
          node({ id: "mystery", type: "food", label: "Mystery pantry", level: "none" }),
        ],
      },
      {
        edges: [
          { from: "mystery", to: "missing" },
        ],
      },
    );
    expect(scene.edges).toHaveLength(0);
    expect(scene.nodes[0]?.position[1]).toBeGreaterThan(0);
    expect(scene.firstBreakId).toBeNull();
  });

  it("treats only major and critical as failed highlight states", () => {
    expect(isFailedLevel("none")).toBe(false);
    expect(isFailedLevel("constrained")).toBe(false);
    expect(isFailedLevel("major")).toBe(true);
    expect(isFailedLevel("critical")).toBe(true);
  });

  it("reuses known type coordinates when an id is new", () => {
    expect(positionForNode("grid-extra", "power", 0, 1)).toEqual([
      ...SCENE_NODE_LAYOUT.power!,
    ]);
  });
});

describe("WebGL detection", () => {
  it("fails closed without a canvas or when getContext throws", () => {
    expect(canUseWebGL(() => null)).toBe(false);
    expect(
      canUseWebGL(() => {
        throw new Error("blocked");
      }),
    ).toBe(false);
  });

  it("accepts webgl or experimental-webgl contexts", () => {
    expect(
      canUseWebGL(() => ({
        getContext: (id: string) => (id === "webgl" ? {} : null),
      })),
    ).toBe(true);
    expect(
      canUseWebGL(() => ({
        getContext: () => null,
      })),
    ).toBe(false);
  });
});

describe("plain-language stress copy", () => {
  it("keeps headlines judge-friendly and labels modeled, not predicted", () => {
    expect(STRESS_HEADLINE).toBe("What could go wrong?");
    expect(STRESS_WEAKEST_LINK).toBe("Weakest link");
    expect(STRESS_NEXT_STEPS).toBe("What to do next");
    expect(STRESS_SCENE_DISCLAIMER.toLowerCase()).toMatch(/modeled/);
    expect(STRESS_SCENE_DISCLAIMER.toLowerCase()).toMatch(/simulated/);
    expect(STRESS_SCENE_DISCLAIMER.toLowerCase()).not.toMatch(/forecast of/);
    expect(friendlyDisruptionLabel("critical")).toMatch(/modeled/i);
    expect(shortSceneLabel("Grid power")).toBe("Power");
    expect(STRESS_PRESETS.some((item) => item.id === SIMPLE_POWER_OUTAGE_PRESET_ID)).toBe(
      true,
    );
  });
});
