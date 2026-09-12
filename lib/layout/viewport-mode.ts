export const DEMO_VIEWPORT_KEY = "stormready.demoViewport";
export const LAPTOP_MIN_WIDTH = 1024;

export type DemoViewport = "laptop" | "mobile";

export function parseDemoViewport(raw: string | null | undefined): DemoViewport {
  return raw === "mobile" ? "mobile" : "laptop";
}

/** Phone-frame demo only on laptop-class widths. Phones/tablets stay fluid. */
export function demoViewportAttribute(
  stored: DemoViewport,
  viewportWidth: number,
): DemoViewport {
  if (viewportWidth >= LAPTOP_MIN_WIDTH && stored === "mobile") {
    return "mobile";
  }
  return "laptop";
}

export function canToggleDemoViewport(viewportWidth: number): boolean {
  return viewportWidth >= LAPTOP_MIN_WIDTH;
}
