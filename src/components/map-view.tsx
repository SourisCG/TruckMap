"use client";

import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";

import type { Coordinate, Place, RouteAlternative } from "@/lib/types";

type MapViewProps = {
  origin: Place | null;
  destination: Place | null;
  routes: RouteAlternative[];
  selectedRouteId: string | null;
  currentPosition: Coordinate | null;
  reporting: boolean;
  reportPoint: Coordinate | null;
  onMapClick: (point: Coordinate) => void;
};

function mapStyle(): StyleSpecification {
  const key = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
  if (!key) {
    return {
      version: 8 as const,
      sources: {
        carto: {
          type: "raster" as const,
          tiles: ["https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors © CARTO",
        },
      },
      layers: [{ id: "carto", type: "raster" as const, source: "carto" }],
    };
  }

  return {
    version: 8 as const,
    sources: {
      tomtom: {
        type: "raster" as const,
        tiles: [`https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${key}`],
        tileSize: 256,
        attribution: "© TomTom",
      },
    },
    layers: [{ id: "tomtom", type: "raster" as const, source: "tomtom" }],
  };
}

function routeGeoJson(routes: RouteAlternative[], selectedRouteId: string | null) {
  return {
    type: "FeatureCollection" as const,
    features: routes.map((route) => ({
      type: "Feature" as const,
      properties: { selected: route.id === selectedRouteId },
      geometry: {
        type: "LineString" as const,
        coordinates: route.points.map((point) => [point.lng, point.lat]),
      },
    })),
  };
}

function pointGeoJson(
  origin: Place | null,
  destination: Place | null,
  currentPosition: Coordinate | null,
  reportPoint: Coordinate | null,
) {
  const entries = [
    origin && { point: origin, kind: "origin" },
    destination && { point: destination, kind: "destination" },
    currentPosition && { point: currentPosition, kind: "current" },
    reportPoint && { point: reportPoint, kind: "report" },
  ].filter(Boolean) as Array<{ point: Coordinate; kind: string }>;

  return {
    type: "FeatureCollection" as const,
    features: entries.map(({ point, kind }) => ({
      type: "Feature" as const,
      properties: { kind },
      geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
    })),
  };
}

export function MapView({
  origin,
  destination,
  routes,
  selectedRouteId,
  currentPosition,
  reporting,
  reportPoint,
  onMapClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const reportingRef = useRef(reporting);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
    reportingRef.current = reporting;
  }, [onMapClick, reporting]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;

    void import("maplibre-gl").then((maplibre) => {
      if (disposed || !containerRef.current) return;
      const map = new maplibre.Map({
        container: containerRef.current,
        style: mapStyle(),
        center: [-101.22, 20.86],
        zoom: 8.1,
        maxZoom: 18,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: true }), "bottom-right");
      map.on("click", (event) => {
        if (reportingRef.current) {
          onMapClickRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng });
        }
      });
      map.on("load", () => {
        map.addSource("routes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "route-shadow",
          type: "line",
          source: "routes",
          paint: {
            "line-color": "#f8f5ed",
            "line-width": ["case", ["get", "selected"], 10, 7],
            "line-opacity": 0.92,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "routes",
          paint: {
            "line-color": ["case", ["get", "selected"], "#e06a3b", "#547782"],
            "line-width": ["case", ["get", "selected"], 6, 4],
            "line-opacity": ["case", ["get", "selected"], 1, 0.65],
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addSource("route-points", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "point-rings",
          type: "circle",
          source: "route-points",
          paint: {
            "circle-radius": ["case", ["==", ["get", "kind"], "current"], 11, 9],
            "circle-color": [
              "match",
              ["get", "kind"],
              "origin",
              "#19715f",
              "destination",
              "#e06a3b",
              "current",
              "#1677c8",
              "#d9a441",
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 3,
          },
        });
      });
      mapRef.current = map;
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      (map.getSource("routes") as GeoJSONSource | undefined)?.setData(
        routeGeoJson(routes, selectedRouteId),
      );
      (map.getSource("route-points") as GeoJSONSource | undefined)?.setData(
        pointGeoJson(origin, destination, currentPosition, reportPoint),
      );
    };
    if (map.loaded()) update();
    else map.once("load", update);
  }, [currentPosition, destination, origin, reportPoint, routes, selectedRouteId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    const coordinates = routes.length
      ? routes.flatMap((route) => route.points)
      : ([origin, destination].filter(Boolean) as Coordinate[]);
    if (coordinates.length < 2) return;

    const longitudes = coordinates.map((point) => point.lng);
    const latitudes = coordinates.map((point) => point.lat);
    map.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ],
      { padding: 70, duration: 700, maxZoom: 14 },
    );
  }, [destination, origin, routes]);

  return (
    <div
      ref={containerRef}
      className={`map-canvas${reporting ? " reporting" : ""}`}
      aria-label="Mapa de rutas para camiones"
    />
  );
}
