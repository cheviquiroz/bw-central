// src/ui/BcfPanel/IssueCard.tsx
import type { BcfPriority, BcfStatus, BcfTopic } from "../../viewer/bcf/types/bcf";

interface IssueCardProps {
  topic: BcfTopic;
  isActive: boolean;
  onSelect: () => void;
  onActivate: () => void;
}

const PRIORITY_COLOR: Record<BcfPriority, string> = {
  High: "#ef4444",
  Medium: "#e8a33d",
  Low: "#5fc48d",
};

// Mismos colores que BcfPinRenderer.STATUS_COLOR (en hex CSS, no en el
// formato numérico 0xRRGGBB de Three.js) - la card y el pin 3D del mismo
// topic deben verse consistentes.
const STATUS_COLOR: Record<BcfStatus, string> = {
  Open: "#ff4444",
  "Pending Review": "#ffb400",
  Resolved: "#44ff44",
};

// Click simple resalta (selecciona) el topic - doble click ADEMÁS mueve la
// cámara a su viewpoint (ver Viewport.tsx). Distinción a propósito: si
// clickear una vez ya moviera la cámara, navegar la lista con el mouse
// (scroll + hover accidental) dispararía saltos de cámara constantes.
export function IssueCard({ topic, isActive, onSelect, onActivate }: IssueCardProps) {
  return (
    <div className={`issue-card${isActive ? " active" : ""}`} onClick={onSelect} onDoubleClick={onActivate}>
      <div className="issue-header">
        <span className="issue-number">#{topic.guid.slice(0, 8)}</span>
        {/* Punto de color en vez de emoji (🔴🟡🟢) - mismo criterio ya
            aplicado en Dock/FileUploadModal esta sesión: SVG/CSS, no
            emoji, para consistencia visual con el resto de la app. */}
        <span className="issue-status-dot" style={{ background: STATUS_COLOR[topic.status] }} title={topic.status} />
      </div>
      <div className="issue-title">{topic.title}</div>
      <div className="issue-meta">
        <span className="issue-priority" style={{ color: PRIORITY_COLOR[topic.priority] }}>
          {topic.priority}
        </span>
        <span className="issue-status">{topic.status}</span>
      </div>
    </div>
  );
}
