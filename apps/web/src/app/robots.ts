import type { MetadataRoute } from "next";

/**
 * Internal, login-gated operations platform — nothing here should be
 * indexed by search engines.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
