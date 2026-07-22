"use client";

import { useEffect, useId, useState } from "react";

import type { Place } from "@/lib/types";

type PlaceSearchProps = {
  label: string;
  placeholder: string;
  value: Place | null;
  onSelect: (place: Place) => void;
};

export function PlaceSearch({ label, placeholder, value, onSelect }: PlaceSearchProps) {
  const inputId = useId();
  const [query, setQuery] = useState(value?.label ?? "");
  const [places, setPlaces] = useState<Place[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!focused || query.trim().length < 2 || query === value?.label) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const result = (await response.json()) as { places?: Place[] };
        setPlaces(result.places ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPlaces([]);
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [focused, query, value?.label]);

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
          }}
        />
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
                setFocused(false);
              }}
            >
              <strong>{place.label.split(",")[0]}</strong>
              <span>{place.label.split(",").slice(1).join(",").trim() || "México"}</span>
            </button>
          ))}
        </div>
      )}
      {focused && query.length >= 2 && !loading && places.length === 0 && query !== value?.label && (
        <div className="search-empty">Sin coincidencias. Prueba con un municipio cercano.</div>
      )}
    </div>
  );
}
