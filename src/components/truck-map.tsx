"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { bearingDegrees, distanceMeters, nearestPointIndex } from "@/lib/geo";
import type {
  Coordinate,
  Place,
  PositionFix,
  RouteAlternative,
  VehicleProfile,
} from "@/lib/types";
import { resolveTheme, type ResolvedTheme, type ThemePreference } from "@/lib/theme";
import { DEFAULT_VEHICLE, vehicleProfileSchema } from "@/lib/vehicle";
import { MapView } from "@/components/map-view";
import { PlaceSearch } from "@/components/place-search";
import { SuggestionDialog } from "@/components/suggestion-dialog";
import { VehicleEditor } from "@/components/vehicle-editor";

function formatDistance(meters: number) {
  if (meters < 1_000) return `${Math.round(meters)} m`;
  return `${(meters / 1_000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours} h ${remaining ? `${remaining} min` : ""}`.trim();
}

export function TruckMap() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [vehicle, setVehicle] = useState<VehicleProfile>(DEFAULT_VEHICLE);
  const [routes, setRoutes] = useState<RouteAlternative[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [currentPosition, setCurrentPosition] = useState<PositionFix | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportPoint, setReportPoint] = useState<Coordinate | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [selectionMode, setSelectionMode] = useState<"origin" | "destination" | null>(null);
  const [followCamera, setFollowCamera] = useState(true);
  const [recenterRequest, setRecenterRequest] = useState(0);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const deviationSamples = useRef(0);
  const lastRerouteAt = useRef(0);
  const lastFixRef = useRef<PositionFix | null>(null);

  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? routes[0] ?? null;
  const progress = selectedRoute && currentPosition
    ? nearestPointIndex(currentPosition, selectedRoute.points)
    : null;
  const nextInstruction = selectedRoute && progress
    ? selectedRoute.instructions.find(
        (instruction) => instruction.routePointIndex > progress.index + 1,
      ) ?? selectedRoute.instructions.at(-1)
    : selectedRoute?.instructions[0];
  const progressRatio = selectedRoute && progress
    ? Math.min(progress.index / Math.max(selectedRoute.points.length - 1, 1), 1)
    : 0;

  useEffect(() => {
    const saved = window.localStorage.getItem("truckmap-vehicle");
    if (!saved) return;
    try {
      const parsed = vehicleProfileSchema.safeParse(JSON.parse(saved));
      if (parsed.success) queueMicrotask(() => setVehicle(parsed.data));
    } catch {
      window.localStorage.removeItem("truckmap-vehicle");
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("truckmap-theme");
    const preference: ThemePreference = saved === "light" || saved === "dark" ? saved : "system";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    queueMicrotask(() => {
      setThemePreference(preference);
      setResolvedTheme(resolveTheme(preference, media.matches));
    });
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setResolvedTheme(resolveTheme(themePreference, media.matches));
    queueMicrotask(update);
    const handleChange = () => update();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [themePreference]);

  useEffect(() => {
    window.localStorage.setItem("truckmap-theme", themePreference);
    document.documentElement.dataset.theme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      resolvedTheme === "dark" ? "#0c1d25" : "#112a35",
    );
  }, [resolvedTheme, themePreference]);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const parsePlace = (coordinates: string | null, label: string | null, id: string) => {
      if (!coordinates) return null;
      const [lat, lng] = coordinates.split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { id, label: label || "Punto compartido", lat, lng } satisfies Place;
    };
    const sharedOrigin = parsePlace(parameters.get("o"), parameters.get("ol"), "shared-origin");
    const sharedDestination = parsePlace(parameters.get("d"), parameters.get("dl"), "shared-destination");
    if (sharedOrigin || sharedDestination) {
      queueMicrotask(() => {
        if (sharedOrigin) setOrigin(sharedOrigin);
        if (sharedDestination) setDestination(sharedDestination);
      });
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("truckmap-vehicle", JSON.stringify(vehicle));
  }, [vehicle]);

  async function requestRoutes(routeOrigin: Coordinate, isReroute = false) {
    if (!destination) return;
    const validation = vehicleProfileSchema.safeParse(vehicle);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Revisa las medidas del vehículo.");
      setVehicleOpen(true);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: routeOrigin,
          destination: { lat: destination.lat, lng: destination.lng },
          vehicle: validation.data,
        }),
      });
      const result = (await response.json()) as { routes?: RouteAlternative[]; error?: string };
      if (!response.ok || !result.routes?.length) {
        throw new Error(result.error || "No se encontró una ruta compatible.");
      }
      setRoutes(result.routes);
      setSelectedRouteId(result.routes[0].id);
      if (isReroute && voiceEnabled && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance("Ruta actualizada"));
      }
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "No se encontró una ruta.");
      if (!isReroute) setRoutes([]);
    } finally {
      setLoading(false);
    }
  }

  function calculate() {
    if (!origin || !destination) {
      setError("Selecciona un origen y un destino.");
      return;
    }
    void requestRoutes({ lat: origin.lat, lng: origin.lng });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Este navegador no permite obtener la ubicación.");
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lng: coords.longitude };
        const place: Place = {
          id: "current-location",
          label: "Mi ubicación actual",
          ...point,
        };
        const position: PositionFix = {
          ...point,
          accuracy: coords.accuracy,
          heading: Number.isFinite(coords.heading) ? coords.heading : null,
          speed: Number.isFinite(coords.speed) ? coords.speed : null,
          timestamp: Date.now(),
        };
        setOrigin(place);
        lastFixRef.current = position;
        setCurrentPosition(position);
      },
      () => setError("Activa el permiso de ubicación para usar tu posición."),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 15_000 },
    );
  }

  useEffect(() => {
    if (!navigating) return;
    if (!navigator.geolocation) return;

    let wakeLock: WakeLockSentinel | null = null;
    if ("wakeLock" in navigator) {
      void navigator.wakeLock.request("screen").then((sentinel) => {
        wakeLock = sentinel;
      }).catch(() => undefined);
    }
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lng: coords.longitude };
        const previous = lastFixRef.current;
        const gpsHeading = Number.isFinite(coords.heading) ? coords.heading : null;
        const position: PositionFix = {
          ...point,
          accuracy: coords.accuracy,
          heading: gpsHeading ?? (previous ? bearingDegrees(previous, point) : null),
          speed: Number.isFinite(coords.speed) ? coords.speed : null,
          timestamp: Date.now(),
        };
        lastFixRef.current = position;
        setCurrentPosition(position);
        if (destination && distanceMeters(point, destination) <= 45) {
          setNavigating(false);
          if (voiceEnabled && "speechSynthesis" in window) {
            window.speechSynthesis.speak(
              new SpeechSynthesisUtterance("Has llegado a tu destino"),
            );
          }
        }
      },
      () => setError("Se perdió la señal GPS. Mantén la aplicación abierta."),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 3_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      void wakeLock?.release();
    };
  }, [destination, navigating, voiceEnabled]);

  const reroute = useEffectEvent((position: Coordinate) => {
    void requestRoutes(position, true);
  });

  useEffect(() => {
    if (!navigating || !selectedRoute || !currentPosition || loading) return;
    const nearest = nearestPointIndex(currentPosition, selectedRoute.points);
    if (nearest.distance < 120) {
      deviationSamples.current = 0;
      return;
    }

    deviationSamples.current += 1;
    const now = Date.now();
    if (deviationSamples.current >= 3 && now - lastRerouteAt.current > 30_000) {
      lastRerouteAt.current = now;
      deviationSamples.current = 0;
      reroute(currentPosition);
    }
  }, [currentPosition, loading, navigating, selectedRoute]);

  useEffect(() => {
    if (!navigating || !voiceEnabled || !nextInstruction || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(nextInstruction.text);
    utterance.lang = "es-MX";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [navigating, nextInstruction, voiceEnabled]);

  function startNavigation() {
    if (!navigator.geolocation) {
      setError("Este navegador no permite navegación GPS.");
      return;
    }
    setError("");
    setFollowCamera(true);
    setRecenterRequest((request) => request + 1);
    setNavigating(true);
  }

  function recenterNavigation() {
    setFollowCamera(true);
    setRecenterRequest((request) => request + 1);
  }

  async function selectPointOnMap(point: Coordinate) {
    const target = selectionMode;
    if (!target) return;
    setSelectionMode(null);
    setError("");

    try {
      const response = await fetch(`/api/reverse-geocode?lat=${point.lat}&lng=${point.lng}`);
      const result = (await response.json()) as { place?: Place; error?: string };
      if (!response.ok) throw new Error(result.error || "No fue posible identificar el punto.");
      const place: Place = result.place ?? {
        id: `map-${point.lat}-${point.lng}`,
        label: "Punto seleccionado en el mapa",
        resultLabel: "Punto del mapa",
        resultType: "map",
        source: "map",
        ...point,
      };
      if (target === "origin") setOrigin(place);
      else setDestination(place);
    } catch {
      const place: Place = {
        id: `map-${point.lat}-${point.lng}`,
        label: "Punto seleccionado en el mapa",
        resultLabel: "Punto del mapa",
        resultType: "map",
        source: "map",
        ...point,
      };
      if (target === "origin") setOrigin(place);
      else setDestination(place);
    }
  }

  async function shareRoute() {
    if (!origin || !destination) return;
    const url = new URL(window.location.origin);
    url.searchParams.set("o", `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`);
    url.searchParams.set("ol", origin.label);
    url.searchParams.set("d", `${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`);
    url.searchParams.set("dl", destination.label);
    const shareData = {
      title: "Ruta de TruckMap México",
      text: `${origin.label} a ${destination.label}`,
      url: url.toString(),
    };
    try {
      const canUseNativeShare = typeof navigator.share === "function";
      if (canUseNativeShare) await navigator.share(shareData);
      else await navigator.clipboard.writeText(url.toString());
      setShareStatus(canUseNativeShare ? "Ruta compartida" : "Enlace copiado");
      window.setTimeout(() => setShareStatus(""), 2_000);
    } catch {
      setShareStatus("");
    }
  }

  return (
    <main className="app-shell">
      <MapView
        origin={origin}
        destination={destination}
        routes={routes}
        selectedRouteId={selectedRoute?.id ?? null}
        currentPosition={currentPosition}
        reporting={reporting}
        selectionMode={selectionMode}
        reportPoint={reportPoint}
        navigationActive={navigating}
        followCamera={followCamera}
        recenterRequest={recenterRequest}
        theme={resolvedTheme}
        onSelectPoint={(point) => void selectPointOnMap(point)}
        onUserMove={() => setFollowCamera(false)}
        onMapClick={(point) => {
          setReportPoint(point);
          setReporting(false);
        }}
      />

      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span /></div>
        <div>
          <strong>TRUCKMAP</strong>
          <small>MÉXICO</small>
        </div>
        <span className="beta-badge">BETA GUANAJUATO</span>
        <label className="theme-control">
          <span className="sr-only">Tema</span>
          <select
            aria-label="Tema de la aplicación"
            value={themePreference}
            onChange={(event) => setThemePreference(event.target.value as ThemePreference)}
          >
            <option value="system">Automático</option>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </label>
      </header>

      {!navigating && (
        <section className="planner-panel" aria-label="Planificador de ruta">
          <div className="panel-handle" />
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Ruta compatible</p>
              <h1>¿A dónde llevas la carga?</h1>
            </div>
            <button type="button" className="locate-button" onClick={useMyLocation} title="Usar mi ubicación">
              <span aria-hidden="true">◎</span>
              <span>Mi ubicación</span>
            </button>
          </div>

          <div className="route-inputs">
            <PlaceSearch
              label="Origen"
              placeholder="Ciudad, empresa o dirección"
              value={origin}
              onSelect={setOrigin}
              onChooseOnMap={() => {
                setReporting(false);
                setSelectionMode("origin");
              }}
              searchCenter={currentPosition}
            />
            <button
              type="button"
              className="swap-button"
              title="Intercambiar origen y destino"
              onClick={() => {
                setOrigin(destination);
                setDestination(origin);
              }}
            >
              ⇅
            </button>
            <PlaceSearch
              label="Destino"
              placeholder="¿A dónde vas?"
              value={destination}
              onSelect={setDestination}
              onChooseOnMap={() => {
                setReporting(false);
                setSelectionMode("destination");
              }}
              searchCenter={currentPosition}
            />
          </div>

          <button type="button" className="vehicle-summary" onClick={() => setVehicleOpen(!vehicleOpen)}>
            <span className="truck-symbol" aria-hidden="true">▰</span>
            <span>
              <small>Vehículo</small>
              <strong>{vehicle.name} · {(vehicle.currentWeightKg / 1_000).toFixed(1)} t · {vehicle.heightM} m</strong>
            </span>
            <span aria-hidden="true">{vehicleOpen ? "−" : "+"}</span>
          </button>
          {vehicleOpen && <VehicleEditor vehicle={vehicle} onChange={setVehicle} />}

          {error && <p className="route-error">{error}</p>}

          {routes.length > 0 && (
            <div className="route-results">
              {routes.map((route, index) => (
                <button
                  type="button"
                  key={route.id}
                  className={route.id === selectedRoute?.id ? "route-card selected" : "route-card"}
                  onClick={() => setSelectedRouteId(route.id)}
                >
                  <span>
                    <small>{index === 0 ? "Recomendada" : `Alternativa ${index + 1}`}</small>
                    <strong>{formatDuration(route.durationSeconds)}</strong>
                  </span>
                  <span>
                    <strong>{formatDistance(route.distanceMeters)}</strong>
                    <small>{route.hasTolls ? "Incluye peaje" : "Sin peaje detectado"}</small>
                  </span>
                  <em className={`confidence ${route.validation.level}`}>{route.validation.label}</em>
                </button>
              ))}
            </div>
          )}

          <div className="planner-actions">
            <button type="button" className="primary-button" onClick={calculate} disabled={loading}>
              {loading ? "Calculando ruta..." : routes.length ? "Actualizar ruta" : "Calcular ruta"}
            </button>
            {selectedRoute && (
              <button type="button" className="start-button" onClick={startNavigation}>
                Iniciar GPS
              </button>
            )}
          </div>
          {selectedRoute && (
            <button type="button" className="share-route" onClick={() => void shareRoute()}>
              {shareStatus || "Compartir origen y destino"}
            </button>
          )}
          <p className="safety-note">
            Ruta orientativa según datos disponibles. Respeta siempre la señalización y las indicaciones de la autoridad.
          </p>
          <details className="data-sources">
            <summary>Fuentes y alcance de la beta</summary>
            <p>
              Motor TomTom para rutas y tráfico. Referencia cartográfica: Red Nacional de Caminos
              de INEGI y Red Vial de Guanajuato de IPLANEG. Aún no existe garantía legal de tránsito.
            </p>
            <a href="https://www.inegi.org.mx/programas/rnc/" target="_blank" rel="noreferrer">INEGI</a>
            <a href="https://geoinfo.iplaneg.net/layers/geonode:red_vial_gto" target="_blank" rel="noreferrer">IPLANEG</a>
          </details>
        </section>
      )}

      {navigating && selectedRoute && (
        <section className="navigation-card" aria-live="polite">
          <div className="navigation-progress" style={{ width: `${progressRatio * 100}%` }} />
          <div className="navigation-instruction">
            <span className="turn-symbol" aria-hidden="true">↱</span>
            <div>
              <small>
                {nextInstruction && currentPosition
                  ? formatDistance(distanceMeters(currentPosition, nextInstruction))
                  : "En ruta"}
              </small>
              <strong>{nextInstruction?.text ?? "Continúa por la ruta indicada"}</strong>
            </div>
          </div>
          <div className="navigation-summary">
            <span><strong>{formatDuration(selectedRoute.durationSeconds * (1 - progressRatio))}</strong><small>restantes</small></span>
            <span><strong>{formatDistance(selectedRoute.distanceMeters * (1 - progressRatio))}</strong><small>distancia</small></span>
            <button type="button" onClick={() => setVoiceEnabled(!voiceEnabled)}>{voiceEnabled ? "Voz activa" : "Voz apagada"}</button>
            {!followCamera && <button type="button" onClick={recenterNavigation}>Recentrar</button>}
            <button type="button" className="stop-navigation" onClick={() => setNavigating(false)}>Salir</button>
          </div>
        </section>
      )}

      <button
        type="button"
        className={reporting ? "report-button active" : "report-button"}
        onClick={() => {
          setReporting(!reporting);
          setSelectionMode(null);
          setReportPoint(null);
        }}
      >
        <span aria-hidden="true">!</span>
        {reporting ? "Toca el punto en el mapa" : "Reportar"}
      </button>

      {(reporting || selectionMode) && (
        <div className="map-prompt">
          {selectionMode
            ? `Toca el mapa para elegir ${selectionMode === "origin" ? "el origen" : "el destino"}`
            : "Selecciona en el mapa el lugar de la sugerencia"}
        </div>
      )}
      <SuggestionDialog point={reportPoint} onClose={() => setReportPoint(null)} />
    </main>
  );
}
