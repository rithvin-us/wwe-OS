import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bop/ui", "@bop/theme", "@bop/icons", "@bop/charts", "@bop/design-system"],
  // Note: React's <ViewTransition> (which experimental.viewTransition
  // enables) needs a canary React build. This app pins a stable React
  // 19.2.4, which doesn't export it — confirmed by checking the installed
  // package directly, not assumed. AppShell's route-change fade uses a
  // plain keyed remount + CSS animation instead (see app-shell.tsx). Revisit
  // once Next's stable React baseline includes ViewTransition.
};

export default nextConfig;
