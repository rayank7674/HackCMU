import { describe, expect, it } from "vitest";
import {
  canToggleDemoViewport,
  demoViewportAttribute,
  parseDemoViewport,
} from "@/lib/layout/viewport-mode";

describe("demo viewport mode", () => {
  it("defaults unknown storage to laptop", () => {
    expect(parseDemoViewport(null)).toBe("laptop");
    expect(parseDemoViewport("laptop")).toBe("laptop");
    expect(parseDemoViewport("mobile")).toBe("mobile");
    expect(parseDemoViewport("tablet")).toBe("laptop");
  });

  it("never letterboxes phones or tablets into a 390px demo frame", () => {
    expect(demoViewportAttribute("mobile", 390)).toBe("laptop");
    expect(demoViewportAttribute("mobile", 768)).toBe("laptop");
    expect(demoViewportAttribute("mobile", 1023)).toBe("laptop");
  });

  it("applies the phone-frame demo only on laptop-class widths", () => {
    expect(demoViewportAttribute("mobile", 1024)).toBe("mobile");
    expect(demoViewportAttribute("laptop", 1440)).toBe("laptop");
  });

  it("shows the laptop/mobile toggle only on laptop-class widths", () => {
    expect(canToggleDemoViewport(430)).toBe(false);
    expect(canToggleDemoViewport(820)).toBe(false);
    expect(canToggleDemoViewport(1024)).toBe(true);
  });
});
