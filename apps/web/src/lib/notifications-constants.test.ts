import { describe, expect, it } from "vitest";

import {
  formatRelative,
  type NotificationRecord,
  notificationHref,
} from "./notifications-constants";

function note(category: string, data: Record<string, string> = {}): NotificationRecord {
  return {
    id: "1",
    category,
    priority: "normal",
    bucket: "informational",
    channel: "in_app",
    status: "unread",
    title: "t",
    body: "b",
    data,
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

describe("notificationHref", () => {
  it("deep-links to the record when the id is attached, else the module index", () => {
    expect(notificationHref(note("documents", { document_id: "7" }))).toBe("/dms/7");
    expect(notificationHref(note("documents"))).toBe("/dms");
    expect(notificationHref(note("contracts", { contract_id: "3" }))).toBe("/contracts/3");
    expect(notificationHref(note("contracts"))).toBe("/contracts");
    expect(notificationHref(note("inventory", { item_id: "9" }))).toBe("/inventory/9");
    expect(notificationHref(note("assets", { asset_id: "2" }))).toBe("/assets/2");
    expect(notificationHref(note("purchase"))).toBe("/purchase");
  });

  it("returns null for a category with no route so the row stays non-clickable", () => {
    expect(notificationHref(note("workflow"))).toBeNull();
    expect(notificationHref(note("alert"))).toBeNull();
  });
});

describe("formatRelative", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  it("buckets into just-now / minutes / hours / days", () => {
    expect(formatRelative(ago(5_000))).toBe("just now");
    expect(formatRelative(ago(5 * 60_000))).toBe("5m ago");
    expect(formatRelative(ago(3 * 3_600_000))).toBe("3h ago");
    expect(formatRelative(ago(2 * 86_400_000))).toBe("2d ago");
  });

  it("falls back to an absolute date beyond a week", () => {
    const out = formatRelative(ago(10 * 86_400_000));
    expect(out).not.toContain("ago");
    expect(out).not.toBe("just now");
  });
});
