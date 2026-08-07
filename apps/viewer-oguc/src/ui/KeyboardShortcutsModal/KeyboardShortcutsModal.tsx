// src/ui/KeyboardShortcutsModal/KeyboardShortcutsModal.tsx
//
// The 5 shortcuts that actually exist in this app today - listed here as
// plain data, not pulled from a shortcuts registry (there isn't one; the
// module registry's `shortcut` field only covers the 3 Ctrl+1/2/3
// toggles, and the other two - ? and the double-wheel-click - aren't
// ToolbarButtons at all, so they have no registry entry to read from).
import { useEffect, useRef } from "react";
import type React from "react";
import "./keyboard-shortcuts-modal.css";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Ctrl/Cmd + 1", action: "Alternar árbol del modelo" },
  { keys: "Ctrl/Cmd + 2", action: "Alternar panel de propiedades" },
  { keys: "Ctrl/Cmd + 3", action: "Alternar incidencias BCF" },
  { keys: "Doble clic rueda", action: "Encuadrar todo (Fit All)" },
  { keys: "?", action: "Abrir/cerrar este panel" },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape - solo mientras el modal está abierto, para no competir con
  // cualquier otro listener de Escape que pueda existir en la app (hoy no
  // hay ninguno, pero este efecto igual se desmonta apenas isOpen pasa a
  // false, no se queda escuchando de más).
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Click-outside: el mousedown tiene que originarse en el backdrop
  // mismo, no en cualquier click que "burbujee hasta acá" - comparar
  // event.target === event.currentTarget (no dialogRef.contains) evita
  // cerrar el modal por accidente si algún hijo futuro hace
  // stopPropagation de forma distinta a la de hoy.
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="shortcuts-modal-backdrop" onClick={handleBackdropClick}>
      <div className="shortcuts-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="shortcuts-modal-title">
        <header className="shortcuts-modal-header">
          <h2 id="shortcuts-modal-title">Atajos de teclado</h2>
          <button className="shortcuts-modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>
        <div className="shortcuts-modal-body">
          <table className="shortcuts-table">
            <tbody>
              {SHORTCUTS.map((shortcut) => (
                <tr key={shortcut.keys}>
                  <td className="shortcuts-table-keys">
                    <kbd>{shortcut.keys}</kbd>
                  </td>
                  <td className="shortcuts-table-action">{shortcut.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
