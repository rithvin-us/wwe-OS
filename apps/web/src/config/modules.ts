import {
  BarChart3,
  Bell,
  Bot,
  Boxes,
  FileSearch,
  FileSignature,
  FileText,
  Mail,
  MonitorCog,
  ScanText,
  Send,
  ShoppingCart,
  Users,
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
    tagline: "Employees, leave, attendance, and onboarding.",
    availability: "in-progress",
  },
  {
    slug: "purchase",
    name: "Purchases",
    icon: ShoppingCart,
    tagline: "Review bills sent in from the Telegram bot.",
    availability: "ready",
  },
  {
    slug: "inventory",
    name: "Inventory",
    icon: Boxes,
    tagline: "Stock, items, and where things are.",
    availability: "ready",
  },
  {
    slug: "dms",
    name: "Documents",
    icon: FileText,
    tagline: "Store, find, and share company documents.",
    availability: "ready",
  },
  {
    slug: "contracts",
    name: "Contracts",
    icon: FileSignature,
    tagline: "Agreements, renewals, and expiry reminders.",
    availability: "ready",
  },
  /*
  {
    slug: "assets",
    name: "Assets",
    icon: Landmark,
    tagline: "Company equipment and who has it.",
    availability: "coming-soon",
  },
  */
  {
    slug: "analytics",
    name: "Analytics",
    icon: BarChart3,
    tagline: "Numbers and trends across the company.",
    availability: "coming-soon",
  },
  {
    slug: "reports",
    name: "Reports",
    icon: FileSearch,
    tagline: "Ready-made reports, on demand or on schedule.",
    availability: "coming-soon",
  },
];

export const AVAILABILITY_LABEL: Record<Availability, string | null> = {
  ready: null,
  "in-progress": "In progress",
  "coming-soon": "Coming soon",
};

/**
 * Background services — the machinery behind the apps. Kept off the main
 * navigation on purpose: one quiet "Services" page explains what runs in
 * the background, in plain language. Nothing to click, nothing to manage.
 */
export interface PlatformService {
  slug: string;
  name: string;
  icon: LucideIcon;
  /** Plain-language line: what it does for the user, not how it works. */
  plain: string;
  availability: Availability;
}

export const SERVICES: PlatformService[] = [
  {
    slug: "notifications",
    name: "Notifications",
    icon: Bell,
    plain: "Makes sure the right person is alerted — in the app, by email, or in chat.",
    availability: "in-progress",
  },
  {
    slug: "workflow",
    name: "Approvals",
    icon: MonitorCog,
    plain: "Moves requests — leave, purchases, documents — to the right approver automatically.",
    availability: "in-progress",
  },
  {
    slug: "ai-assistant",
    name: "AI Assistant",
    icon: Bot,
    plain: "Will answer questions and help with routine tasks across the platform.",
    availability: "coming-soon",
  },
  {
    slug: "ocr",
    name: "Document scanning",
    icon: ScanText,
    plain: "Turns paper scans and photos into searchable, usable text.",
    availability: "coming-soon",
  },
  {
    slug: "email",
    name: "Email delivery",
    icon: Mail,
    plain: "Sends platform updates and reports to inboxes reliably.",
    availability: "coming-soon",
  },
  {
    slug: "telegram",
    name: "Telegram alerts",
    icon: Send,
    plain: "Delivers urgent updates straight to the team's phones.",
    availability: "coming-soon",
  },
];

export function getApp(slug: string): PlatformApp | undefined {
  return APPS.find((a) => a.slug === slug);
}
