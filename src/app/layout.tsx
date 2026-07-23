import type { Metadata, Viewport } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

import { ServiceWorker } from "@/components/service-worker";

export const metadata: Metadata = {
  title: "TruckMap México | Rutas para vehículos pesados",
  description:
    "Planea rutas compatibles con las dimensiones y el peso de tu vehículo pesado en Guanajuato.",
  applicationName: "TruckMap México",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TruckMap",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#112a35",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const saved = localStorage.getItem("truckmap-theme"); const dark = saved === "dark" || (saved !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.dataset.theme = dark ? "dark" : "light"; document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0c1d25" : "#112a35"); } catch {} })();`,
          }}
        />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
