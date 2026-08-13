import { afterEach, describe, expect, it, vi } from "vitest";

import { reverseGeocodeTomTom, searchTomTom, TomTomSearchError } from "@/lib/tomtom-search";

describe("TomTom search adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("requests POI, addresses and streets in Latin American Spanish", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    let requestedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        requestedUrl = input.toString();
        return new Response(
          JSON.stringify({
            results: [
              {
                id: "poi-1",
                type: "POI",
                poi: { name: "Centro de carga" },
                address: { freeformAddress: "Blvd. Aeropuerto 100, León, Guanajuato" },
                position: { lat: 21.1, lon: -101.6 },
                entryPoints: [{ type: "main", position: { lat: 21.1001, lon: -101.6001 } }],
              },
            ],
          }),
          { status: 200 },
        );
      }),
    );

    const places = await searchTomTom("centro de carga", { lat: 21.1, lng: -101.6 });
    const params = new URL(requestedUrl).searchParams;

    expect(params.get("language")).toBe("es-419");
    expect(params.get("typeahead")).toBe("true");
    expect(params.get("idxSet")).toBe("POI,PAD,Addr,Str,Xstr,Geo");
    expect(params.has("radius")).toBe(false);
    expect(places[0]).toMatchObject({
      label: "Centro de carga, Blvd. Aeropuerto 100, León, Guanajuato",
      resultLabel: "Establecimiento",
      lat: 21.1001,
      lng: -101.6001,
    });
  });

  it("exposes provider authorization failures", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 403 })),
    );

    await expect(searchTomTom("una calle", { lat: 21, lng: -101 })).rejects.toMatchObject({
      status: 403,
      code: "SEARCH_UNAUTHORIZED",
    } satisfies Partial<TomTomSearchError>);
  });
});

describe("TomTom reverse geocode adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("parses the addresses payload with a string position", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    let requestedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        requestedUrl = input.toString();
        return new Response(
          JSON.stringify({
            addresses: [
              {
                address: {
                  municipality: "León",
                  countrySubdivision: "Guanajuato",
                  postalCode: "37000",
                  freeformAddress: "Av. López Mateos 100, Centro, 37000, León, Guanajuato",
                },
                position: "21.121972,-101.6832",
              },
            ],
          }),
          { status: 200 },
        );
      }),
    );

    const place = await reverseGeocodeTomTom({ lat: 21.121972, lng: -101.6832 });

    const url = new URL(requestedUrl);
    expect(url.pathname).toContain("/reverseGeocode/21.121972,-101.6832.json");
    expect(url.searchParams.get("radius")).toBe("50");
    expect(place).toMatchObject({
      label: "Av. López Mateos 100, Centro, 37000, León, Guanajuato",
      resultLabel: "Dirección",
      municipality: "León",
      lat: 21.121972,
      lng: -101.6832,
    });
  });

  it("returns null when the provider has no address for the point", async () => {
    vi.stubEnv("TOMTOM_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ addresses: [] }), { status: 200 })),
    );

    await expect(reverseGeocodeTomTom({ lat: 21.5, lng: -101.2 })).resolves.toBeNull();
  });
});
