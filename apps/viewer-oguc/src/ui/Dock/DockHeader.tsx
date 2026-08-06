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
      <span className="dock-title">Modelos</span>
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
