"use client";

import type { HazardousLoad, VehicleProfile } from "@/lib/types";
import { VEHICLE_PRESETS } from "@/lib/vehicle";

type VehicleEditorProps = {
  vehicle: VehicleProfile;
  onChange: (vehicle: VehicleProfile) => void;
};

type NumberField = keyof Pick<
  VehicleProfile,
  | "currentWeightKg"
  | "grossWeightKg"
  | "axleWeightKg"
  | "axles"
  | "heightM"
  | "widthM"
  | "lengthM"
>;

const FIELDS: Array<{
  key: NumberField;
  label: string;
  unit: string;
  step: string;
}> = [
  { key: "currentWeightKg", label: "Peso actual", unit: "kg", step: "100" },
  { key: "grossWeightKg", label: "Peso bruto", unit: "kg", step: "100" },
  { key: "axleWeightKg", label: "Peso por eje", unit: "kg", step: "100" },
  { key: "axles", label: "Número de ejes", unit: "ejes", step: "1" },
  { key: "heightM", label: "Altura", unit: "m", step: "0.01" },
  { key: "widthM", label: "Ancho", unit: "m", step: "0.01" },
  { key: "lengthM", label: "Longitud", unit: "m", step: "0.1" },
];

const HAZARDOUS_LABELS: Record<HazardousLoad, string> = {
  none: "Sin material peligroso",
  general: "Material peligroso general",
  explosive: "Explosivos",
  flammable: "Inflamables",
  harmfulToWater: "Contaminante del agua",
};

export function VehicleEditor({ vehicle, onChange }: VehicleEditorProps) {
  function updateNumber(key: NumberField, value: string) {
    onChange({ ...vehicle, [key]: Number(value) });
  }

  return (
    <div className="vehicle-editor">
      <div className="preset-list" aria-label="Tipos de camión">
        {Object.entries(VEHICLE_PRESETS).map(([id, preset]) => (
          <button
            type="button"
            key={id}
            className={vehicle.configuration === preset.configuration ? "active" : ""}
            onClick={() => onChange({ ...preset, hazardousLoad: vehicle.hazardousLoad })}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="vehicle-grid">
        {FIELDS.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <span className="number-input">
              <input
                type="number"
                inputMode="decimal"
                value={vehicle[field.key]}
                min="0"
                step={field.step}
                onChange={(event) => updateNumber(field.key, event.target.value)}
              />
              <small>{field.unit}</small>
            </span>
          </label>
        ))}
      </div>

      <label className="hazardous-field">
        <span>Tipo de carga</span>
        <select
          value={vehicle.hazardousLoad}
          onChange={(event) =>
            onChange({ ...vehicle, hazardousLoad: event.target.value as HazardousLoad })
          }
        >
          {Object.entries(HAZARDOUS_LABELS).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="form-note">
        Captura las medidas reales. Un valor incorrecto puede producir una ruta no apta.
      </p>
    </div>
  );
}
