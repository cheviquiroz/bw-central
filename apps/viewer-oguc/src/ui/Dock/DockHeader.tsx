// src/ui/Dock/DockHeader.tsx
import { IconAdd, IconLock } from "../icons/dock";
import { Tooltip } from "../Tooltip/Tooltip";

// No "visible" prop anymore: this header only ever renders while its
// panel is mounted (the panel itself is either fully visible or not
// rendered at all - see DockLeft.tsx), so there is no partial/collapsed
// state left for it to fade in or out of.
export function DockHeader({ onAddClick, onClose }: { onAddClick: () => void; onClose: () => void }) {
  return (
    <div className="dock-header visible">
      {/* Etapa 4a Fase 3 - zona de arrastre visual solamente, sin lógica de
          drag real todavía (eso es Etapa 4c). onMouseDown no hace nada más
          que documentar la intención por ahora - no capturar pointer, no
          mover el panel. Envuelve el título existente en vez de duplicarlo
          con un label nuevo hardcodeado ("Model Tree" en el brief no es el
          texto real de este header, que ya es "Modelos" - ver arriba). */}
      <div className="dock-drag-handle" onMouseDown={() => console.log("Drag DockLeft started (not implemented yet)")}>
        <span className="dock-drag-handle-icon" aria-hidden="true">⋮⋮</span>
        <span className="dock-title">Modelos</span>
      </div>
      <div className="dock-header-actions">
        <Tooltip label="Agregar IFC">
          <span className="dock-action" onClick={onAddClick}>
            <IconAdd />
          </span>
        </Tooltip>
        <Tooltip label="Ocultar panel">
          <span className="dock-action" onClick={onClose}>
            <IconLock />
          </span>
        </Tooltip>
      </div>
    </div>
  );
}
