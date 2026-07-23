import type { Coordinate, Place } from "@/lib/types";

type TomTomResult = {
  id: string;
  type?: Place["resultType"];
  poi?: { name?: string };
  address?: {
    freeformAddress?: string;
    streetName?: string;
    streetNumber?: string;
    municipality?: string;
    municipalitySubdivision?: string;
    countrySubdivision?: string;
    postalCode?: string;
  };
  position?: { lat: number; lon: number };
  entryPoints?: Array<{
    type?: string;
    position?: { lat: number; lon: number };
  }>;
};

type TomTomSearchResponse = {
  results?: TomTomResult[];
  error?: { description?: string };
};

export class TomTomSearchError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "TomTomSearchError";
    this.status = status;
    this.code = code;
  }
}

function errorCode(status: number) {
  if (status === 400) return "SEARCH_BAD_REQUEST";
  if (status === 403) return "SEARCH_UNAUTHORIZED";
  if (status === 429) return "SEARCH_RATE_LIMITED";
  if (status >= 500) return "SEARCH_UNAVAILABLE";
  return "SEARCH_ERROR";
}

function resultLabel(type: Place["resultType"]) {
  switch (type) {
    case "POI":
      return "Establecimiento";
    case "Point Address":
      return "Dirección exacta";
    case "Address Range":
      return "Rango de dirección";
    case "Street":
      return "Calle";
    case "Cross Street":
      return "Cruce de calles";
    case "Geography":
      return "Zona o ciudad";
    default:
      return "Ubicación";
  }
}

function coordinateFromPosition(position?: { lat: number; lon: number }): Coordinate | null {
  if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lon)) return null;
  return { lat: position.lat, lng: position.lon };
}

function normalizeResult(result: TomTomResult): Place | null {
  const position = coordinateFromPosition(result.position);
  if (!position) return null;

  const type = result.type ?? "Geography";
  const address = result.address;
  const addressLabel = address?.freeformAddress || [
    address?.streetNumber,
    address?.streetName,
    address?.municipality,
    address?.countrySubdivision,
  ]
    .filter(Boolean)
    .join(", ");
  const title = result.poi?.name || addressLabel || "Ubicación seleccionada";
  const entryPoint = result.entryPoints
    ?.find((entry) => entry.type === "main")
    ?.position;
  const entry = coordinateFromPosition(entryPoint);
  const routePosition = entry ?? position;
  const subtitle = result.poi?.name && addressLabel ? addressLabel : undefined;

  return {
    id: result.id,
    label: subtitle && subtitle !== title ? `${title}, ${subtitle}` : title,
    resultLabel: resultLabel(type),
    resultType: type,
    source: "tomtom",
    municipality: address?.municipality,
    entryPoint: entry ?? undefined,
    ...routePosition,
  };
}

async function request(url: URL, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(url, {
      signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new TomTomSearchError(504, "SEARCH_TIMEOUT", "La búsqueda tardó demasiado.");
    }
    throw new TomTomSearchError(503, "SEARCH_UNAVAILABLE", "El servicio de búsqueda no está disponible.");
  }

  let payload: TomTomSearchResponse = {};
  try {
    payload = (await response.json()) as TomTomSearchResponse;
  } catch {
    if (!response.ok) {
      throw new TomTomSearchError(response.status, errorCode(response.status), "TomTom rechazó la búsqueda.");
    }
  }

  if (!response.ok) {
    throw new TomTomSearchError(
      response.status,
      errorCode(response.status),
      payload.error?.description || "TomTom rechazó la búsqueda.",
    );
  }

  return payload.results ?? [];
}

export async function searchTomTom(
  query: string,
  center: Coordinate,
  signal?: AbortSignal,
) {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) throw new TomTomSearchError(503, "SEARCH_NOT_CONFIGURED", "La búsqueda no está configurada.");

  const url = new URL(`https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("countrySet", "MX");
  url.searchParams.set("language", "es-419");
  url.searchParams.set("typeahead", "true");
  url.searchParams.set("limit", "8");
  url.searchParams.set("idxSet", "POI,PAD,Addr,Str,Xstr,Geo");
  url.searchParams.set("maxFuzzyLevel", "3");
  url.searchParams.set("geobias", `point:${center.lat},${center.lng}`);

  const results = await request(url, signal);
  return results.map(normalizeResult).filter((place): place is Place => place !== null);
}

export async function reverseGeocodeTomTom(point: Coordinate, signal?: AbortSignal) {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) throw new TomTomSearchError(503, "SEARCH_NOT_CONFIGURED", "La búsqueda no está configurada.");

  const url = new URL(
    `https://api.tomtom.com/search/2/reverseGeocode/${point.lat},${point.lng}.json`,
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", "es-419");
  url.searchParams.set("radius", "50");

  const results = await request(url, signal);
  return results.map(normalizeResult).filter((place): place is Place => place !== null)[0] ?? null;
}
