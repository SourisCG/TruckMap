"use client";

import { useEffect, useId, useState } from "react";

import type { Coordinate, Place } from "@/lib/types";

type PlaceSearchProps = {
  label: string;
  placeholder: string;
  value: Place | null;
  onSelect: (place: Place) => void;
  onChooseOnMap: () => void;
  searchCenter?: Coordinate | null;
};

export function PlaceSearch({
  label,
  placeholder,
  value,
  onSelect,
  onChooseOnMap,
  searchCenter,
}: PlaceSearchProps) {
  const inputId = useId();
  const [query, setQuery] = useState(value?.label ?? "");
  const [places, setPlaces] = useState<Place[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [limitedSearch, setLimitedSearch] = useState(false);

  useEffect(() => {
    if (!focused || query.trim().length < 2 || query === value?.label) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (searchCenter) {
          params.set("lat", String(searchCenter.lat));
          params.set("lng", String(searchCenter.lng));
        }
        const response = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          places?: Place[];
          error?: string;
          warning?: string;
          limited?: boolean;
        };
        if (!response.ok) throw new Error(result.error || "No fue posible buscar esa ubicación.");
        setPlaces(result.places ?? []);
        setLimitedSearch(result.limited === true);
        setSearchError(result.warning || "");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPlaces([]);
        setLimitedSearch(false);
        setSearchError(error instanceof Error ? error.message : "No fue posible buscar esa ubicación.");
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [focused, query, searchCenter, value?.label]);

  return (
    <div className="place-search">
      <label htmlFor={inputId}>{label}</label>
      <div className="input-shell">
        <span className="location-dot" aria-hidden="true" />
        <input
          id={inputId}
          value={focused ? query : value?.label ?? query}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            if (value) setQuery(value.label);
            setFocused(true);
          }}
          onBlur={() => window.setTimeout(() => {
            setFocused(false);
            setPlaces([]);
          }, 160)}
          onChange={(event) => {
            setQuery(event.target.value);
            setPlaces([]);
            setSearchError("");
            setLimitedSearch(false);
          }}
        />
        <button
          type="button"
          className="input-map-button"
          title={`Elegir ${label.toLocaleLowerCase("es-MX")} en el mapa`}
          aria-label={`Elegir ${label.toLocaleLowerCase("es-MX")} en el mapa`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onChooseOnMap}
        >
          ⌖
        </button>
        {loading && <span className="input-loader" aria-label="Buscando" />}
      </div>
      {focused && places.length > 0 && (
        <div className="search-results" role="listbox">
          {places.map((place) => (
            <button
              type="button"
              role="option"
              aria-selected={false}
              key={place.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(place);
                setQuery(place.label);
                setPlaces([]);
                setSearchError("");
                setLimitedSearch(false);
                setFocused(false);
              }}
            >
              <strong>{place.label.split(",")[0]}</strong>
              <span>
                <b>{place.resultLabel || "Ubicación"}</b>
                {place.label.split(",").slice(1).join(",").trim() || "México"}
              </span>
            </button>
          ))}
        </div>
      )}
      {focused && searchError && <div className="search-status search-error">{searchError}</div>}
      {focused && limitedSearch && !searchError && (
        <div className="search-status search-limited">Búsqueda limitada a municipios de Guanajuato.</div>
      )}
      {focused && query.length >= 2 && !loading && places.length === 0 && !searchError && (
        <div className="search-empty">Sin coincidencias. Prueba con calle, número o establecimiento.</div>
      )}
    </div>
  );
}
