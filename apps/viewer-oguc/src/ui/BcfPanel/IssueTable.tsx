// src/ui/BcfPanel/IssueTable.tsx
//
// Reemplaza IssueList/IssueCard (tarjetas verticales, pensadas para una
// columna de 272px) - ahora que Incidencias vive en DockBottom
// (full-width), una tabla real aprovecha ese ancho: id/miniatura/
// título/estado/prioridad/responsable/fecha, todo visible de un vistazo
// en vez de scrollear tarjetas una debajo de otra.
import type { BcfPriority, BcfStatus, BcfTopic } from "../../viewer/bcf/types/bcf";
import { EmptyState } from "../EmptyState";

interface IssueTableProps {
  topics: BcfTopic[];
  activeTopic: BcfTopic | null;
  onSelect: (topic: BcfTopic | null) => void;
  onActivate: (topic: BcfTopic) => void;
}

const PRIORITY_COLOR: Record<BcfPriority, string> = {
  High: "#ef4444",
  Medium: "#e8a33d",
  Low: "#5fc48d",
};

// Mismos colores que BcfPinRenderer.STATUS_COLOR (hex CSS, no el formato
// numérico 0xRRGGBB de Three.js) - la fila y el pin 3D del mismo topic
// deben verse consistentes.
const STATUS_COLOR: Record<BcfStatus, string> = {
  Open: "#ff4444",
  "Pending Review": "#ffb400",
  Resolved: "#44ff44",
};

export function IssueTable({ topics, activeTopic, onSelect, onActivate }: IssueTableProps) {
  // No action button here - BcfPanel.tsx's own header already renders an
  // "Importar BCF" button (BCF_PANEL_MODULES, registry/modules.ts) right
  // above this table, always, not only while empty. A second import
  // trigger inside the empty state would just be a duplicate of the one
  // already onscreen.
  if (topics.length === 0) {
    return <EmptyState title="Importa un archivo BCF o crea una nueva incidencia" />;
  }

  return (
    <div className="issue-table-wrap">
      <table className="issue-table">
        <thead>
          <tr>
            <th className="issue-col-thumb" />
            <th className="issue-col-id">ID</th>
            <th className="issue-col-title">Título</th>
            <th className="issue-col-status">Estado</th>
            <th className="issue-col-priority">Prioridad</th>
            <th className="issue-col-assignee">Responsable</th>
            <th className="issue-col-date">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((topic) => (
            <IssueRow
              key={topic.guid}
              topic={topic}
              isActive={activeTopic?.guid === topic.guid}
              onSelect={() => onSelect(topic)}
              onActivate={() => onActivate(topic)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface IssueRowProps {
  topic: BcfTopic;
  isActive: boolean;
  onSelect: () => void;
  onActivate: () => void;
}

// Click simple resalta (selecciona) el topic - doble click ADEMÁS mueve la
// cámara a su viewpoint (ver Viewport.tsx). Mismo criterio que tenía
// IssueCard: si un solo click ya moviera la cámara, recorrer la tabla con
// el mouse dispararía saltos de cámara constantes.
function IssueRow({ topic, isActive, onSelect, onActivate }: IssueRowProps) {
  return (
    <tr className={`issue-row${isActive ? " active" : ""}`} onClick={onSelect} onDoubleClick={onActivate}>
      <td className="issue-col-thumb">
        {topic.viewpoint.snapshot ? (
          <img className="issue-thumb" src={topic.viewpoint.snapshot} alt="" />
        ) : (
          <div className="issue-thumb issue-thumb-empty" />
        )}
      </td>
      <td className="issue-col-id">#{topic.guid.slice(0, 8)}</td>
      <td className="issue-col-title">{topic.title}</td>
      <td className="issue-col-status">
        <span className="issue-status-pill" style={{ color: STATUS_COLOR[topic.status] }}>
          <span className="issue-status-dot" style={{ background: STATUS_COLOR[topic.status] }} />
          {topic.status}
        </span>
      </td>
      <td className="issue-col-priority" style={{ color: PRIORITY_COLOR[topic.priority] }}>
        {topic.priority}
      </td>
      <td className="issue-col-assignee">{topic.assignee ?? "—"}</td>
      <td className="issue-col-date">{topic.createdDate}</td>
    </tr>
  );
}
