"use client";

import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import type { Coordinate, Place, PositionFix, RouteAlternative } from "@/lib/types";
import type { ResolvedTheme } from "@/lib/theme";

type SelectionMode = "origin" | "destination" | null;

type MapViewProps = {
  origin: Place | null;
  destination: Place | null;
  routes: RouteAlternative[];
  selectedRouteId: string | null;
  currentPosition: PositionFix | null;
  reporting: boolean;
  selectionMode: SelectionMode;
  reportPoint: Coordinate | null;
  navigationActive: boolean;
  followCamera: boolean;
  recenterRequest: number;
  theme: ResolvedTheme;
  onMapClick: (point: Coordinate) => void;
  onSelectPoint: (point: Coordinate) => void;
  onUserMove: () => void;
};

function mapStyle(theme: ResolvedTheme): StyleSpecification {
  const key = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
  if (!key) {
    return {
      version: 8,
      sources: {
        carto: {
          type: "raster",
          tiles: [
            `https://a.basemaps.cartocdn.com/${theme === "dark" ? "dark_all" : "light_all"}/{z}/{x}/{y}@2x.png`,
          ],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors © CARTO",
        },
      },
      layers: [{ id: "carto", type: "raster", source: "carto" }],
    };
  }

  return {
    version: 8,
    sources: {
      tomtom: {
        type: "raster",
        tiles: [
          `https://api.tomtom.com/map/1/tile/basic/${theme === "dark" ? "night" : "main"}/{z}/{x}/{y}.png?key=${key}`,
        ],
        tileSize: 256,
        attribution: "© TomTom",
      },
    },
    layers: [{ id: "tomtom", type: "raster", source: "tomtom" }],
  };
}

