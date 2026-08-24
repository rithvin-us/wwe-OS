import { describe, expect, it } from "vitest";

import { eventsByModule, timelineHref } from "./audit-helpers";

describe("eventsByModule", () => {
  it("counts events per module, most-active first", () => {
    expect(
      eventsByModule([{ module: "hr" }, { module: "finance" }, { module: "hr" }, { module: "hr" }]),
    ).toEqual([
      { module: "hr", events: 3 },
      { module: "finance", events: 1 },
    ]);
  });

  it("returns an empty series for no entries — never a fabricated bar", () => {
    expect(eventsByModule([])).toEqual([]);
  });
});

describe("timelineHref", () => {
  it("deep-links modules with a detail route and lists the rest", () => {
    expect(timelineHref({ module: "contracts", object_id: "9" })).toBe("/contracts/9");
    expect(timelineHref({ module: "documents", object_id: "3" })).toBe("/dms/3");
    expect(timelineHref({ module: "purchase", object_id: "1" })).toBe("/purchase");
  });

  it("returns null for a module the timeline doesn't route", () => {
    expect(timelineHref({ module: "unknown", object_id: "1" })).toBeNull();
  });
});
