import { z } from "zod";

import type { VehicleProfile } from "@/lib/types";

export const vehicleProfileSchema = z.object({
  name: z.string().trim().min(2).max(40),
  configuration: z.enum(["C2", "C3", "T3S2", "T3S3", "T3S2R4", "custom"]),
  currentWeightKg: z.number().int().min(1_000).max(120_000),
  grossWeightKg: z.number().int().min(1_000).max(120_000),
  axleWeightKg: z.number().int().min(500).max(30_000),
  axles: z.number().int().min(2).max(12),
  heightM: z.number().min(1.5).max(6),
  widthM: z.number().min(1.5).max(4.5),
  lengthM: z.number().min(3).max(40),
  hazardousLoad: z.enum(["none", "general", "explosive", "flammable", "harmfulToWater"]),
}).superRefine((profile, context) => {
  if (profile.currentWeightKg > profile.grossWeightKg) {
    context.addIssue({
      code: "custom",
      path: ["currentWeightKg"],
      message: "El peso actual no puede superar el peso bruto.",
    });
  }
});

export const DEFAULT_VEHICLE: VehicleProfile = {
  name: "Tractocamión",
  configuration: "T3S2",
  currentWeightKg: 32_000,
  grossWeightKg: 46_500,
  axleWeightKg: 9_000,
  axles: 5,
  heightM: 4.1,
  widthM: 2.6,
  lengthM: 18.5,
  hazardousLoad: "none",
};

export const VEHICLE_PRESETS: Record<string, VehicleProfile> = {
  rabon: {
    name: "Rabón C2",
    configuration: "C2",
    currentWeightKg: 12_000,
    grossWeightKg: 19_000,
    axleWeightKg: 9_500,
    axles: 2,
    heightM: 3.6,
    widthM: 2.5,
    lengthM: 10,
    hazardousLoad: "none",
  },
  torton: {
    name: "Torton C3",
    configuration: "C3",
    currentWeightKg: 20_000,
    grossWeightKg: 27_500,
    axleWeightKg: 9_200,
    axles: 3,
    heightM: 4,
    widthM: 2.6,
    lengthM: 12,
    hazardousLoad: "none",
  },
  tracto: DEFAULT_VEHICLE,
  full: {
    name: "Doble remolque",
    configuration: "T3S2R4",
    currentWeightKg: 55_000,
    grossWeightKg: 75_500,
    axleWeightKg: 9_500,
    axles: 9,
    heightM: 4.25,
    widthM: 2.6,
    lengthM: 31,
    hazardousLoad: "none",
  },
};

export function parseVehicleProfile(value: unknown): VehicleProfile {
  return vehicleProfileSchema.parse(value);
}
