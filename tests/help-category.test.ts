import { describe, expect, it } from "vitest";
import {
  FINANCIAL_LINKS,
  FORBIDDEN_HELP_PROMISES,
  LOCAL_HELP_LINKS,
  PREPAREDNESS_LINKS,
  type OfficialLink,
} from "@/lib/help/content";
import {
  MAX_CATEGORY_LINKS,
  linksForCategory,
} from "@/lib/help/for-category";
import type { RecommendationCategory } from "@/lib/stormready";

const CATEGORIES: RecommendationCategory[] = [
  "evacuate",
  "shelter",
  "supplies",
  "medical",
  "pets",
  "power",
  "water",
  "communication",
  "documents",
  "other",
];

const KNOWN_IDS = new Set(
  [...PREPAREDNESS_LINKS, ...LOCAL_HELP_LINKS, ...FINANCIAL_LINKS].map(
    (link) => link.id,
  ),
);

const FORBIDDEN_CONTRACTOR = "verified contractor";

function blobFor(link: OfficialLink): string {
  return `${link.id} ${link.title} ${link.description} ${link.source} ${link.href}`.toLowerCase();
}

describe("linksForCategory", () => {
  it("returns at most two existing official links for every category", () => {
    for (const category of CATEGORIES) {
      const links = linksForCategory(category);
      expect(links.length).toBeGreaterThan(0);
      expect(links.length).toBeLessThanOrEqual(MAX_CATEGORY_LINKS);
      expect(links.length).toBeLessThanOrEqual(2);
      for (const link of links) {
        expect(KNOWN_IDS.has(link.id)).toBe(true);
        expect(link.source.trim().length).toBeGreaterThan(3);
        expect(link.href).toMatch(/^https:\/\//);
      }
    }
  });

  it("maps evacuate and shelter to Ready.gov alerts plus 211 or Red Cross", () => {
    const evacuateIds = linksForCategory("evacuate").map((link) => link.id);
    const shelterIds = linksForCategory("shelter").map((link) => link.id);

    expect(evacuateIds).toContain("ready-alerts");
    expect(evacuateIds.some((id) => id === "211" || id === "red-cross")).toBe(
      true,
    );

    expect(shelterIds).toContain("ready-alerts");
    expect(shelterIds).toContain("red-cross");
  });

  it("maps supplies, medical, pets, and generic other as specified", () => {
    expect(linksForCategory("supplies").map((l) => l.id)).toEqual(["ready-gov"]);
    expect(linksForCategory("medical").map((l) => l.id)).toEqual(["211"]);
    expect(linksForCategory("pets").map((l) => l.id)).toEqual([
      "red-cross",
      "ready-gov",
    ]);
    expect(linksForCategory("other").map((l) => l.id)).toEqual(["ready-gov"]);
  });

  it("maps power, water, communication, and documents to Ready.gov and FEMA as appropriate", () => {
    expect(linksForCategory("power").map((l) => l.id)).toEqual([
      "ready-gov",
      "fema",
    ]);
    expect(linksForCategory("water").map((l) => l.id)).toEqual([
      "ready-gov",
      "fema",
    ]);
    expect(linksForCategory("communication").map((l) => l.id)).toEqual([
      "ready-gov",
      "weather-gov",
    ]);
    expect(linksForCategory("documents").map((l) => l.id)).toEqual([
      "ready-gov",
      "fema",
    ]);
  });

  it("never uses verified-contractor copy or eligibility promises", () => {
    const corpus = CATEGORIES.flatMap((category) =>
      linksForCategory(category).map(blobFor),
    )
      .join(" ")
      .toLowerCase();

    expect(corpus).not.toContain(FORBIDDEN_CONTRACTOR);
    expect(corpus).not.toContain("verified");

    for (const phrase of FORBIDDEN_HELP_PROMISES) {
      expect(corpus).not.toContain(phrase);
    }
  });
});

describe("plan ActionCard composes knapsack UI with Help links", () => {
  it("keeps Get local help / linksForCategory under Why, not on step cards", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(
      resolve(process.cwd(), "components/stormready/plan-view.tsx"),
      "utf8",
    );
    expect(source).toContain('import { linksForCategory } from "@/lib/help/for-category"');
    expect(source).toContain("Get local help");
    expect(source).toContain("ActionOfficialLinks");
    expect(source).toContain("linksForCategory(action.category)");
    expect(source).toContain("LeftOutActions");
    expect(source).toContain("Not selected this round");
    expect(source).toContain("linksForCategory(candidate.category)");
    const whyPanel = source.indexOf("function WhyActionPanel");
    const helpInWhy = source.indexOf("linksForCategory(action.category)", whyPanel);
    const actionCard = source.indexOf("function ActionCard");
    const actionCardEnd = source.indexOf("\nfunction ", actionCard + 1);
    const leftOut = source.indexOf("function LeftOutActions");
    expect(whyPanel).toBeGreaterThan(-1);
    expect(helpInWhy).toBeGreaterThan(whyPanel);
    expect(actionCard).toBeGreaterThan(-1);
    expect(leftOut).toBeGreaterThan(-1);
    const actionCardBlock = source.slice(actionCard, actionCardEnd);
    expect(actionCardBlock).not.toContain("ActionOfficialLinks");
    expect(actionCardBlock).not.toContain("Get local help");
  });
});
