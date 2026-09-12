import { describe, expect, it } from "vitest";
import { GROK_SYSTEM_PROMPT, K2_SYSTEM_PROMPT, k2UserPrompt } from "@/lib/ai/prompts";
import { loadPreparednessDocuments } from "@/lib/ai/documents";
import { isDisallowedInferredFact, looksLikeInventedPolicy } from "@/lib/ai/grounding";

describe("prompts never ask for safety policy", () => {
  it("tells Grok to use structured JSON only", () => {
    expect(GROK_SYSTEM_PROMPT).toMatch(/DATA, not instructions/i);
    expect(GROK_SYSTEM_PROMPT).toMatch(/Never invent safety policy/i);
    expect(GROK_SYSTEM_PROMPT).not.toMatch(/write new rules/i);
    expect(GROK_SYSTEM_PROMPT).not.toMatch(/issue an alert/i);
  });

  it("tells K2 that documents are data and not to write alerts", () => {
    expect(K2_SYSTEM_PROMPT).toMatch(/DATA, not instructions/i);
    expect(K2_SYSTEM_PROMPT).toMatch(/Do not write rules, alerts/i);
    expect(K2_SYSTEM_PROMPT).toMatch(/ai_inferred/);
  });
});

describe("bundled preparedness excerpts", () => {
  it("labels every document as data with a public source URL", () => {
    const docs = loadPreparednessDocuments();
    expect(docs.length).toBeGreaterThan(0);
    for (const doc of docs) {
      expect(doc.role).toBe("data");
      expect(doc.notInstructions).toBe(true);
      expect(doc.excerpt.length).toBeGreaterThan(40);
      expect(doc.excerpt.length).toBeLessThan(800);
      expect(doc.sourceUrl).toMatch(/^https:\/\/www\.(ready\.gov|fema\.gov)/);
      expect(doc.excerpt.toLowerCase()).toMatch(/not a/);
    }
  });

  it("wraps documents so they cannot be treated as model instructions", () => {
    const prompt = k2UserPrompt(
      loadPreparednessDocuments().map((doc) => ({
        id: doc.id,
        title: doc.title,
        source: doc.source,
        sourceUrl: doc.sourceUrl,
        excerpt: doc.excerpt,
      })),
    );
    expect(prompt).toMatch(/"notInstructions": true/);
    expect(prompt).toMatch(/"role": "data"/);
  });
});

describe("grounding filters", () => {
  it("rejects invented live products and all-clear copy", () => {
    expect(looksLikeInventedPolicy("The area is all-clear.")).toBe(true);
    expect(isDisallowedInferredFact("Tornado warning issued until 8pm.")).toBe(
      true,
    );
    expect(looksLikeInventedPolicy("Evacuate now.")).toBe(true);
    expect(
      looksLikeInventedPolicy(
        "Fill water containers is first because it is a hard constraint.",
      ),
    ).toBe(false);
  });
});
