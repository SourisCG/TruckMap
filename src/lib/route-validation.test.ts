import { describe, expect, it } from "vitest";

import { validateRoute } from "@/lib/route-validation";
import type { RoadRestriction } from "@/lib/types";
import { DEFAULT_VEHICLE } from "@/lib/vehicle";

const restriction: RoadRestriction = {
  id: "test-weight-limit",
  title: "Límite de peso de prueba",
  type: "max_weight",
  status: "approved",
  limit: 20,
  geometry: [
    { lat: 20, lng: -100 },
    { lat: 21, lng: -101 },
  ],
  source: "https://example.test/official",
  authority: "Autoridad de prueba",
  verifiedAt: "2026-01-01",
};

describe("route validation", () => {
  it("blocks a heavy vehicle that crosses an applicable restriction", () => {
    const result = validateRoute(
      [
        { lat: 20, lng: -101 },
        { lat: 21, lng: -100 },
      ],
      DEFAULT_VEHICLE,
      [restriction],
    );
    expect(result.level).toBe("conflict");
    expect(result.conflicts[0].restrictionId).toBe(restriction.id);
  });

  it("ignores draft restrictions", () => {
    const result = validateRoute(
      [
        { lat: 20, lng: -101 },
        { lat: 21, lng: -100 },
      ],
      DEFAULT_VEHICLE,
      [{ ...restriction, status: "draft" }],
    );
    expect(result.level).toBe("provider");
  });

  it("allows a vehicle below the weight limit", () => {
    const result = validateRoute(
      [
        { lat: 20, lng: -101 },
        { lat: 21, lng: -100 },
      ],
      { ...DEFAULT_VEHICLE, currentWeightKg: 15_000 },
      [restriction],
    );
    expect(result.level).toBe("provider");
    expect(result.conflicts).toHaveLength(0);
  });
});
