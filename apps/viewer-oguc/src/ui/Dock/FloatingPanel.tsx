// src/ui/Dock/FloatingPanel.tsx
//
// Etapa 4b-1 - contenedor genérico para paneles flotantes
// (position:absolute dentro de .panel-layer, ver Layout.tsx), reemplazo
// futuro de los docks fijos (DockLeft/DockRight/DockBottom siguen
// existiendo por ahora, coexisten con esto hasta que Fase 4b-3 los
// retire). Sin drag/resize todavía - eso es Fase 4b-2; acá solo
// posicionamiento calculado (togglePanel/calculateInitialPosition en
// LayoutStateContext.tsx) y "traer al frente" por z-index.
import { useRef } from "react";
import type { ReactNode } from "react";
import { useLayoutState } from "../LayoutStateContext";
import type { PanelId } from "../LayoutStateContext";
import "./floating-panel.css";

interface FloatingPanelProps {
  id: PanelId;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function FloatingPanel({ id, title, icon, children }: FloatingPanelProps) {
  const { panels, updatePanelPosition, bringToFront } = useLayoutState();
  const panelState = panels[id];
  const panelRef = useRef<HTMLDivElement>(null);

  if (!panelState.open) return null;

  const handleCloseClick = () => {
    updatePanelPosition(id, { open: false });
  };

  return (
    <div
      ref={panelRef}
      className="floating-panel"
      style={{
        left: `${panelState.x}px`,
        top: `${panelState.y}px`,
        width: `${panelState.width}px`,
        height: `${panelState.height}px`,
        zIndex: panelState.zIndex,
      }}
      onMouseDown={() => bringToFront(id)}
    >
      {/* Titlebar: única zona de arrastre (Fase 4b-2) - por ahora solo
          trae el panel al frente, mismo onMouseDown que el contenedor
          entero ya cubre, no uno duplicado. */}
      <div className="floating-panel-titlebar">
        <div className="floating-panel-grip" aria-hidden="true">⠿</div>
        <div className="floating-panel-header-content">
          {icon && <div className="floating-panel-icon">{icon}</div>}
          <h3 className="floating-panel-title">{title}</h3>
        </div>
        <div className="floating-panel-actions">
          <button className="floating-panel-close-btn" onClick={handleCloseClick} title="Cerrar" aria-label="Cerrar">
            ✕
          </button>
        </div>
      </div>

      <div className="floating-panel-body">{children}</div>

      {/* Resize handles: Fase 4b-2, no acá. */}
    </div>
  );
}
