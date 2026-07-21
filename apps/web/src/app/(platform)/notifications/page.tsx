import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { NotificationsList } from "@/app/(platform)/notifications/notifications-list";
import { getNotifications } from "@/lib/notifications";

export const metadata: Metadata = {
  title: "Notifications",
};

export default async function NotificationsPage() {
  const notifications = await getNotifications();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notifications"
        description="Everything the platform needs you to know — approvals, renewals, stock, and more."
      />
      <NotificationsList notifications={notifications} />
    </div>
  );
}
