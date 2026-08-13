// src/ui/Dock/FloatingPanel.tsx
//
// Etapa 4b-1 - contenedor genérico para paneles flotantes
// (position:absolute dentro de .panel-layer, ver Layout.tsx), reemplazo
// futuro de los docks fijos (DockLeft/DockRight/DockBottom siguen
// existiendo por ahora, coexisten con esto hasta que Fase 4b-3 los
// retire).
//
// Etapa 4b-2 - drag (desde el titlebar) + resize (8 handles). Mismo
// patrón que ResizeHandle.tsx (ya establecido para DockLeft/DockRight/
// DockBottom): Pointer Events + setPointerCapture + un ref con el
// estado de arranque del gesto, handlers LOCALES en el elemento que
// recibe el pointerdown (onPointerMove/onPointerUp ahí mismo, no
// document.addEventListener ni un useEffect) - el navegador sigue
// entregando move/up a ese elemento aunque el cursor se salga de sus
// bordes durante un arrastre rápido, y no hace falta un efecto que se
// re-suscriba en cada pixel (un borrador anterior de esta fase tenía
// panelState.width/height en las deps de un useEffect con listeners de
// document - se re-creaban en cada frame de un resize, justo el
// problema que este patrón evita).
import { useRef, useState } from "react";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { useLayoutState } from "../LayoutStateContext";
import type { PanelId } from "../LayoutStateContext";
import "./floating-panel.css";

interface FloatingPanelProps {
  id: PanelId;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;

type ResizeDirection = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

interface DragStart {
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
}

interface ResizeStart {
  direction: ResizeDirection;
  startClientX: number;
  startClientY: number;
  startWidth: number;
  startHeight: number;
  startX: number;
  startY: number;
}

function clamp(value: number, min: number, max: number): number {
  // max puede caer por debajo de min con una ventana muy angosta/baja
  // (width/height del panel > innerWidth/innerHeight) - Math.max primero
  // asegura no devolver menos que min incluso en ese caso, a costa de
  // dejar que el panel se salga un poco de pantalla en vez de volverse
  // más chico que su propio mínimo (mismo criterio que ya usan los
  // clamps de ancho de DockLeft/DockRight, que tampoco fuerzan un
  // mínimo imposible).
  return Math.max(min, Math.min(value, max));
}

export function FloatingPanel({ id, title, icon, children }: FloatingPanelProps) {
  const { panels, updatePanelPosition, bringToFront } = useLayoutState();
  const panelState = panels[id];
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragStart | null>(null);
  const resizeRef = useRef<ResizeStart | null>(null);
  // Solo controla la clase que apaga la transición durante el gesto
  // (ver floating-panel.css) - cambia 2 veces por gesto (pointerdown/
  // pointerup), no en cada pixel, así que un re-render acá es barato.
  const [isInteracting, setIsInteracting] = useState(false);

  if (!panelState.open) return null;

  const handleCloseClick = () => {
    updatePanelPosition(id, { open: false });
  };

  const handleTitlebarPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { startClientX: event.clientX, startClientY: event.clientY, startX: panelState.x, startY: panelState.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsInteracting(true);
    bringToFront(id);
  };

  const handleTitlebarPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const nextX = clamp(drag.startX + (event.clientX - drag.startClientX), 0, window.innerWidth - panelState.width);
    const nextY = clamp(drag.startY + (event.clientY - drag.startClientY), 0, window.innerHeight - panelState.height);
    updatePanelPosition(id, { x: nextX, y: nextY });
  };

  const handleTitlebarPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsInteracting(false);
  };

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>, direction: ResizeDirection) => {
    resizeRef.current = {
      direction,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: panelState.width,
      startHeight: panelState.height,
      startX: panelState.x,
      startY: panelState.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsInteracting(true);
    bringToFront(id);
  };

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize) return;
    const deltaX = event.clientX - resize.startClientX;
    const deltaY = event.clientY - resize.startClientY;
    const { direction } = resize;

    let width = resize.startWidth;
    let height = resize.startHeight;
    let x = resize.startX;
    let y = resize.startY;

    // n/s (alto) y e/w (ancho) son independientes - una esquina (ej.
    // "se") simplemente combina un carácter de cada grupo, no necesita
    // su propio caso. n/w además mueven x/y (el borde OPUESTO es el que
    // queda fijo en pantalla; agrandar "hacia arriba" corre `y` hacia
    // arriba en la misma medida que crece `height`, o el panel crecería
    // solo hacia abajo).
    if (direction.includes("e")) width = Math.max(MIN_WIDTH, resize.startWidth + deltaX);
    if (direction.includes("w")) {
      width = Math.max(MIN_WIDTH, resize.startWidth - deltaX);
      x = resize.startX + (resize.startWidth - width);
    }
    if (direction.includes("s")) height = Math.max(MIN_HEIGHT, resize.startHeight + deltaY);
    if (direction.includes("n")) {
      height = Math.max(MIN_HEIGHT, resize.startHeight - deltaY);
      y = resize.startY + (resize.startHeight - height);
    }

    x = clamp(x, 0, window.innerWidth - width);
    y = clamp(y, 0, window.innerHeight - height);

    updatePanelPosition(id, { x, y, width, height });
  };

  const handleResizePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    resizeRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsInteracting(false);
  };

  return (
    <div
      ref={panelRef}
      className={`floating-panel${isInteracting ? " floating-panel-interacting" : ""}`}
      style={{
        left: `${panelState.x}px`,
        top: `${panelState.y}px`,
        width: `${panelState.width}px`,
        height: `${panelState.height}px`,
        zIndex: panelState.zIndex,
      }}
      onPointerDown={() => bringToFront(id)}
    >
      <div
        className="floating-panel-titlebar"
        onPointerDown={handleTitlebarPointerDown}
        onPointerMove={handleTitlebarPointerMove}
        onPointerUp={handleTitlebarPointerUp}
      >
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

      {/* 8 handles - 4 bordes + 4 esquinas. Cada uno es su propio
          elemento con su propio par onPointerDown/Move/Up (no un solo
          handler compartido leyendo data-direction): mismo criterio que
          ResizeHandle.tsx, cada gesto necesita su propio pointerId
          capturado en el elemento que lo empezó. */}
      <div className="floating-panel-resize-handle floating-panel-resize-n" onPointerDown={(e) => handleResizePointerDown(e, "n")} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} />
      <div className="floating-panel-resize-handle floating-panel-resize-s" onPointerDown={(e) => handleResizePointerDown(e, "s")} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} />
      <div className="floating-panel-resize-handle floating-panel-resize-w" onPointerDown={(e) => handleResizePointerDown(e, "w")} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} />
      <div className="floating-panel-resize-handle floating-panel-resize-e" onPointerDown={(e) => handleResizePointerDown(e, "e")} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} />
      <div className="floating-panel-resize-handle floating-panel-resize-nw" onPointerDown={(e) => handleResizePointerDown(e, "nw")} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} />
      <div className="floating-panel-resize-handle floating-panel-resize-ne" onPointerDown={(e) => handleResizePointerDown(e, "ne")} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} />
      <div className="floating-panel-resize-handle floating-panel-resize-sw" onPointerDown={(e) => handleResizePointerDown(e, "sw")} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} />
      <div className="floating-panel-resize-handle floating-panel-resize-se" onPointerDown={(e) => handleResizePointerDown(e, "se")} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} />
    </div>
  );
}
