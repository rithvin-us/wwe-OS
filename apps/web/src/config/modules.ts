import {
  FileSearch,
  FileText,
  History,
  Landmark,
  ShoppingCart,
  Users,
  Workflow,
  type LucideIcon,
} from "@bop/icons";

/**
 * The app registry — single source of truth for every app a user can open.
 * Sidebar, home launcher, command palette, and app pages all render from
 * this list. The platform is a launcher, not a management console: each
 * entry is an app the user opens, described in plain language.
 */
export type Availability = "ready" | "in-progress" | "coming-soon";

export interface PlatformApp {
  slug: string;
  name: string;
  icon: LucideIcon;
  /** One plain line: what the user does with it. */
  tagline: string;
  availability: Availability;
}

export const APPS: PlatformApp[] = [
  {
    slug: "hr",
    name: "HR",
    icon: Users,
    tagline: "Employees, attendance, payroll, and statutory registers.",
    availability: "ready",
  },
  {
    slug: "purchase",
    name: "Purchases",
    icon: ShoppingCart,
    tagline: "Review bills sent in from the Telegram bot.",
    availability: "ready",
  },
  // {
  //   slug: "inventory",
  //   name: "Inventory",
  //   icon: Boxes,
  //   tagline: "Service tools, spare parts, and equipment.",
  //   availability: "ready",
  // },
  {
    slug: "invoices",
    name: "Invoices",
    icon: FileText,
    tagline: "In-house invoice generation and sales billing.",
    availability: "ready",
  },
  {
    slug: "dms",
    name: "Documents",
    icon: FileText,
    tagline: "Outside incoming files, contracts, and email attachments.",
    availability: "ready",
  },
  {
    slug: "assets",
    name: "Delivery Challans",
    icon: Landmark,
    tagline: "Generate and track Delivery Challans.",
    availability: "ready",
  },
  {
    slug: "reports",
    name: "Reports",
    icon: FileSearch,
    tagline: "Ready-made reports, on demand or on schedule.",
    availability: "ready",
  },
  {
    slug: "timeline",
    name: "Business Timeline",
    icon: History,
    tagline: "Everything that happened across the company, in one feed.",
    availability: "ready",
  },
  {
    slug: "automation",
    name: "Automation",
    icon: Workflow,
    tagline: "Collect tagged records on a schedule — packages, reports, auditor folders.",
    availability: "ready",
  },
];

export const AVAILABILITY_LABEL: Record<Availability, string | null> = {
  ready: null,
  "in-progress": "In progress",
  "coming-soon": "Coming soon",
};

export function getApp(slug: string): PlatformApp | undefined {
  return APPS.find((a) => a.slug === slug);
}
