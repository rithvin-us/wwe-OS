import type { MetadataRoute } from "next";

import { COMPANY } from "@/config/company";

/**
 * Web app manifest. Next serves this at /manifest.webmanifest and links it
 * from every page automatically — there is no <link rel="manifest"> to add.
 *
 * Together with the fetch handler in public/sw.js this is what makes
 * Chromium offer "Install app". Colours are the resolved sRGB values of the
 * design tokens (--primary, --background light/dark) from
 * packages/design-system/src/tokens.css; a manifest cannot read CSS
 * variables, so if those tokens change these must be updated with them.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${COMPANY.name} · ${COMPANY.caption}`,
    short_name: COMPANY.name,
    description: "One place for company operations: HR, purchases, documents, and more.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f7fdff",
    theme_color: "#008cba",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Separate asset with a 20% safe zone so Android's launcher shape
      // crop never clips the mark.
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
