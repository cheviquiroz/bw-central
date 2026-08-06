// src/ui/Tooltip/Tooltip.tsx
//
// Replaces native title= across the toolbar (and, per Phase 5, the
// model tree): title= has a slow ~1s browser delay, is visually
// inconsistent across browsers, and is undiscoverable (no visual hint
// that hovering will show anything). This is hover-FOR-INFORMATION, not
// hover-FOR-BEHAVIOR - it only ever shows a label. It never opens,
// closes, selects, or changes anything, which is exactly why it is fine
// to keep on hover while every panel-expand/collapse hover trigger in
// this app was removed (see Phase 4).

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import "./tooltip.css";

const SHOW_DELAY_MS = 400;

interface TooltipProps {
  label: string;
  children: ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearTimer();
    showTimerRef.current = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
  };

  // Desaparece de inmediato al salir el mouse o al hacer click - nunca se
  // queda pegado tapando el botón que se acaba de clickear.
  const handleMouseLeave = () => {
    clearTimer();
    setVisible(false);
  };

  const handleClick = () => {
    clearTimer();
    setVisible(false);
  };

  return (
    <div
      className="tooltip-anchor"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClickCapture={handleClick}
    >
      {children}
      {visible && (
        <div className="tooltip-bubble" role="tooltip">
          {label}
        </div>
      )}
    </div>
  );
}
