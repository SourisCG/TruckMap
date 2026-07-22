import { NextRequest, NextResponse } from "next/server";

import { GUANAJUATO_PLACES } from "@/data/places";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import type { Place } from "@/lib/types";

type TomTomSearchResponse = {
  results?: Array<{
    id: string;
    position: { lat: number; lon: number };
    address: {
      freeformAddress: string;
      municipality?: string;
      countrySubdivision?: string;
    };
  }>;
};

function localSearch(query: string) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("es-MX");
  const normalized = normalize(query);
  return GUANAJUATO_PLACES.filter((place) =>
    normalize(place.label).includes(normalized),
  ).slice(0, 5);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json({ places: [] });
  }

  const allowed = await checkRateLimit(`search:${requestIp(request.headers)}`, 120, 60 * 60);
  if (!allowed) {
    return NextResponse.json({ error: "Demasiadas búsquedas." }, { status: 429 });
  }

  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ places: localSearch(query), source: "local" });
  }

  try {
    const url = new URL(
      `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json`,
    );
    url.searchParams.set("key", apiKey);
    url.searchParams.set("countrySet", "MX");
    url.searchParams.set("lat", "20.875");
    url.searchParams.set("lon", "-101.2");
    url.searchParams.set("radius", "500000");
    url.searchParams.set("limit", "5");
    url.searchParams.set("language", "es-MX");

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("Search provider error");
    const data = (await response.json()) as TomTomSearchResponse;
    const places: Place[] = (data.results ?? []).map((result) => ({
      id: result.id,
      label: `${result.address.freeformAddress}${
        result.address.countrySubdivision ? `, ${result.address.countrySubdivision}` : ""
      }`,
      municipality: result.address.municipality,
      lat: result.position.lat,
      lng: result.position.lon,
    }));
    return NextResponse.json({ places, source: "tomtom" });
  } catch {
    return NextResponse.json({ places: localSearch(query), source: "local" });
  }
}
