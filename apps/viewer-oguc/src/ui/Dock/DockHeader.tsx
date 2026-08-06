// src/ui/Dock/DockHeader.tsx
import { IconAdd, IconLock } from "../icons/dock";

// No "visible" prop anymore: this header only ever renders while its
// panel is mounted (the panel itself is either fully visible or not
// rendered at all - see DockLeft.tsx), so there is no partial/collapsed
// state left for it to fade in or out of.
export function DockHeader({ onAddClick, onClose }: { onAddClick: () => void; onClose: () => void }) {
  return (
    <div className="dock-header visible">
      <span className="dock-title">Modelos</span>
      <div className="dock-header-actions">
        <span className="dock-action" onClick={onAddClick} title="Agregar IFC">
          <IconAdd />
        </span>
        <span className="dock-action" onClick={onClose} title="Ocultar panel">
          <IconLock />
        </span>
      </div>
    </div>
  );
}
