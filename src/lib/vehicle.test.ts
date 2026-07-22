import { describe, expect, it } from "vitest";

import { DEFAULT_VEHICLE, vehicleProfileSchema } from "@/lib/vehicle";

describe("vehicle profile", () => {
  it("accepts the default truck", () => {
    expect(vehicleProfileSchema.safeParse(DEFAULT_VEHICLE).success).toBe(true);
  });

  it("rejects a current weight above gross weight", () => {
    const result = vehicleProfileSchema.safeParse({
      ...DEFAULT_VEHICLE,
      currentWeightKg: 50_000,
      grossWeightKg: 40_000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("peso actual");
    }
  });

  it("rejects dimensions outside supported limits", () => {
    expect(
      vehicleProfileSchema.safeParse({ ...DEFAULT_VEHICLE, heightM: 9 }).success,
    ).toBe(false);
  });
});
