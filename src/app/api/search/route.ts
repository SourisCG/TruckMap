import { NextRequest, NextResponse } from "next/server";

import { GUANAJUATO_PLACES } from "@/data/places";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { TomTomSearchError, searchTomTom } from "@/lib/tomtom-search";
import type { Coordinate } from "@/lib/types";

function localSearch(query: string) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("es-MX");
  const normalized = normalize(query);
  return GUANAJUATO_PLACES.filter((place) => normalize(place.label).includes(normalized))
    .map((place) => ({ ...place, resultLabel: "Municipio", source: "local" as const }))
    .slice(0, 5);
}

function parseCenter(request: NextRequest): Coordinate {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  if (lat >= 14 && lat <= 33 && lng >= -119 && lng <= -86) return { lat, lng };
  return { lat: 20.875, lng: -101.2 };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json({ places: [], source: "none" });
  }

  const allowed = await checkRateLimit(`search:${requestIp(request.headers)}`, 120, 60 * 60);
  if (!allowed) {
    return NextResponse.json(
      { code: "SEARCH_RATE_LIMITED", error: "Demasiadas búsquedas. Intenta más tarde." },
      { status: 429 },
    );
  }

  if (!process.env.TOMTOM_API_KEY) {
    return NextResponse.json({
      places: localSearch(query),
      source: "local",
      limited: true,
      warning: "Búsqueda limitada a municipios de Guanajuato porque TomTom no está configurado.",
    });
  }

  try {
    const places = await searchTomTom(query, parseCenter(request), AbortSignal.timeout(8_000));
    return NextResponse.json({ places, source: "tomtom", limited: false });
  } catch (error) {
    if (error instanceof TomTomSearchError) {
      const status = error.status >= 400 && error.status <= 599 ? error.status : 503;
      return NextResponse.json({ code: error.code, error: error.message, source: "tomtom" }, { status });
    }
    return NextResponse.json(
      { code: "SEARCH_UNAVAILABLE", error: "No fue posible consultar direcciones.", source: "tomtom" },
      { status: 503 },
    );
  }
}
