import type { Metadata, Viewport } from "next";
import PwaServiceWorkerRegistration from "@/components/pwa-service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Mitra",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mitra",
  },
  icons: {
    icon: [
      { url: "/icons/mitra-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/mitra-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/mitra-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  title: {
    default: "Mitra | Loan management",
    template: "%s | Mitra",
  },
  description: "Microfinance loan servicing, portfolio monitoring, and field collections.",
};

export const viewport: Viewport = {
  themeColor: "#173b33",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans">
        <PwaServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
