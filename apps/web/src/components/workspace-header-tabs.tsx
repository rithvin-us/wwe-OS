"use client";

import { CalendarClock, Inbox, Sparkles, Target } from "@bop/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceHeaderTabs() {
  const pathname = usePathname();

  const tabs = [
    {
      id: "focus",
      label: "Focus",
      description: "Your ranked worklist",
      icon: Target,
      badge: "TODAY",
      href: "/briefing",
    },
    {
      id: "approvals",
      label: "Approvals",
      description: "Leave & expense decisions",
      icon: Inbox,
      badge: "INBOX",
      href: "/approvals",
    },
    {
      id: "deadlines",
      label: "Deadlines",
      description: "Due dates & renewals",
      icon: CalendarClock,
      badge: "CALENDAR",
      href: "/deadlines",
    },
    {
      id: "assistant",
      label: "Assistant",
      description: "Rithu AI co-pilot & search",
      icon: Sparkles,
      badge: "AI",
      href: "/assistant",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-1.5 rounded-2xl bg-muted/40 border border-border/60 backdrop-blur-md mb-6">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex flex-col items-start p-3 rounded-xl transition duration-(--duration-base) ease-out-quart text-left relative overflow-hidden group ${
              isActive
                ? "bg-background text-foreground shadow-md border border-border/80 ring-1 ring-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <div
                className={`p-1.5 rounded-lg ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground group-hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              {tab.badge && (
                <span
                  className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                    isActive
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </div>

            <span className="font-bold text-xs tracking-tight block truncate w-full">
              {tab.label}
            </span>
            <span className="text-[10px] text-muted-foreground truncate w-full block font-normal">
              {tab.description}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
