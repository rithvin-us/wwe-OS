import { describe, expect, it } from "vitest";

import { APPS, AVAILABILITY_LABEL, getApp } from "./modules";

describe("getApp", () => {
  it("resolves a known slug and returns undefined for an unknown one", () => {
    expect(getApp("hr")?.name).toBe("HR");
    expect(getApp("not-an-app")).toBeUndefined();
  });
});

describe("AVAILABILITY_LABEL", () => {
  it("shows a plain badge for unfinished apps and nothing for ready ones", () => {
    expect(AVAILABILITY_LABEL.ready).toBeNull();
    expect(AVAILABILITY_LABEL["in-progress"]).toBe("In progress");
    expect(AVAILABILITY_LABEL["coming-soon"]).toBe("Coming soon");
  });
});

describe("APPS registry invariants", () => {
  it("every app has a unique slug — the sidebar, launcher, and routes key off it", () => {
    const slugs = APPS.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every app carries a name, a tagline, and a known availability", () => {
    for (const app of APPS) {
      expect(app.name.length).toBeGreaterThan(0);
      expect(app.tagline.length).toBeGreaterThan(0);
      expect(["ready", "in-progress", "coming-soon"]).toContain(app.availability);
    }
  });
});
