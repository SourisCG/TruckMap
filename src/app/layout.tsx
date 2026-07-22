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
    <html lang="es-MX">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
