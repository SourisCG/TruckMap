import { describe, expect, it } from "vitest";

import { bearingDegrees, distanceMeters, linesIntersect, nearestPointIndex } from "@/lib/geo";

describe("geo utilities", () => {
  it("calculates a plausible distance between León and Silao", () => {
    const distance = distanceMeters(
      { lat: 21.1221, lng: -101.6828 },
      { lat: 20.9436, lng: -101.4269 },
    );
    expect(distance).toBeGreaterThan(30_000);
    expect(distance).toBeLessThan(40_000);
  });

  it("detects intersecting road segments", () => {
    expect(
      linesIntersect(
        [{ lat: 20, lng: -101 }, { lat: 21, lng: -100 }],
        [{ lat: 20, lng: -100 }, { lat: 21, lng: -101 }],
      ),
    ).toBe(true);
  });

  it("returns the closest point in a route", () => {
    expect(
      nearestPointIndex(
        { lat: 20.51, lng: -100.51 },
        [
          { lat: 20, lng: -100 },
          { lat: 20.5, lng: -100.5 },
          { lat: 21, lng: -101 },
        ],
      ).index,
    ).toBe(1);
  });

  it("calculates a compass heading", () => {
    expect(bearingDegrees({ lat: 20, lng: -101 }, { lat: 20, lng: -100 })).toBeCloseTo(89.8, 0);
  });
});
