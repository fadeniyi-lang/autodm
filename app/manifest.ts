import type { MetadataRoute } from "next";

// Lets a self-hosted instance be installed to the home screen: on iOS via
// Share -> "Add to Home Screen", on Android through the install prompt. It then
// opens standalone, without browser chrome, which makes checking campaigns from
// a phone practical.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AutoDM",
    short_name: "AutoDM",
    description: "Instagram comment-to-DM automation",
    start_url: "/overview",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f7f2",
    theme_color: "#8200db",
    // "any" only — the new icon's artwork runs edge to edge with no safe
    // padding, so a "maskable" purpose would let Android's circular/squircle
    // mask clip the wordmark. iOS (the primary target here) ignores purpose
    // entirely and uses apple-touch-icon.png instead.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
