import type { Coordinate } from "@/lib/types";

const EARTH_RADIUS_M = 6_371_000;

function radians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: Coordinate, b: Coordinate) {
  const latitudeDelta = radians(b.lat - a.lat);
  const longitudeDelta = radians(b.lng - a.lng);
  const latitudeA = radians(a.lat);
  const latitudeB = radians(b.lat);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(haversine));
}

export function nearestPointIndex(point: Coordinate, line: Coordinate[]) {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  line.forEach((candidate, index) => {
    const distance = distanceMeters(point, candidate);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return { index: nearestIndex, distance: nearestDistance };
}

export function bearingDegrees(from: Coordinate, to: Coordinate) {
  const fromLatitude = radians(from.lat);
  const toLatitude = radians(to.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);

  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function orientation(a: Coordinate, b: Coordinate, c: Coordinate) {
  return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
}

function segmentsIntersect(a: Coordinate, b: Coordinate, c: Coordinate, d: Coordinate) {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  return first * second <= 0 && third * fourth <= 0;
}

export function linesIntersect(first: Coordinate[], second: Coordinate[]) {
  for (let firstIndex = 1; firstIndex < first.length; firstIndex += 1) {
    for (let secondIndex = 1; secondIndex < second.length; secondIndex += 1) {
      if (
        segmentsIntersect(
          first[firstIndex - 1],
          first[firstIndex],
          second[secondIndex - 1],
          second[secondIndex],
        )
      ) {
        return true;
      }
    }
  }

  return false;
}
