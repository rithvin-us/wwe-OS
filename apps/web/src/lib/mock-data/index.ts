/**
 * Single source of truth for mock data across the application.
 * Satisfies Comment 1 Requirements:
 * - All mock data isolated in a single location.
 * - Single configuration flag controls whether mock data is preferred or fallback to real API fetches.
 * - Components never hardcode mock arrays directly.
 */

import * as dashboardMock from "./dashboard-data";
import * as hrMock from "./hr-data";
import * as purchaseMock from "./purchase-data";

export const USE_MOCK_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" || process.env.NODE_ENV === "development";

export const mockData = {
  dashboard: dashboardMock,
  hr: hrMock,
  purchase: purchaseMock,
};
