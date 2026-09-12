import { describe, expect, it } from "vitest";
import { createEmptyHomeProfile } from "@/lib/stormready";
import {
  regionalLinksForHome,
  resolveLocalHelp,
} from "@/lib/help/local-numbers";

describe("local help numbers from the saved address", () => {
  it("always includes national lines and does not invent a county office", () => {
    const none = resolveLocalHelp(null);
    expect(none.numbers.map((item) => item.id)).toEqual(
      expect.arrayContaining(["911", "211", "poison", "fema-helpline"]),
    );
    expect(none.numbers.every((item) => item.scope === "national")).toBe(true);
    expect(none.missingNote?.toLowerCase()).toMatch(/add an address|zip/);
    expect(none.links).toEqual([]);
  });

  it("attaches Florida DEM and Hillsborough numbers for a Tampa address", () => {
    const home = createEmptyHomeProfile({
      city: "Tampa",
      state: "FL",
      postalCode: "33620",
      location: {
        ...createEmptyHomeProfile().location,
        county: "Hillsborough",
        nwsForecastOffice: "TBW",
        provenance: "external_source",
      },
    });
    const local = resolveLocalHelp(home);
    expect(local.state).toBe("FL");
    expect(local.county).toBe("hillsborough");
    expect(local.numbers.some((item) => item.id === "state-em-FL" && item.tel === "8508154000")).toBe(
      true,
    );
    expect(local.numbers.some((item) => item.id === "county-em-FL-hillsborough")).toBe(true);
    expect(local.numbers.some((item) => item.id === "nws-tbw")).toBe(true);
    expect(local.numbers.find((item) => item.id === "211")?.note).toMatch(/33620/);
    expect(regionalLinksForHome(home).map((link) => link.id)).toEqual(
      expect.arrayContaining(["florida-dem", "hillsborough-em", "211-tampa"]),
    );
  });

  it("does not show Tampa examples or Florida phones for a New York address", () => {
    const home = createEmptyHomeProfile({
      city: "Buffalo",
      state: "NY",
      postalCode: "14202",
      location: {
        ...createEmptyHomeProfile().location,
        county: "Erie",
        nwsForecastOffice: "BUF",
        provenance: "external_source",
      },
    });
    const local = resolveLocalHelp(home);
    expect(local.numbers.some((item) => item.id === "state-em-NY")).toBe(true);
    expect(local.numbers.some((item) => item.tel === "8508154000")).toBe(false);
    expect(local.numbers.some((item) => item.id.includes("hillsborough"))).toBe(false);
    expect(regionalLinksForHome(home)).toEqual([]);
    expect(local.missingNote?.toLowerCase()).toMatch(/will not invent/);
  });

  it("never invents a county number when the county is not in the table", () => {
    const home = createEmptyHomeProfile({
      state: "FL",
      location: {
        ...createEmptyHomeProfile().location,
        county: "Leon",
        provenance: "external_source",
      },
    });
    const local = resolveLocalHelp(home);
    expect(local.numbers.some((item) => item.scope === "county")).toBe(false);
    expect(local.numbers.some((item) => item.id === "state-em-FL")).toBe(true);
  });
});
