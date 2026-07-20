"use client";

import { ScrollArea } from "@bop/ui/components/scroll-area";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { COMPANY } from "@/config/company";
import { NAVIGATION } from "@/config/navigation";

/**
 * The one sidebar. Rendered once in the desktop rail and once inside the
 * mobile sheet — never duplicated, never restyled per module.
 */
export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex h-(--layout-header-height) shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4"
      >
        <span className="flex size-7 items-center justify-center rounded-md bg-primary font-display text-[11px] font-semibold text-primary-foreground">
          {COMPANY.mark}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-[13px] font-semibold tracking-tight">
            {COMPANY.name}
          </span>
          <span className="block font-mono text-[10px] tracking-[0.08em] text-sidebar-foreground/55 uppercase">
            {COMPANY.caption}
          </span>
        </span>
      </Link>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Platform" className="flex flex-col gap-5 px-3 py-4">
          {NAVIGATION.map((group, index) => (
            <div key={group.label ?? `group-${index}`} className="flex flex-col gap-1">
              {group.label ? (
                <p className="px-2.5 pb-1 font-mono text-[10px] font-medium tracking-[0.12em] text-sidebar-foreground/55 uppercase">
                  {group.label}
                </p>
              ) : null}
              {group.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : item.subtle
                          ? "text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/80"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    <item.icon
                      aria-hidden
                      className={cn("size-4 shrink-0", active && "text-primary")}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>
    </div>
  );
}
