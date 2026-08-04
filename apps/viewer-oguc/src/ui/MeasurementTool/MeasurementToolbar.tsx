// src/ui/MeasurementTool/MeasurementToolbar.tsx
import type { Measurement, MeasurementType } from "../../viewer/MeasurementManager";
import "./measurement-toolbar.css";

interface MeasurementToolbarProps {
  mode: MeasurementType;
  onModeChange: (mode: MeasurementType) => void;
  onClearAll: () => void;
  onFinishArea: () => void;
  measurements: Measurement[];
  currentPointCount: number;
}

const MODE_LABEL: Record<MeasurementType, string> = {
  distance: "Distancia",
  area: "Área",
};

export function MeasurementToolbar({
  mode,
  onModeChange,
  onClearAll,
  onFinishArea,
  measurements,
  currentPointCount,
}: MeasurementToolbarProps) {
  return (
    <div className="measurement-toolbar">
      <div className="measure-status">
        <span className="measure-mode">{MODE_LABEL[mode]}</span>
        <span className="measure-count">({measurements.length} medición{measurements.length === 1 ? "" : "es"})</span>
      </div>

      <div className="measure-controls">
        <button
          className={`measure-btn${mode === "distance" ? " active" : ""}`}
          onClick={() => onModeChange("distance")}
        >
          Distancia
        </button>
        <button
          className={`measure-btn${mode === "area" ? " active" : ""}`}
          onClick={() => onModeChange("area")}
        >
          Área
        </button>
        <button className="measure-btn clear" onClick={onClearAll}>
          Limpiar
        </button>
      </div>

      {mode === "distance" && (
        <p className="measure-hint">
          {currentPointCount === 0 ? "Click en el modelo para el primer punto" : "Click en el segundo punto para medir"}
        </p>
      )}

      {mode === "area" && (
        <p className="measure-hint">
          {currentPointCount < 3
            ? `Click para agregar vértices (${currentPointCount} de al menos 3)`
            : `${currentPointCount} vértices — seguí agregando o cerrá el área`}
          {currentPointCount >= 3 && (
            <button className="measure-finish-link" onClick={onFinishArea}>
              Cerrar área
            </button>
          )}
        </p>
      )}

      {measurements.length > 0 && (
        <div className="measure-list">
          <div className="measure-list-title">Historial</div>
          {measurements.map((m) => (
            <div key={m.id} className="measure-item">
              <span className={`measure-item-dot ${m.type}`} />
              {m.value.toFixed(2)} {m.unit}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
