// src/ui/Dock/DockingContainer.tsx
//
// Etapa 4c-1 - grid de docking 2x2. Renderiza los paneles ya en
// dockingLayout.leftColumn/rightColumn (LayoutStateContext.tsx) como dos
// columnas flex, con un separador vertical entre ellas y uno horizontal
// dentro de cada columna que tenga 2 paneles. NO conoce títulos/íconos/
// contenido de ningún panel - `elements` es el mapa id -> ReactNode ya
// armado que Layout.tsx construye (ver el comentario ahí sobre por qué:
// el brief original de esta fase proponía que este componente
// reconstruyera cada <FloatingPanel> desde cero con solo un id, lo cual
// no compila - title/children son props requeridas de FloatingPanel, y
// Layout.tsx es el único lugar que ya sabe qué componente real le
// corresponde a cada PanelId).
//
// Resize de separadores: mismo patrón que FloatingPanel.tsx/
// ResizeHandle.tsx ya usan (Pointer Events + setPointerCapture + un ref
// con el estado de arranque del gesto, handlers LOCALES en el elemento
// que recibe el pointerdown) - NO document.addEventListener como
// proponía el brief original de esta fase, por el mismo motivo ya
// documentado en FloatingPanel.tsx: un handler local no necesita
// re-suscribirse en cada pixel del gesto.
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useLayoutState, MIN_DOCKING_COLUMN_WIDTH, MIN_DOCKING_ROW_HEIGHT } from "../LayoutStateContext";
import type { PanelId } from "../LayoutStateContext";
import "./docking-container.css";

interface DockingContainerProps {
  elements: Partial<Record<PanelId, ReactNode>>;
}

interface ColumnResizeStart {
  startClientX: number;
  startLeftWidth: number;
  startRightWidth: number;
}

interface RowResizeStart {
  column: "left" | "right";
  startClientY: number;
  startHeight: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function DockingContainer({ elements }: DockingContainerProps) {
  const { dockingLayout, updateDockingLayout } = useLayoutState();
  const { leftColumn, rightColumn, leftColumnWidth, rightColumnWidth, leftTopHeight, rightTopHeight } = dockingLayout;

  const columnResizeRef = useRef<ColumnResizeStart | null>(null);
  const rowResizeRef = useRef<RowResizeStart | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  if (leftColumn.length === 0 && rightColumn.length === 0) return null;

  const handleColumnResizeDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    columnResizeRef.current = { startClientX: event.clientX, startLeftWidth: leftColumnWidth, startRightWidth: rightColumnWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
  };

  const handleColumnResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = columnResizeRef.current;
    if (!start) return;
    const delta = event.clientX - start.startClientX;
    // Ambas columnas se mueven en direcciones opuestas (correr el
    // separador a la derecha agranda left Y achica right en la misma
    // medida) - mismo criterio que un split-pane de dos paneles reales,
    // no una sola columna resizeable con la otra fija.
    const maxCombined = start.startLeftWidth + start.startRightWidth;
    const newLeftWidth = clamp(start.startLeftWidth + delta, MIN_DOCKING_COLUMN_WIDTH, maxCombined - MIN_DOCKING_COLUMN_WIDTH);
    const newRightWidth = maxCombined - newLeftWidth;
    updateDockingLayout({ leftColumnWidth: newLeftWidth, rightColumnWidth: newRightWidth });
  };

  const handleColumnResizeUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    columnResizeRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsResizing(false);
  };

  const handleRowResizeDown = (column: "left" | "right") => (event: ReactPointerEvent<HTMLDivElement>) => {
    rowResizeRef.current = { column, startClientY: event.clientY, startHeight: column === "left" ? leftTopHeight : rightTopHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
  };

  const handleRowResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = rowResizeRef.current;
    if (!start) return;
    const delta = event.clientY - start.startClientY;
    const newHeight = Math.max(MIN_DOCKING_ROW_HEIGHT, start.startHeight + delta);
    updateDockingLayout(start.column === "left" ? { leftTopHeight: newHeight } : { rightTopHeight: newHeight });
  };

  const handleRowResizeUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    rowResizeRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsResizing(false);
  };

  const renderColumn = (columnIds: PanelId[], side: "left" | "right", width: number, topHeight: number) => (
    <div className={`docking-column docking-column-${side}`} style={{ width: `${width}px` }}>
      {/* Solo el panel de ARRIBA de una columna con 2 usa flex-basis fijo
          (topHeight) - el de abajo siempre flex:1 (llena lo que quede),
          así que cerrar el de arriba (removePanelFromDocking ya
          recalcula topHeight = gridHeight completo para el que queda) no
          requiere ningún cálculo especial acá, el flex:1 del
          sobreviviente ya se expande solo. El separador va ENTRE los dos
          slots en el DOM (no después de ambos) - un flex-direction:column
          respeta orden de DOM para decidir qué está arriba/abajo. */}
      <div key={columnIds[0]} className="docking-slot" style={columnIds.length === 2 ? { flex: `0 0 ${topHeight}px` } : { flex: "1 1 0" }}>
        {elements[columnIds[0]]}
      </div>
      {columnIds.length === 2 && (
        <>
          <div
            className="docking-separator docking-separator-horizontal"
            onPointerDown={handleRowResizeDown(side)}
            onPointerMove={handleRowResizeMove}
            onPointerUp={handleRowResizeUp}
          />
          <div key={columnIds[1]} className="docking-slot" style={{ flex: "1 1 0" }}>
            {elements[columnIds[1]]}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={`docking-container${isResizing ? " docking-container-resizing" : ""}`}>
      {leftColumn.length > 0 && renderColumn(leftColumn, "left", leftColumnWidth, leftTopHeight)}

      {leftColumn.length > 0 && rightColumn.length > 0 && (
        <div
          className="docking-separator docking-separator-vertical"
          onPointerDown={handleColumnResizeDown}
          onPointerMove={handleColumnResizeMove}
          onPointerUp={handleColumnResizeUp}
        />
      )}

      {rightColumn.length > 0 && renderColumn(rightColumn, "right", rightColumnWidth, rightTopHeight)}
    </div>
  );
}
