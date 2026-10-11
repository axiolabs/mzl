import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MZL Parchado — Menos pantalla, más parche", template: "%s · MZL Parchado" },
  description: "Descubre planes, crea parches y conecta con personas en Manizales, Caldas.",
};
export const viewport: Viewport = { themeColor: "#ff5a3c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CO">
      <body className="min-h-screen antialiased flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Saltar al contenido</a>
        <SiteHeader />
        <main id="main" className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
