import type { MetadataRoute } from "next";
import { GYM_NAME, GYM_SHORT_NAME, GYM_TAGLINE } from "@/lib/nav";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: GYM_NAME,
    short_name: GYM_SHORT_NAME,
    description: GYM_TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
