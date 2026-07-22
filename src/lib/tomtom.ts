import { nearestPointIndex } from "@/lib/geo";
import type {
  Coordinate,
  RouteAlternative,
  RouteInstruction,
  VehicleProfile,
} from "@/lib/types";
import { validateRoute } from "@/lib/route-validation";

type TomTomPoint = { latitude: number; longitude: number };

type TomTomInstruction = {
  routeOffsetInMeters: number;
  travelTimeInSeconds: number;
  point: TomTomPoint;
  message: string;
};

type TomTomResponse = {
  routes?: Array<{
    summary: {
      lengthInMeters: number;
      travelTimeInSeconds: number;
      trafficDelayInSeconds?: number;
    };
    legs: Array<{ points: TomTomPoint[] }>;
    guidance?: { instructions?: TomTomInstruction[] };
    sections?: Array<{ sectionType?: string; travelMode?: string }>;
  }>;
  error?: { description?: string };
};

function hazardousLoad(load: VehicleProfile["hazardousLoad"]) {
  const values: Record<VehicleProfile["hazardousLoad"], string | undefined> = {
    none: undefined,
    general: "otherHazmatGeneral",
    explosive: "otherHazmatExplosive",
    flammable: "otherHazmatGeneral",
    harmfulToWater: "otherHazmatHarmfulToWater",
  };
  return values[load];
}

function normalizeInstruction(
  instruction: TomTomInstruction,
  index: number,
  points: Coordinate[],
): RouteInstruction {
  const point = { lat: instruction.point.latitude, lng: instruction.point.longitude };
  return {
    id: `instruction-${index}`,
    text: instruction.message,
    distanceMeters: instruction.routeOffsetInMeters,
    routePointIndex: nearestPointIndex(point, points).index,
    ...point,
  };
}

export async function calculateTomTomRoutes(
  origin: Coordinate,
  destination: Coordinate,
  vehicle: VehicleProfile,
  signal?: AbortSignal,
): Promise<RouteAlternative[]> {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) {
    throw new Error("El servicio de rutas todavía no está configurado.");
  }

  const locations = `${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;
  const url = new URL(
    `https://api.tomtom.com/routing/1/calculateRoute/${locations}/json`,
  );
  const parameters: Record<string, string> = {
    key: apiKey,
    travelMode: "truck",
    routeType: "fastest",
    traffic: "true",
    computeTravelTimeFor: "all",
    routeRepresentation: "polyline",
    instructionsType: "text",
    language: "es-MX",
    maxAlternatives: "2",
    vehicleCommercial: "true",
    vehicleWeight: String(vehicle.currentWeightKg),
    vehicleAxleWeight: String(vehicle.axleWeightKg),
    vehicleNumberOfAxles: String(vehicle.axles),
    vehicleLength: String(vehicle.lengthM),
    vehicleWidth: String(vehicle.widthM),
    vehicleHeight: String(vehicle.heightM),
  };
  const loadType = hazardousLoad(vehicle.hazardousLoad);
  if (loadType) parameters.vehicleLoadType = loadType;
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    signal,
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload = (await response.json()) as TomTomResponse;
  if (!response.ok || !payload.routes) {
    throw new Error(payload.error?.description || "No fue posible calcular una ruta compatible.");
  }

  return payload.routes.map((route, index) => {
    const points = route.legs.flatMap((leg, legIndex) =>
      leg.points
        .slice(legIndex === 0 ? 0 : 1)
        .map((point) => ({ lat: point.latitude, lng: point.longitude })),
    );
    return {
      id: `route-${index}`,
      distanceMeters: route.summary.lengthInMeters,
      durationSeconds: route.summary.travelTimeInSeconds,
      trafficDelaySeconds: route.summary.trafficDelayInSeconds ?? 0,
      hasTolls: route.sections?.some((section) => section.sectionType === "TOLL_ROAD") ?? false,
      points,
      instructions: (route.guidance?.instructions ?? []).map((instruction, instructionIndex) =>
        normalizeInstruction(instruction, instructionIndex, points),
      ),
      validation: validateRoute(points, vehicle),
    };
  });
}
