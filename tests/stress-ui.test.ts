import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAIN_NAV_TABS, STRESS_TEST_HREF } from "@/components/layout/bottom-nav";
import {
  layoutStressCascade,
  STRESS_CASCADE_COLUMNS,
} from "@/components/stormready/stress-cascade";
import {
  parseFortifyPayload,
  parseMinBreakdown,
  parseSimulatePayload,
  parseStressResult,
  STRESS_FORTIFY_UNAVAILABLE,
  STRESS_MODELED_COPY,
  STRESS_ONBOARDING_COPY,
} from "@/components/stormready/stress-view";
import { STRESS_PRESETS } from "@/lib/stress";

const root = path.resolve(__dirname, "..");

function readUi(relative: string) {
  return readFileSync(path.join(root, relative), "utf8");
}

describe("Stress Test nav and plan CTA", () => {
  it("adds a Stress Test tab at /stress-test without dropping Help or Profile", () => {
    expect(STRESS_TEST_HREF).toBe("/stress-test");
    const hrefs = MAIN_NAV_TABS.map((tab) => tab.href);
    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/plan");
    expect(hrefs).toContain("/map");
    expect(hrefs).toContain("/stress-test");
    expect(hrefs).toContain("/help");
    expect(hrefs).toContain("/profile");
    expect(hrefs).toHaveLength(6);
  });

  it("keeps six compact tabs so the bar can fit a phone-width shell", () => {
    const nav = readUi("components/layout/bottom-nav.tsx");
    const css = readUi("app/globals.css");
    expect(nav).toContain("sr-nav-list");
    expect(nav).toContain("sr-nav-link");
    expect(css).toContain("repeat(6, minmax(0, 1fr))");
    expect(css).toMatch(/\.sr-nav-link[\s\S]*font-size:\s*10px/);
    expect(nav).toMatch(/aria-label=\{tab\.href === STRESS_TEST_HREF \? "Stress Test"/);
  });

  it("links Plan to Stress Test with the required CTA copy", () => {
    const plan = readUi("components/stormready/plan-view.tsx");
    expect(plan).toContain('href="/stress-test"');
    expect(plan).toContain("Test my preparedness");
    expect(plan.match(/Test my preparedness/g)?.length).toBe(1);
  });
});

describe("Stress Test copy", () => {
  it("uses modeled/simulated language and never a forecast or safety score", () => {
    expect(STRESS_MODELED_COPY.toLowerCase()).toMatch(/simulated/);
    expect(STRESS_MODELED_COPY.toLowerCase()).toMatch(/modeled/);
    expect(STRESS_MODELED_COPY.toLowerCase()).toMatch(/not a forecast/);
    expect(STRESS_MODELED_COPY.toLowerCase()).toMatch(/not a safety score/);
    expect(STRESS_FORTIFY_UNAVAILABLE.toLowerCase()).toMatch(/will not invent/);
    expect(STRESS_FORTIFY_UNAVAILABLE.toLowerCase()).toMatch(/all-clear/);
    expect(STRESS_ONBOARDING_COPY.toLowerCase()).toMatch(/onboarding|setup|profile/);
  });

  it("surfaces STRESS_PRESETS and fails closed on missing fortify hazards", () => {
    expect(STRESS_PRESETS.length).toBeGreaterThan(3);
    const view = readUi("components/stormready/stress-view.tsx");
    expect(view).toContain("STRESS_PRESETS");
    expect(view).toContain("hazard_state_missing");
    expect(view).toContain('router.replace("/onboarding")');
    expect(view.toLowerCase()).not.toMatch(/safety score:|safetyScore/);
    const cascade = readUi("components/stormready/stress-cascade.tsx");
    expect(cascade.toLowerCase()).not.toContain("forecast");
  });
});

describe("2D cascade layout", () => {
  it("places known nodes in columns and marks the cascade path", () => {
    expect(STRESS_CASCADE_COLUMNS.flat()).toContain("power");
    const layout = layoutStressCascade(
      [
        { id: "power", label: "Grid power", level: "critical" },
        { id: "charging", label: "Device charging", level: "major" },
        { id: "communication", label: "Phones", level: "constrained" },
        { id: "home", label: "Home", level: "none" },
      ],
      [
        { from: "power", to: "charging" },
        { from: "charging", to: "communication" },
      ],
      ["power", "charging", "communication"],
    );
    expect(layout.nodes).toHaveLength(4);
    const power = layout.nodes.find((node) => node.id === "power");
    const charging = layout.nodes.find((node) => node.id === "charging");
    const comms = layout.nodes.find((node) => node.id === "communication");
    expect(power?.inCascade).toBe(true);
    expect(charging?.x).toBeGreaterThan(power!.x);
    expect(comms?.x).toBeGreaterThan(charging!.x);
    expect(layout.edges.some((edge) => edge.inCascade)).toBe(true);
  });
});

describe("Stress API payload parsing", () => {
  it("accepts a modeled simulate payload and rejects forecast claims", () => {
    const ok = parseSimulatePayload({
      ok: true,
      graph: { nodes: [], edges: [], assumptions: [] },
      result: {
        modeled: true,
        forecast: false,
        disruptionLevel: "major",
        householdAccess: 40,
        firstBreak: {
          id: "power",
          type: "power",
          label: "Grid power",
          source: "modeled",
          capacity: 0,
          level: "critical",
        },
        cascadePath: ["power", "charging"],
        affected: [],
        nodes: [
          {
            id: "power",
            type: "power",
            label: "Grid power",
            source: "modeled",
            capacity: 0,
            level: "critical",
          },
        ],
        assumptions: [],
        provenanceNote: "modeled",
        scenario: { id: "power-12h" },
      },
    });
    expect(ok?.result.firstBreak?.id).toBe("power");
    expect(parseStressResult({ modeled: true, forecast: true })).toBeNull();
  });

  it("keeps min-breakdown misses and fortify-without-hazards unavailable", () => {
    expect(
      parseMinBreakdown({
        ok: true,
        status: "no_breakdown",
        result: null,
      })?.status,
    ).toBe("no_breakdown");
    expect(
      parseFortifyPayload({
        ok: false,
        reason: "hazard_state_missing",
      }),
    ).toBe("unavailable");
  });
});
