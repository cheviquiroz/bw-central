// src/ui/Panels/ReviewGeometry.tsx
//
// Etapa 4b-5 - UI + estructura, 3 sub-tabs (Clash/Duplicidades/
// Distancia), sin detección real todavía (no existe nada de clash/
// duplicidad/clearance en el codebase hoy - ver discovery del brief).
// Cuando esto se conecte de verdad, probablemente reusa el mismo patrón
// Table<T> + adapter que FindingsTable/IssueTable ya usan (ver
// src/ui/components/Table/TABLE_ADAPTER_GUIDE.md) en vez de la lista
// simple de acá.
import { useState } from "react";
import "./review-geometry.css";

type ReviewTab = "clash" | "duplicities" | "clearance";

const TAB_LABEL: Record<ReviewTab, string> = {
  clash: "Clash",
  duplicities: "Duplicidades",
  clearance: "Distancia",
};

const TAB_EMPTY_MESSAGE: Record<ReviewTab, string> = {
  clash: "Sin conflictos detectados",
  duplicities: "Sin duplicidades detectadas",
  clearance: "Sin problemas de distancia",
};

export function ReviewGeometry() {
  const [activeTab, setActiveTab] = useState<ReviewTab>("clash");

  return (
    <div className="review-geometry">
      <div className="review-geometry-tabs">
        {(Object.keys(TAB_LABEL) as ReviewTab[]).map((tab) => (
          <button
            key={tab}
            className={`review-geometry-tab${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      <div className="review-geometry-content">
        <p className="review-geometry-empty">{TAB_EMPTY_MESSAGE[activeTab]}</p>
      </div>
    </div>
  );
}
