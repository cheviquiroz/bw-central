// src/ui/BcfPanel/CreateTopicDialog.tsx
//
// Same backdrop+centered-box+Escape+click-outside pattern already
// established by KeyboardShortcutsModal.tsx (this app's only other
// modal-shaped component) - not a new pattern invented for this one
// feature.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import type { BcfPriority } from "../../viewer/bcf/types/bcf";
import "./create-topic-dialog.css";

interface CreateTopicDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Returns false if creation failed (viewpoint capture unavailable -
   * see captureViewpoint.ts/useModelToolActions.ts's captureViewpoint,
   * which returns null before the viewer has finished initializing).
   * The dialog stays open and shows an error on false, per this task's
   * own edge-case requirement (Part 7.6) - closing on a failed attempt
   * would silently lose whatever the user typed.
   */
  onSubmit: (title: string, description: string, priority: BcfPriority) => boolean;
}

export function CreateTopicDialog({ isOpen, onClose, onSubmit }: CreateTopicDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<BcfPriority>("Medium");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset on every open, not on unmount - this component never unmounts
  // (BcfPanel renders it unconditionally, isOpen just toggles visibility,
  // same as KeyboardShortcutsModal), so this is the only place stale
  // input from a previous open would otherwise linger.
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setPriority("Medium");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      setError("Título es requerido");
      return;
    }
    const success = onSubmit(title.trim(), description.trim(), priority);
    if (!success) {
      setError("No se pudo capturar la vista 3D actual. Intenta de nuevo.");
      return;
    }
  };

  // Portal to document.body, not rendered inline: this component lives
  // inside BcfPanel.tsx, which is nested inside .dock-bottom/.bcf-panel -
  // both have backdrop-filter (bcf-panel.css/dock-bottom.css), and
  // backdrop-filter (like transform/filter/perspective) creates a new
  // containing block for position:fixed descendants in modern browsers.
  // Without the portal, this dialog's "fixed, cover the whole viewport"
  // backdrop was actually being confined to .dock-bottom's own box -
  // confirmed visually in a real browser (the dialog rendered pinned
  // near the bottom dock instead of centered on the window) before this
  // fix, not a hypothetical concern.
  return createPortal(
    <div className="create-topic-dialog-backdrop" onClick={handleBackdropClick}>
      <div className="create-topic-dialog" role="dialog" aria-modal="true" aria-labelledby="create-topic-title">
        <h2 id="create-topic-title">Crear nueva incidencia</h2>

        <label className="create-topic-field">
          Título *
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Escalera sin pasamanos"
            autoFocus
          />
        </label>

        <label className="create-topic-field">
          Descripción
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: En punto 5.3.4 del OGUC"
            rows={3}
          />
        </label>

        <label className="create-topic-field">
          Prioridad
          <select value={priority} onChange={(e) => setPriority(e.target.value as BcfPriority)}>
            <option value="Low">Baja</option>
            <option value="Medium">Media</option>
            <option value="High">Alta</option>
          </select>
        </label>

        <div className="create-topic-note">✓ Vista actual capturada como viewpoint</div>

        {error && <div className="create-topic-error">{error}</div>}

        <div className="create-topic-actions">
          <button onClick={handleSubmit} className="create-topic-btn-primary">
            Crear
          </button>
          <button onClick={onClose} className="create-topic-btn-secondary">
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
