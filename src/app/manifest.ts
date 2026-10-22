import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MailPoint",
    short_name: "MailPoint",
    description: "Your unified Gmail and Google Calendar workspace.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#11161d",
    theme_color: "#11161d",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icons/mailpoint-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/mailpoint-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/mailpoint-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
