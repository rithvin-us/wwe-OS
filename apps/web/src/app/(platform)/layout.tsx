import { AppShell } from "@/components/app-shell";
import { isAuthenticated } from "@/lib/api/server";
import { redirect } from "next/navigation";

export default async function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
