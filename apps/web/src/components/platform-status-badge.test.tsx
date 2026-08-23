import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlatformStatusBadge } from "./platform-status-badge";

/**
 * These guard a product rule, not an implementation detail: status
 * indicators must reflect a real probe. The badge this replaced was
 * hardcoded to "operational" and could never go red, which is exactly the
 * kind of regression worth failing a build over.
 */
describe("PlatformStatusBadge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockProbe(body: unknown) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
  }

  it("asserts nothing before the probe resolves", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(<PlatformStatusBadge />);
    expect(screen.getByText(/checking/i)).toBeInTheDocument();
    expect(screen.queryByText(/operational/i)).not.toBeInTheDocument();
  });

  it("reports operational only when the probe says so", async () => {
    mockProbe({ state: "operational" });
    render(<PlatformStatusBadge />);
    await waitFor(() => expect(screen.getByText(/systems operational/i)).toBeInTheDocument());
  });

  it("reports degraded when a dependency check fails", async () => {
    mockProbe({ state: "degraded" });
    render(<PlatformStatusBadge />);
    await waitFor(() => expect(screen.getByText(/degraded/i)).toBeInTheDocument());
    expect(screen.queryByText(/operational/i)).not.toBeInTheDocument();
  });

  it("reports offline when the kernel is unreachable", async () => {
    mockProbe({ state: "down" });
    render(<PlatformStatusBadge />);
    await waitFor(() => expect(screen.getByText(/offline/i)).toBeInTheDocument());
  });

  it("reports offline when the probe itself throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    render(<PlatformStatusBadge />);
    // A failed probe is indistinguishable from an unreachable backend, and
    // must never fall back to an optimistic reading.
    await waitFor(() => expect(screen.getByText(/offline/i)).toBeInTheDocument());
  });

  it("uses the compact label in short variant", async () => {
    mockProbe({ state: "operational" });
    render(<PlatformStatusBadge variant="short" />);
    await waitFor(() => expect(screen.getByText("Active")).toBeInTheDocument());
  });
});
