import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { calculateTomTomRoutes } from "@/lib/tomtom";
import { vehicleProfileSchema } from "@/lib/vehicle";

export const maxDuration = 20;

const coordinateSchema = z.object({
  lat: z.number().min(14).max(33),
  lng: z.number().min(-119).max(-86),
});

const requestSchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
  vehicle: vehicleProfileSchema,
});

export async function POST(request: NextRequest) {
  const allowed = await checkRateLimit(`routes:${requestIp(request.headers)}`, 20, 60 * 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Alcanzaste el límite temporal de rutas. Intenta más tarde." },
      { status: 429 },
    );
  }

  try {
    const input = requestSchema.parse(await request.json());
    const routes = await calculateTomTomRoutes(
      input.origin,
      input.destination,
      input.vehicle,
      AbortSignal.timeout(15_000),
    );
    const compatibleRoutes = routes.filter((route) => route.validation.level !== "conflict");

    if (compatibleRoutes.length === 0) {
      return NextResponse.json(
        {
          error: "Las alternativas disponibles presentan conflictos con restricciones verificadas.",
          routes,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ routes: compatibleRoutes });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Revisa el origen, destino y las medidas del vehículo." },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "No fue posible calcular la ruta.";
    const status = message.includes("configurado") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
