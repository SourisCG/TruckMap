import { RESTRICTIONS_VERSION, ROAD_RESTRICTIONS } from "@/data/restrictions";
import { linesIntersect } from "@/lib/geo";
import type {
  Coordinate,
  RoadRestriction,
  RouteValidation,
  VehicleProfile,
} from "@/lib/types";

function appliesToVehicle(restriction: RoadRestriction, vehicle: VehicleProfile) {
  switch (restriction.type) {
    case "no_trucks":
    case "closure":
      return true;
    case "max_weight":
      return restriction.limit !== undefined && vehicle.currentWeightKg / 1_000 > restriction.limit;
    case "max_height":
      return restriction.limit !== undefined && vehicle.heightM > restriction.limit;
    case "max_length":
      return restriction.limit !== undefined && vehicle.lengthM > restriction.limit;
  }
}

export function validateRoute(
  points: Coordinate[],
  vehicle: VehicleProfile,
  restrictions = ROAD_RESTRICTIONS,
): RouteValidation {
  const activeRestrictions = restrictions.filter((restriction) => {
    if (restriction.status !== "approved") return false;
    if (restriction.validFrom && new Date(restriction.validFrom) > new Date()) return false;
    if (restriction.validUntil && new Date(restriction.validUntil) < new Date()) return false;
    return appliesToVehicle(restriction, vehicle);
  });

  const conflicts = activeRestrictions
    .filter((restriction) => linesIntersect(points, restriction.geometry))
    .map((restriction) => ({
      restrictionId: restriction.id,
      title: restriction.title,
      source: restriction.source,
    }));

  if (conflicts.length > 0) {
    return {
      level: "conflict",
      label: "Conflicto con una restricción verificada",
      conflicts,
      dataVersion: RESTRICTIONS_VERSION,
    };
  }

  if (activeRestrictions.length > 0) {
    return {
      level: "local",
      label: "Compatible con datos locales verificados",
      conflicts: [],
      dataVersion: RESTRICTIONS_VERSION,
    };
  }

  return {
    level: "provider",
    label: "Compatible según datos del proveedor",
    conflicts: [],
    dataVersion: RESTRICTIONS_VERSION,
  };
}
