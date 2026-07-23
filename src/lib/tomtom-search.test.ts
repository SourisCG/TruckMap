import { afterEach, describe, expect, it, vi } from "vitest";

import { searchTomTom, TomTomSearchError } from "@/lib/tomtom-search";

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
