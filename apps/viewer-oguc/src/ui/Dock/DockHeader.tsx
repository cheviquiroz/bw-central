// src/ui/Dock/DockHeader.tsx
import { IconAdd, IconLock } from "../icons/dock";

export function DockHeader({
  visible,
  onAddClick,
  onCollapse,
}: {
  visible: boolean;
  onAddClick: () => void;
  onCollapse: () => void;
}) {
  return (
    <div className={`dock-header${visible ? " visible" : ""}`} style={{ opacity: visible ? 1 : 0 }}>
      <span className="dock-title">Modelos</span>
      <div className="dock-header-actions">
        <span className="dock-action" onClick={onAddClick} title="Agregar IFC">
          <IconAdd />
        </span>
        {/* Antes alternaba isPinned (mantenía el panel expandido incluso
            sin el mouse encima). Ya no hay proximity-hover del que
            "pinnear" - abrir siempre significa quedarse abierto hasta que
            el usuario cierre a propósito, así que esto es simplemente
            "cerrar el panel", no un toggle con estado activo/inactivo. */}
        <span className="dock-action" onClick={onCollapse} title="Colapsar panel">
          <IconLock />
        </span>
      </div>
    </div>
  );
}
