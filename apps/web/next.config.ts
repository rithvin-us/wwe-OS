import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bop/ui", "@bop/theme", "@bop/icons", "@bop/charts", "@bop/design-system"],
  experimental: {
    optimizePackageImports: ["@bop/icons", "@bop/ui", "@bop/charts", "motion", "lucide-react"],
  },
};

export default nextConfig;
