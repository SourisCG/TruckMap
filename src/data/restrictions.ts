import type { RoadRestriction } from "@/lib/types";

export const RESTRICTIONS_VERSION = "2026-07-22";

// Only approved, sourced records affect a route. Draft records can be reviewed
// in the repository without risking a false safety claim in production.
export const ROAD_RESTRICTIONS: RoadRestriction[] = [];
