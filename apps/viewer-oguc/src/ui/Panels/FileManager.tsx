// src/ui/Panels/FileManager.tsx
//
// Etapa 4b-5 - UI + estructura, sin lógica real todavía (ver el brief:
// "Cargar IFC" es un hook de placeholder, no dispara import). Cuando esto
// se conecte de verdad, el candidato natural es app.importNewModel (ver
// handleFilesSelected en Layout.tsx) - no un import propio nuevo.
import { useState } from "react";
import "./file-manager.css";

export function FileManager() {
  const [files] = useState<string[]>([]);

  return (
    <div className="file-manager">
      <div className="file-manager-header">
        <button className="file-manager-btn-load" disabled>
          Cargar IFC
        </button>
      </div>

      <div className="file-manager-list">
        {files.length === 0 ? (
          <div className="file-manager-empty">No hay archivos cargados</div>
        ) : (
          files.map((file, i) => (
            <div key={i} className="file-manager-item">
              {file}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
