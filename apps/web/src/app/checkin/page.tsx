import type { Metadata } from "next";

import { PublicMobileCheckIn } from "./checkin-client";

export const metadata: Metadata = {
  title: "Attendance check-in",
};

export default function PublicMobileCheckInPage() {
  return <PublicMobileCheckIn />;
}