function routeGeoJson(routes: RouteAlternative[], selectedRouteId: string | null) {
  return {
    type: "FeatureCollection" as const,
    features: routes
      .filter((route) => route.points.length > 1)
      .map((route) => ({
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
  currentPosition: PositionFix | null,
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

function syncOverlayData(map: MapLibreMap, routeData: ReturnType<typeof routeGeoJson>, pointData: ReturnType<typeof pointGeoJson>) {
  (map.getSource("routes") as GeoJSONSource | undefined)?.setData(routeData);
  (map.getSource("route-points") as GeoJSONSource | undefined)?.setData(pointData);
}

function fitRouteData(map: MapLibreMap, routeData: ReturnType<typeof routeGeoJson>) {
  const coordinates = routeData.features.flatMap((feature) => feature.geometry.coordinates);
  if (coordinates.length < 2) return;

  const longitudes = coordinates.map(([lng]) => lng);
  const latitudes = coordinates.map(([, lat]) => lat);
  map.fitBounds(
    [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ],
    { padding: 70, duration: 700, maxZoom: 14 },
  );
}

type ProjectedRoute = {
  id: string;
  selected: boolean;
  path: string;
};

type ProjectedPoint = {
  id: string;
  kind: string;
  x: number;
  y: number;
};

function projectRouteData(map: MapLibreMap, routeData: ReturnType<typeof routeGeoJson>) {
  return routeData.features.map((feature, index) => {
    const points = feature.geometry.coordinates.map(([lng, lat]) => map.project([lng, lat]));
    return {
      id: `projected-route-${index}`,
      selected: feature.properties.selected,
      path: points.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" "),
    } satisfies ProjectedRoute;
  });
}

function projectPointData(
  map: MapLibreMap,
  origin: Place | null,
  destination: Place | null,
  currentPosition: PositionFix | null,
  reportPoint: Coordinate | null,
) {
  const entries = [
    origin && { point: origin, kind: "origin" },
    destination && { point: destination, kind: "destination" },
    currentPosition && { point: currentPosition, kind: "current" },
    reportPoint && { point: reportPoint, kind: "report" },
  ].filter(Boolean) as Array<{ point: Coordinate; kind: string }>;

  return entries.map(({ point, kind }, index) => {
    const projected = map.project([point.lng, point.lat]);
    return { id: `projected-point-${kind}-${index}`, kind, x: projected.x, y: projected.y };
  }) satisfies ProjectedPoint[];
}

function ensureOverlayLayers(map: MapLibreMap) {
  if (!map.getSource("routes")) {
    map.addSource("routes", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer("route-shadow")) {
    map.addLayer({
      id: "route-shadow",
      type: "line",
      source: "routes",
      paint: {
        "line-color": "#fffdf8",
        "line-width": ["case", ["get", "selected"], 12, 8],
        "line-opacity": 0.95,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }
  if (!map.getLayer("route-line")) {
    map.addLayer({
      id: "route-line",
      type: "line",
      source: "routes",
      paint: {
        "line-color": ["case", ["get", "selected"], "#e06a3b", "#547782"],
        "line-width": ["case", ["get", "selected"], 7, 4],
        "line-opacity": ["case", ["get", "selected"], 1, 0.6],
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }
  if (!map.getSource("route-points")) {
    map.addSource("route-points", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer("point-rings")) {
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
  }
}

export function MapView({
  origin,
  destination,
  routes,
  selectedRouteId,
  currentPosition,
  reporting,
  selectionMode,
  reportPoint,
  navigationActive,
  followCamera,
  recenterRequest,
  theme,
  onMapClick,
  onSelectPoint,
  onUserMove,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleReadyRef = useRef(false);
  const [projectedRoutes, setProjectedRoutes] = useState<ProjectedRoute[]>([]);
  const [projectedPoints, setProjectedPoints] = useState<ProjectedPoint[]>([]);
  const routeDataRef = useRef(routeGeoJson(routes, selectedRouteId));
  const pointDataRef = useRef(pointGeoJson(origin, destination, currentPosition, reportPoint));
  const onMapClickRef = useRef(onMapClick);
  const onSelectPointRef = useRef(onSelectPoint);
  const onUserMoveRef = useRef(onUserMove);
  const reportingRef = useRef(reporting);
  const selectionModeRef = useRef(selectionMode);
  const navigationActiveRef = useRef(navigationActive);
  const themeRef = useRef(theme);
  const originRef = useRef(origin);
  const destinationRef = useRef(destination);
  const currentPositionRef = useRef(currentPosition);
  const reportPointRef = useRef(reportPoint);

  useEffect(() => {
    routeDataRef.current = routeGeoJson(routes, selectedRouteId);
    pointDataRef.current = pointGeoJson(origin, destination, currentPosition, reportPoint);
    onMapClickRef.current = onMapClick;
    onSelectPointRef.current = onSelectPoint;
    onUserMoveRef.current = onUserMove;
    reportingRef.current = reporting;
    selectionModeRef.current = selectionMode;
    navigationActiveRef.current = navigationActive;
    originRef.current = origin;
    destinationRef.current = destination;
    currentPositionRef.current = currentPosition;
    reportPointRef.current = reportPoint;
  }, [
    currentPosition,
    destination,
    navigationActive,
    onMapClick,
    onSelectPoint,
    onUserMove,
    origin,
    reportPoint,
    reporting,
    routes,
    selectedRouteId,
    selectionMode,
  ]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;

    void import("maplibre-gl").then((maplibre) => {
      if (disposed || !containerRef.current) return;
      const map = new maplibre.Map({
        container: containerRef.current,
        style: mapStyle(themeRef.current),
        center: [-101.22, 20.86],
        zoom: 8.1,
        maxZoom: 18,
        attributionControl: { compact: true },
      });
      const updateProjection = () => {
        setProjectedRoutes(projectRouteData(map, routeDataRef.current));
        setProjectedPoints(
          projectPointData(
            map,
            originRef.current,
            destinationRef.current,
            currentPositionRef.current,
            reportPointRef.current,
          ),
        );
      };
      const restoreOverlays = () => {
        styleReadyRef.current = true;
        ensureOverlayLayers(map);
        syncOverlayData(map, routeDataRef.current, pointDataRef.current);
        updateProjection();
        if (!navigationActiveRef.current) fitRouteData(map, routeDataRef.current);
      };
      map.on("load", restoreOverlays);
      map.on("style.load", restoreOverlays);
      map.on("move", updateProjection);
      map.on("resize", updateProjection);
      map.on("rotate", updateProjection);
      map.on("pitch", updateProjection);
      map.addControl(new maplibre.NavigationControl({ showCompass: true }), "bottom-right");
      map.on("click", (event) => {
        const point = { lat: event.lngLat.lat, lng: event.lngLat.lng };
        if (selectionModeRef.current) {
          onSelectPointRef.current(point);
        } else if (reportingRef.current) {
          onMapClickRef.current(point);
        }
      });
      map.on("dragstart", () => {
        if (navigationActiveRef.current) onUserMoveRef.current();
      });
      map.on("rotatestart", () => {
        if (navigationActiveRef.current) onUserMoveRef.current();
      });
      map.on("pitchstart", () => {
        if (navigationActiveRef.current) onUserMoveRef.current();
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
    routeDataRef.current = routeGeoJson(routes, selectedRouteId);
    pointDataRef.current = pointGeoJson(origin, destination, currentPosition, reportPoint);
    const update = () => {
      ensureOverlayLayers(map);
      syncOverlayData(map, routeDataRef.current, pointDataRef.current);
      setProjectedRoutes(projectRouteData(map, routeDataRef.current));
      setProjectedPoints(
        projectPointData(map, origin, destination, currentPosition, reportPoint),
      );
      if (!navigationActiveRef.current) fitRouteData(map, routeDataRef.current);
    };
    if (styleReadyRef.current) queueMicrotask(update);
    else map.once("style.load", update);
  }, [currentPosition, destination, origin, reportPoint, routes, selectedRouteId]);

  useEffect(() => {
    const map = mapRef.current;
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    if (!map) return;
    styleReadyRef.current = false;
    queueMicrotask(() => {
      setProjectedRoutes([]);
      setProjectedPoints([]);
    });
    map.setStyle(mapStyle(theme));
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || navigationActive) return;
    const coordinates = routes.length
      ? routes.flatMap((route) => route.points)
      : ([origin, destination].filter(Boolean) as Coordinate[]);
    if (coordinates.length < 2) return;

    const fit = () => {
      if (!styleReadyRef.current) return;
      const longitudes = coordinates.map((point) => point.lng);
      const latitudes = coordinates.map((point) => point.lat);
      map.fitBounds(
        [
          [Math.min(...longitudes), Math.min(...latitudes)],
          [Math.max(...longitudes), Math.max(...latitudes)],
        ],
        { padding: 70, duration: 700, maxZoom: 14 },
      );
    };
    if (styleReadyRef.current) fit();
    else map.once("style.load", fit);
  }, [destination, navigationActive, origin, routes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !navigationActive || !followCamera || !currentPosition) return;
    const follow = () => {
      if (!styleReadyRef.current) return;
      map.easeTo({
        center: [currentPosition.lng, currentPosition.lat],
        zoom: 16,
        bearing: currentPosition.heading ?? map.getBearing(),
        pitch: 48,
        offset: [0, 115],
        duration: recenterRequest > 0 ? 450 : 650,
        essential: true,
      });
    };
    if (styleReadyRef.current) follow();
    else map.once("style.load", follow);
  }, [currentPosition, followCamera, navigationActive, recenterRequest, theme]);

  return (
    <>
      <div
        ref={containerRef}
        className={`map-canvas${reporting || selectionMode ? " reporting" : ""}`}
        aria-label="Mapa de rutas para camiones"
      />
      <svg className="route-overlay" aria-hidden="true">
        {projectedRoutes.map((route) => (
          <g key={route.id} className={route.selected ? "projected-route selected" : "projected-route"}>
            <path className="projected-route-shadow" d={route.path} />
            <path className="projected-route-line" d={route.path} />
          </g>
        ))}
        {projectedPoints.map((point) => (
          <circle
            key={point.id}
            className={`projected-point projected-point-${point.kind}`}
            cx={point.x}
            cy={point.y}
            r={point.kind === "current" ? 11 : 9}
          />
        ))}
      </svg>
    </>
  );
}
