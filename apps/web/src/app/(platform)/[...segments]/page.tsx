import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { LucideIcon } from "@bop/icons";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";

import { APPS, AVAILABILITY_LABEL, getApp } from "@/config/modules";
import { ADMIN_PAGES, getAdminPage } from "@/config/navigation";

/**
 * One page template for every app and administration surface. Real screens
 * replace this template app by app; the shell never changes.
 */
interface PageModel {
  name: string;
  line: string;
  icon: LucideIcon;
  badge: string | null;
}

function resolve(segments: string[]): PageModel | undefined {
  const slug = segments.join("/");
  const app = getApp(slug);
  if (app)
    return {
      name: app.name,
      line: app.tagline,
      icon: app.icon,
      badge: AVAILABILITY_LABEL[app.availability],
    };
  const admin = getAdminPage(slug);
  if (admin) return { name: admin.name, line: admin.purpose, icon: admin.icon, badge: null };
  return undefined;
}

export function generateStaticParams() {
  return [
    ...APPS.map((a) => ({ segments: a.slug.split("/") })),
    ...ADMIN_PAGES.map((p) => ({ segments: p.slug.split("/") })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}): Promise<Metadata> {
  const { segments } = await params;
  const model = resolve(segments);
  return { title: model?.name ?? "Not found" };
}

export default async function AppPage({ params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  const model = resolve(segments);
  if (!model) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={model.name}
        description={model.line}
        meta={
          model.badge ? (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {model.badge}
            </span>
          ) : null
        }
      />

      <EmptyState
        icon={model.icon}
        title={`${model.name} is on its way`}
        description="This part of the platform is being prepared. It will open here when it's ready — nothing for you to set up."
        className="py-20"
      />
    </div>
  );
}
