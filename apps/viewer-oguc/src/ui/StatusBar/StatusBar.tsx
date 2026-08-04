// src/ui/StatusBar/StatusBar.tsx
import { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import type { ModelDisplayNames, SelectionState } from "../../engine/createApplication";
import "./status-bar.css";

export function StatusBar() {
  const app = useApp();
  const [displayNames, setDisplayNames] = useState<ModelDisplayNames>(app.getModelDisplayNames());
  const [selection, setSelection] = useState<SelectionState>(app.getSelection());

  useEffect(() => {
    const unsubNames = app.subscribeToModelDisplayNames(setDisplayNames);
    const unsubSelection = app.subscribeToSelection(setSelection);
    return () => {
      unsubNames();
      unsubSelection();
    };
  }, [app]);

  const modelsCount = Object.keys(displayNames).length;
  const selectionCount = Object.values(selection).reduce((sum, guids) => sum + guids.length, 0);

  // Sin instrumentación real todavía en el engine (no hay conteo de
  // triángulos ni medición de fps en ningún lado del código) - se muestran
  // como placeholder en vez de inventar un número.
  const triangleCount = "—";
  const fps = "—";
  const crs = "—";

  return (
    <footer className="status-bar">
      <div className="status-left">
        <div className="status-item">
          <svg className="status-icon ok" viewBox="0 0 24 24">
            <path d="M4 12l4 4 8-8" strokeWidth="2" fill="none" stroke="currentColor" />
          </svg>
          <span>{modelsCount} modelo{modelsCount !== 1 ? "s" : ""} cargado{modelsCount !== 1 ? "s" : ""}</span>
        </div>

        <div className="status-item">
          <span>{triangleCount} tris</span>
        </div>

        <div className="status-item">
          <span>{selectionCount} elemento{selectionCount !== 1 ? "s" : ""} seleccionado{selectionCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="status-spacer" />

      <div className="status-right">
        <div className="status-item">
          <span>{fps} fps</span>
        </div>

        <div className="status-item">
          <span>{crs}</span>
        </div>
      </div>
    </footer>
  );
}
