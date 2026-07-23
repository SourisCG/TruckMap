import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { TomTomSearchError, reverseGeocodeTomTom } from "@/lib/tomtom-search";

const pointSchema = z.object({
  lat: z.coerce.number().min(14).max(33),
  lng: z.coerce.number().min(-119).max(-86),
});

export async function GET(request: NextRequest) {
  const allowed = await checkRateLimit(`reverse:${requestIp(request.headers)}`, 120, 60 * 60);
  if (!allowed) {
    return NextResponse.json(
      { code: "SEARCH_RATE_LIMITED", error: "Demasiadas consultas de ubicación." },
      { status: 429 },
    );
  }

  const parsed = pointSchema.safeParse({
    lat: request.nextUrl.searchParams.get("lat"),
    lng: request.nextUrl.searchParams.get("lng"),
  });
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_COORDINATES", error: "Coordenadas inválidas." }, { status: 400 });
  }

  if (!process.env.TOMTOM_API_KEY) {
    return NextResponse.json({
      place: {
        id: `map-${parsed.data.lat}-${parsed.data.lng}`,
        label: "Punto seleccionado en el mapa",
        resultLabel: "Punto del mapa",
        resultType: "map",
        source: "map",
        ...parsed.data,
      },
      source: "map",
    });
  }

  try {
    const place = await reverseGeocodeTomTom(parsed.data, AbortSignal.timeout(8_000));
    return NextResponse.json({ place, source: "tomtom" });
  } catch (error) {
    if (error instanceof TomTomSearchError) {
      return NextResponse.json({ code: error.code, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { code: "SEARCH_UNAVAILABLE", error: "No fue posible identificar ese punto." },
      { status: 503 },
    );
  }
}
