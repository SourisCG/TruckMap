"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import type { Coordinate } from "@/lib/types";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; theme: string },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type SuggestionDialogProps = {
  point: Coordinate | null;
  onClose: () => void;
};

export function SuggestionDialog({ point, onClose }: SuggestionDialogProps) {
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!point || !siteKey || !turnstileContainer.current) return;
    let widgetId = "";
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.turnstile || !turnstileContainer.current || widgetId) return;
      widgetId = window.turnstile.render(turnstileContainer.current, {
        sitekey: siteKey,
        callback: setTurnstileToken,
        theme: "light",
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (existingScript) {
      if (window.turnstile) render();
      else existingScript.addEventListener("load", render, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = "true";
      script.addEventListener("load", render, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [point, siteKey]);

  if (!point) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.get("category"),
          description: form.get("description"),
          sourceUrl: form.get("sourceUrl"),
          contactEmail: form.get("contactEmail"),
          location: point,
          turnstileToken,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "No fue posible enviar el reporte.");
      setStatus("sent");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No fue posible enviar el reporte.");
      setStatus("error");
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="suggestion-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggestion-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
        {status === "sent" ? (
          <div className="sent-message">
            <span aria-hidden="true">✓</span>
            <h2 id="suggestion-title">Reporte enviado</h2>
            <p>Se revisará con una fuente oficial antes de modificar las rutas.</p>
            <button type="button" className="primary-button" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <p className="eyebrow">Colaboración vial</p>
            <h2 id="suggestion-title">Reportar este punto</h2>
            <p className="dialog-intro">
              Coordenadas {point.lat.toFixed(5)}, {point.lng.toFixed(5)}. El reporte no se
              publicará automáticamente.
            </p>
            <form onSubmit={submit}>
              <label>
                Tipo de reporte
                <select name="category" required defaultValue="restriction">
                  <option value="restriction">Restricción para camiones</option>
                  <option value="closure">Cierre o bloqueo</option>
                  <option value="dimension">Límite de peso o dimensiones</option>
                  <option value="allowed_route">Ruta permitida</option>
                  <option value="map_error">Error en el mapa</option>
                </select>
              </label>
              <label>
                Descripción
                <textarea
                  name="description"
                  required
                  minLength={20}
                  maxLength={2000}
                  rows={5}
                  placeholder="Describe la señal, el horario y los vehículos afectados..."
                />
              </label>
              <label>
                Enlace a una fuente oficial <span>Opcional</span>
                <input name="sourceUrl" type="url" placeholder="https://..." />
              </label>
              <label>
                Correo de contacto <span>Opcional</span>
                <input name="contactEmail" type="email" placeholder="operador@empresa.mx" />
              </label>
              {siteKey && <div ref={turnstileContainer} className="turnstile-container" />}
              {error && <p className="form-error">{error}</p>}
              <button
                type="submit"
                className="primary-button"
                disabled={status === "sending" || Boolean(siteKey && !turnstileToken)}
              >
                {status === "sending" ? "Enviando..." : "Enviar para revisión"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
