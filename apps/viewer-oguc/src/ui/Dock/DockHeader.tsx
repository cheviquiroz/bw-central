// src/ui/Dock/DockHeader.tsx
import { IconAdd, IconLock } from "../icons/dock";

export function DockHeader({
  visible,
  isPinned,
  onAddClick,
  onTogglePin,
}: {
  visible: boolean;
  isPinned: boolean;
  onAddClick: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div className={`dock-header${visible ? " visible" : ""}`} style={{ opacity: visible ? 1 : 0 }}>
      <span className="dock-title">Modelos</span>
      <div className="dock-header-actions">
        <span className="dock-action" onClick={onAddClick} title="Agregar IFC">
          <IconAdd />
        </span>
        <span className={`dock-action${isPinned ? " active" : ""}`} onClick={onTogglePin} title={isPinned ? "Desfijar panel" : "Fijar panel"}>
          <IconLock />
        </span>
      </div>
    </div>
  );
}
