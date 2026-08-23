/**
 * Single source of truth for placeholder data across the application.
 *
 * Every export below is now EMPTY. The modules remain because their
 * interfaces are the contract a real backend fills, and because keeping
 * one gated entry point makes it obvious where fabricated data would have
 * to be reintroduced.
 */

import * as dashboardMock from "./dashboard-data";
import * as hrMock from "./hr-data";
import * as otherModulesMock from "./other-modules-data";
import * as purchaseMock from "./purchase-data";

/**
 * Opt-in only. This previously defaulted to true whenever NODE_ENV was
 * "development", which meant local runs preferred invented numbers over
 * the real API by default and the difference was invisible on screen.
 * Now nothing turns it on but an explicit NEXT_PUBLIC_USE_MOCK=true.
 */
export const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export const mockData = {
  dashboard: dashboardMock,
  hr: hrMock,
  purchase: purchaseMock,
  other: otherModulesMock,
};
