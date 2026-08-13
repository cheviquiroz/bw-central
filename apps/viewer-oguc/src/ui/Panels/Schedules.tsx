// src/ui/Panels/Schedules.tsx
//
// Etapa 4b-5 - UI + mock data. NO reusa Table<T> (src/ui/components/Table)
// a propósito: ese componente es genérico de nombre pero su TableItem es
// específico de Findings/BCF (badge.semantics: "severity"|"status"|
// "priority", metadata.oguc/bcf) - forzar filas de schedule ahí habría
// significado inventar un badge/metadata sin sentido solo para calzar el
// tipo. Una tabla simple (mismo criterio que el brief original) es más
// honesta hasta que exista un dato real de itemizado que decida qué
// columnas/orden necesita de verdad.
import { useState } from "react";
import "./schedules.css";

interface ScheduleItem {
  id: string;
  name: string;
  type: string;
  quantity: number;
}

const MOCK_ITEMS: ScheduleItem[] = [
  { id: "1", name: "Columna A1", type: "Column", quantity: 1 },
  { id: "2", name: "Viga B2", type: "Beam", quantity: 1 },
  { id: "3", name: "Piso 01", type: "Slab", quantity: 1 },
];

export function Schedules() {
  const [items] = useState<ScheduleItem[]>(MOCK_ITEMS);

  return (
    <div className="schedules">
      <div className="schedules-header">
        <button className="schedules-btn-export" disabled>
          Exportar
        </button>
      </div>

      <div className="schedules-table">
        <div className="schedules-row schedules-header-row">
          <div className="schedules-cell">Nombre</div>
          <div className="schedules-cell">Tipo</div>
          <div className="schedules-cell">Cantidad</div>
        </div>
        {items.map((item) => (
          <div key={item.id} className="schedules-row">
            <div className="schedules-cell">{item.name}</div>
            <div className="schedules-cell">{item.type}</div>
            <div className="schedules-cell">{item.quantity}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
