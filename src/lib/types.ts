export type Coordinate = {
  lat: number;
  lng: number;
};

export type Place = Coordinate & {
  id: string;
  label: string;
  municipality?: string;
  resultType?: "POI" | "Point Address" | "Address Range" | "Street" | "Cross Street" | "Geography" | "map";
  resultLabel?: string;
  source?: "tomtom" | "local" | "map";
  entryPoint?: Coordinate;
};

export type PositionFix = Coordinate & {
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
};

export type HazardousLoad =
  | "none"
  | "general"
  | "explosive"
  | "flammable"
  | "harmfulToWater";

export type VehicleProfile = {
  name: string;
  configuration: "C2" | "C3" | "T3S2" | "T3S3" | "T3S2R4" | "custom";
  currentWeightKg: number;
  grossWeightKg: number;
  axleWeightKg: number;
  axles: number;
  heightM: number;
  widthM: number;
  lengthM: number;
  hazardousLoad: HazardousLoad;
};

export type RouteInstruction = Coordinate & {
  id: string;
  text: string;
  distanceMeters: number;
  routePointIndex: number;
};

export type RouteAlternative = {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  trafficDelaySeconds: number;
  hasTolls: boolean;
  points: Coordinate[];
  instructions: RouteInstruction[];
  validation: RouteValidation;
};

export type RouteValidation = {
  level: "provider" | "local" | "conflict";
  label: string;
  conflicts: RestrictionConflict[];
  dataVersion: string;
};

export type RestrictionConflict = {
  restrictionId: string;
  title: string;
  source: string;
};

export type RoadRestriction = {
  id: string;
  title: string;
  type: "no_trucks" | "max_weight" | "max_height" | "max_length" | "closure";
  status: "approved" | "draft" | "expired";
  geometry: Coordinate[];
  limit?: number;
  source: string;
  authority: string;
  verifiedAt: string;
  validFrom?: string;
  validUntil?: string;
};
