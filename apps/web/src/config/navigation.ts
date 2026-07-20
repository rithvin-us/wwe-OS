import {
  KeyRound,
  Layers,
  LayoutDashboard,
  ScrollText,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "@bop/icons";

import { APPS } from "@/config/modules";

/**
 * The one sidebar. Kept deliberately simple: Home, the apps, one quiet
 * Services entry, and Administration. App entries resolve from the registry
 * so name and icon can never drift between navigation, launcher, and pages.
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
 * Administration pages are platform surfaces, not apps. They render through
 * the same page template with their own definitions.
 */
export interface AdminPage {
  slug: string;
  name: string;
  icon: LucideIcon;
  purpose: string;
}

export const ADMIN_PAGES: AdminPage[] = [
  {
    slug: "admin/users",
    name: "Users",
    icon: Users,
    purpose: "Manage who has an account and what they can access.",
  },
  {
    slug: "admin/roles",
    name: "Roles",
    icon: Shield,
    purpose: "Group permissions into roles and assign them to people.",
  },
  {
    slug: "admin/permissions",
    name: "Permissions",
    icon: KeyRound,
    purpose: "See exactly what each role allows.",
  },
  {
    slug: "admin/audit",
    name: "Audit",
    icon: ScrollText,
    purpose: "A record of who did what, and when.",
  },
  {
    slug: "settings",
    name: "Settings",
    icon: Settings,
    purpose: "Organization details, appearance, and preferences.",
  },
];

export function getAdminPage(slug: string): AdminPage | undefined {
  return ADMIN_PAGES.find((p) => p.slug === slug);
}

export const NAVIGATION: NavGroup[] = [
  {
    label: null,
    items: [{ name: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Apps",
    items: APPS.map((app) => ({ name: app.name, href: `/${app.slug}`, icon: app.icon })),
  },
  {
    label: null,
    items: [{ name: "Services", href: "/services", icon: Layers, subtle: true }],
  },
  {
    label: "Administration",
    items: ADMIN_PAGES.map((p) => ({
      name: p.name,
      href: `/${p.slug}`,
      icon: p.icon,
    })),
  },
];
