// src/ui/BcfPanel/BcfDetailPanel.tsx
//
// Renders only real, already-parsed BcfTopic data (title, description,
// status, priority, author, date, assignee, viewpoints[]) - see
// BCF_DETAIL_PANEL_SPEC.md for the field-by-field data-availability check.
// Deliberately does NOT render markup.snapshots/markup.svg: neither is
// populated by anything in this pipeline today (bcf-core has no parser for
// them, BcfImporter.adaptTopic never assigns BcfTopic.markup) - see
// src/viewer/bcf/investigation/BCF_SNAPSHOT_PARSING.md. Rendering them
// here would mean inventing data that doesn't exist.
import type { BcfTopic } from "../../viewer/bcf/types/bcf";
import { statusToColor, priorityToColor, badgeColorToCss } from "../components/Table/colorMap";
import "./bcf-panel.css";

interface BcfDetailPanelProps {
  activeTopic: BcfTopic | null;
  onViewpointClick: (index: number) => void;
  selectedViewpointIndex?: number;
}

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 8h3l2-2h6l2 2h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

// bcf-core stores dates as whatever raw text the XML had (usually
// ISO 8601, but not guaranteed) - falls back to the raw string rather
// than showing "Invalid Date" if it doesn't parse.
function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}

export function BcfDetailPanel({ activeTopic, onViewpointClick, selectedViewpointIndex }: BcfDetailPanelProps) {
  if (!activeTopic) return null;

  const statusColor = badgeColorToCss[statusToColor[activeTopic.status]];
  const priorityColor = badgeColorToCss[priorityToColor[activeTopic.priority]];

  return (
    <div className="bcf-detail-panel">
      <h4 className="bcf-detail-title">{activeTopic.title}</h4>

      <div className="bcf-detail-badges">
        <span className="bcf-detail-badge" style={{ color: statusColor, borderColor: statusColor }}>
          {activeTopic.status}
        </span>
        <span className="bcf-detail-badge" style={{ color: priorityColor, borderColor: priorityColor }}>
          {activeTopic.priority}
        </span>
        {activeTopic.topicType && <span className="bcf-detail-badge">{activeTopic.topicType}</span>}
      </div>

      <dl className="bcf-detail-meta">
        <dt>Autor</dt>
        <dd>{activeTopic.createdAuthor || "—"}</dd>
        <dt>Creado</dt>
        <dd>{formatDate(activeTopic.createdDate)}</dd>
        <dt>Responsable</dt>
        <dd>{activeTopic.assignee || "—"}</dd>
      </dl>

      <section className="bcf-detail-section">
        <h5>Descripción</h5>
        <p className="bcf-detail-description">{activeTopic.description || "Sin descripción"}</p>
      </section>

      <section className="bcf-detail-section">
        {/* Placeholder only, per this task's explicit scope - real comment
            rendering (author/date/text per entry) is a separate feature,
            not implemented here even though topic.comments already has
            the real data available. */}
        <h5>Comentarios ({activeTopic.comments.length})</h5>
      </section>

      <section className="bcf-detail-section">
        <h5>Viewpoints</h5>
        <div className="bcf-detail-viewpoints">
          {activeTopic.viewpoints.map((_, index) => (
            <button
              key={index}
              className={`bcf-detail-viewpoint${index === selectedViewpointIndex ? " active" : ""}`}
              onClick={() => onViewpointClick(index)}
            >
              {/* FUTURE: When bcf-core parses markup.snapshots, replace the placeholder
                  icon with a real <img>. Panel structure stays the same.
                  Requires proper sanitization (dompurify is currently only a transitive dep). */}
              <IconCamera />
              <span>{index + 1}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
