import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mitra | Loan management",
    short_name: "Mitra",
    description: "Microfinance loan servicing, portfolio monitoring, and field collections.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8faf8",
    theme_color: "#173b33",
    icons: [
      {
        src: "/icons/mitra-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/mitra-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/mitra-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
