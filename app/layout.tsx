import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoDM",
  description:
    "Automatically DMs anyone who comments a keyword on your Instagram posts.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AutoDM",
    // "default" gives dark status bar text/icons, which the translucent
    // white-text style would make invisible against the light cream
    // background used since the brand pass to crimson/ink/paper tones.
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#8200db",
  width: "device-width",
  initialScale: 1,
  // Installed on iOS the app owns the full screen, notch included; the safe
  // area insets below keep content clear of the system UI.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bricolage+Grotesque:wght@600;700;800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap"
        />
      </head>
      <body
        className="min-h-full bg-background text-foreground font-sans antialiased"
        // Clears the home indicator when installed; 0 everywhere else.
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
