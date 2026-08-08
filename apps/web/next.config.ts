import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bop/ui", "@bop/theme", "@bop/icons", "@bop/charts", "@bop/design-system"],
};

export default nextConfig;
