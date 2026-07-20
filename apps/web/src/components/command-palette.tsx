"use client";

import { Layers, LayoutDashboard, Moon, Sun, SunMoon } from "@bop/icons";
import { useTheme } from "@bop/theme";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@bop/ui/components/command";
import { useRouter } from "next/navigation";

import { APPS } from "@/config/modules";
import { ADMIN_PAGES } from "@/config/navigation";

/**
 * The one command palette (Ctrl/⌘ K). Every page in the platform is
 * reachable from here; entries come from the app registry.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search apps and pages"
    >
      <CommandInput placeholder="Search apps and pages…" />
      <CommandList>
        <CommandEmpty>Nothing matches that search.</CommandEmpty>
        <CommandGroup heading="Apps">
          {APPS.map((app) => (
            <CommandItem key={app.slug} onSelect={() => go(`/${app.slug}`)}>
              <app.icon aria-hidden />
              {app.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Platform">
          <CommandItem onSelect={() => go("/")}>
            <LayoutDashboard aria-hidden />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/services")}>
            <Layers aria-hidden />
            Services
          </CommandItem>
          {ADMIN_PAGES.map((page) => (
            <CommandItem key={page.slug} onSelect={() => go(`/${page.slug}`)}>
              <page.icon aria-hidden />
              {page.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Appearance">
          <CommandItem onSelect={() => (setTheme("light"), onOpenChange(false))}>
            <Sun aria-hidden />
            Light theme
          </CommandItem>
          <CommandItem onSelect={() => (setTheme("dark"), onOpenChange(false))}>
            <Moon aria-hidden />
            Dark theme
          </CommandItem>
          <CommandItem onSelect={() => (setTheme("system"), onOpenChange(false))}>
            <SunMoon aria-hidden />
            System theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
