// src/ui/ResizeHandle.tsx
//
// Shared drag-resize primitive, extracted from DockBottomShell.tsx's own
// inline pointer handlers (which pre-date this file - see the commit
// that adds DockLeft/DockRight resize) so all three resizable docks
// (left/right/bottom) share one drag implementation instead of three
// near-identical copies.
//
// Pointer Events + setPointerCapture, not window-level mousemove/mouseup
// listeners: capturing the pointer on the handle itself keeps receiving
// move/up events even if the cursor leaves the handle's bounds mid-drag
// (fast drags routinely do), and needs no manual
// addEventListener/removeEventListener cleanup in an effect - the browser
// releases capture automatically on pointerup. This was already the
// established pattern in this app before this file existed; kept as-is,
// not switched to the window-listener style.
//
// No visual styling here (per this task's own spec) - position/cursor
// live in each caller's own CSS (.dock-panel-resize-handle,
// .dock-right-resize-handle, .dock-bottom-resize-handle), same as the
// handle this file replaces.
import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type ResizeDirection = "horizontal" | "vertical";
export type ResizeSide = "left" | "right";

export interface ResizeHandleProps {
  direction: ResizeDirection;
  /**
   * Only meaningful for direction="horizontal": which dock this handle
   * belongs to, since the two horizontal docks need OPPOSITE delta signs
   * for the same rightward mouse movement - dragging the handle on
   * DockLeft's right edge to the right WIDENS it (positive delta);
   * dragging DockRight's left edge to the right NARROWS it (the mouse
   * is moving away from the dock's own body). Unused for
   * direction="vertical" (DockBottom only has one edge to drag, its
   * own top - up always grows it, there's no "side" ambiguity).
   */
  side?: ResizeSide;
  currentSize: number;
  minSize: number;
  maxSize: number;
  onResize: (size: number) => void;
  /** Fires once on pointer up - callers that already save on every onResize (e.g. via a context setter that persists to localStorage on each change) can leave this out; it exists for a caller that wants to distinguish "still dragging" from "drag committed" without diffing state itself. */
  onResizeEnd?: () => void;
  className?: string;
}

export function ResizeHandle({ direction, side, currentSize, minSize, maxSize, onResize, onResizeEnd, className }: ResizeHandleProps) {
  const dragStateRef = useRef<{ start: number; startSize: number } | null>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = direction === "horizontal" ? event.clientX : event.clientY;
    dragStateRef.current = { start, startSize: currentSize };
    event.currentTarget.setPointerCapture(event.pointerId);
    // Evita que el drag seleccione texto de golpe en el resto de la
    // página (un problema real de arrastrar rápido sobre paneles con
    // texto al lado) - se saca en pointerup, nunca queda pegado.
    document.body.style.userSelect = "none";
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;

    const current = direction === "horizontal" ? event.clientX : event.clientY;
    let delta = current - drag.start;

    // side==="right": el handle vive en el borde IZQUIERDO de DockRight -
    // moverse hacia la derecha aleja el mouse del cuerpo del panel, así
    // que ese movimiento debe ACHICARLO, no agrandarlo (signo invertido
    // respecto a DockLeft, cuyo handle vive en su borde derecho y donde
    // moverse a la derecha sí lo agranda). direction==="vertical"
    // (DockBottom): arrastrar hacia ARRIBA (deltaY negativo) agranda el
    // dock, mismo criterio que tenía el código que este archivo reemplaza.
    if (direction === "horizontal" && side === "right") delta = -delta;
    if (direction === "vertical") delta = -delta;

    const nextSize = Math.min(maxSize, Math.max(minSize, drag.startSize + delta));
    onResize(nextSize);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    document.body.style.userSelect = "";
    onResizeEnd?.();
  };

  return (
    <div
      className={`resize-handle${className ? ` ${className}` : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
