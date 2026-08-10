// src/ui/LoadingOverlay.tsx
//
// Generic "something is happening" overlay - indeterminate spinner +
// message, an optional progress bar when a real percentage is available.
// Used by DockLeft.tsx (importing an IFC model) and PreCheckGate.tsx
// (re-parsing + running Pre-Check) - the two real async operations in
// this app long enough to need a visible "still working" signal.
//
// No lucide-react here: it isn't a dependency of this app (confirmed
// before writing this file) - every icon in src/ui/icons is a hand-drawn
// inline SVG for the same reason (see icons/toolbar/index.tsx's own
// comment on redrawing a lucide icon rather than installing the
// library). The spinner below is drawn the same way, animated via CSS.
import { createPortal } from "react-dom";
import "./loading-overlay.css";

export interface LoadingOverlayProps {
  isVisible: boolean;
  message: string;
  /** 0-100. Omit (or 0) for an indeterminate spinner only - most callers don't have a reliable percentage (see DockLeft.tsx's own comment on why web-ifc's progress callback is approximate at best), so this stays optional rather than forcing every caller to fake one. */
  progress?: number;
}

export function LoadingOverlay({ isVisible, message, progress }: LoadingOverlayProps) {
  if (!isVisible) return null;

  const showProgressBar = progress !== undefined && progress > 0;

  // Portal a document.body (encontrado y corregido durante Etapa 4a
  // Fase 3, no pedido por el brief) - DockLeft.tsx renderiza esto dentro
  // de .dock-panel, que desde Fase 2 es position:fixed con su propio
  // z-index (100), un stacking context real. Sin el portal, el
  // z-index:1000 de este overlay queda atrapado adentro y no puede
  // ganarle a DockRight/DockBottom (100) mientras se importa un modelo -
  // mismo bug, mismo fix, que KeyboardShortcutsModal/Toolbar3DFloating/
  // OrientationCube (ver Z-INDEX-SYSTEM.md). PreCheckGate.tsx's uso de
  // este mismo componente no necesitaba el portal (no vive dentro de
  // ningún ancestro fixed+z-index), pero portar siempre es más simple y
  // más seguro que portar condicionalmente según el caller.
  return createPortal(
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-overlay-content">
        <svg className="loading-overlay-spinner" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
          <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <p className="loading-overlay-message">{message}</p>
        {showProgressBar && (
          <div className="loading-overlay-progress-track">
            <div className="loading-overlay-progress-fill" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
