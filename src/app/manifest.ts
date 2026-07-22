import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TruckMap México",
    short_name: "TruckMap",
    description: "Rutas compatibles con vehículos pesados en Guanajuato.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f0e8",
    theme_color: "#112a35",
    lang: "es-MX",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
