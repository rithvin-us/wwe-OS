import {
  CalendarCheck,
  CalendarDays,
  FileSpreadsheet,
  IndianRupee,
  Layers,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  type LucideIcon,
} from "@bop/icons";

import { APPS } from "@/config/modules";

/**
 * The one sidebar. Deliberately simple for a single-operator company: Home,
 * the apps, a quiet Services entry, and System (Settings). App entries resolve
 * from the registry so name and icon never drift between nav, launcher, pages.
 *
 * Multi-user administration (Users, Roles, Permissions, Audit) is intentionally
 * hidden — one operator does everything, so there are no access gates to manage.
 * The backend plumbing stays in place; re-enable the screens by restoring the
 * commented entries in ADMIN_PAGES the day a second person joins.
 */
export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Rendered quieter than regular items (for non-essential entries). */
  subtle?: boolean;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/**
 * Platform surfaces (not apps). They render through the same page template.
 * Kept minimal by design — see the note above for the dormant admin screens.
 */
export interface AdminPage {
  slug: string;
  name: string;
  icon: LucideIcon;
  purpose: string;
}

export const ADMIN_PAGES: AdminPage[] = [
  {
    slug: "settings",
    name: "Settings",
    icon: Settings,
    purpose: "Company details, sign-in, appearance, and preferences.",
  },
  // --- Dormant until the company adds a second person (multi-user mode) ---
  // { slug: "admin/users",       name: "Users",       icon: Users,     purpose: "Manage who has an account." },
  // { slug: "admin/roles",       name: "Roles",       icon: Shield,    purpose: "Group permissions into roles." },
  // { slug: "admin/permissions", name: "Permissions", icon: KeyRound,  purpose: "See what each role allows." },
  // { slug: "admin/audit",       name: "Audit",       icon: ScrollText, purpose: "A record of who did what, and when." },
];

export function getAdminPage(slug: string): AdminPage | undefined {
  return ADMIN_PAGES.find((p) => p.slug === slug);
}

export const NAVIGATION: NavGroup[] = [
  {
    label: "CORE MODULES",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      ...APPS.map((app) => ({ name: app.name, href: `/${app.slug}`, icon: app.icon })),
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { name: "Maintenance", href: "/maintenance", icon: Settings, subtle: true },
      { name: "Services", href: "/services", icon: Layers, subtle: true },
      { name: "Settings", href: "/settings", icon: Settings, subtle: true },
    ],
  },
];
