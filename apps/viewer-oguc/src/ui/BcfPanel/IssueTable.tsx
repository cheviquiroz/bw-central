// src/ui/BcfPanel/IssueTable.tsx
//
// Phase 3: refactored to render <Table> (src/ui/components/Table) instead
// of a hand-rolled <table>, same pattern as FindingsTable.tsx's Phase 2
// refactor. External props (topics, activeTopic, onSelect, onActivate)
// stay exactly as they were - BcfPanel.tsx/Layout.tsx/Viewport.tsx need no
// changes, unlike Findings' refactor (which had to remove a prop that lost
// its only UI surface). Both onSelect and onActivate stay live here.
//
// badge/level carry PRIORITY, not status (CONTRACT_AMENDMENTS.md's already-
// sealed Amendment 1: level is severity-shaped, priority is BCF's only
// severity-shaped field - status is a workflow state, not a severity, and
// deliberately excluded). Status still gets its own visual (a colored
// pill, same as today) via a custom column render reading
// metadata.bcf.status + colorMap's statusToColor directly, bypassing
// badge/level entirely - resolves PHASE_1_RISKS.md #1/#9 exactly as
// CONTRACT_AMENDMENTS.md Amendment 1 already decided.
//
// Double-click is Table-external (Option B, CONTRACT_FINAL_SEALED.md
// Section 6): <Table> itself never wires dblclick or carries an event
// discriminator - this component detects a double-click itself via the
// same timestamp-comparison pattern this app already uses for its other
// manual double-click detector (useModelToolActions.ts's double-middle-
// mouse-click -> Fit All), inside the single onSelectRow callback Table
// already gives us (which already tells us which item was clicked - no
// need for a raw DOM-wrapping onDoubleClick that would have to re-derive
// that from the event target).
import { useRef } from "react";
import type { BcfTopic } from "../../viewer/bcf/types/bcf";
import { Table } from "../components/Table";
import type { Column, TableConfig, TableItem } from "../components/Table";
import { priorityToColor, statusToColor, badgeColorToCss } from "../components/Table/colorMap";
import { EmptyState } from "../EmptyState";

const DOUBLE_CLICK_THRESHOLD_MS = 300;

interface IssueTableProps {
  topics: BcfTopic[];
  activeTopic: BcfTopic | null;
  onSelect: (topic: BcfTopic | null) => void;
  onActivate: (topic: BcfTopic) => void;
}

function topicToTableItem(topic: BcfTopic): TableItem {
  return {
    id: topic.guid,
    index: 0,
    title: topic.title,
    level: topic.priority === "High" ? "high" : topic.priority === "Medium" ? "medium" : "low",
    badge: { label: topic.priority, color: priorityToColor[topic.priority], semantics: "priority" },
    metadata: {
      bcf: {
        guid: topic.guid,
        priority: topic.priority,
        status: topic.status,
        assignee: topic.assignee,
        createdDate: topic.createdDate,
        viewpoint: topic.viewpoint,
      },
    },
  };
}

export function IssueTable({ topics, activeTopic, onSelect, onActivate }: IssueTableProps) {
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);

  // No action button here - BcfPanel.tsx's own header already renders an
  // "Importar BCF" button (BCF_PANEL_MODULES, registry/modules.ts) right
  // above this table, always, not only while empty. A second import
  // trigger inside the empty state would just be a duplicate of the one
  // already onscreen.
  if (topics.length === 0) {
    return <EmptyState title="Importa un archivo BCF o crea una nueva incidencia" />;
  }

  const items: TableItem[] = topics.map((t, i) => ({ ...topicToTableItem(t), index: i + 1 }));
  const topicByGuid = new Map(topics.map((t) => [t.guid, t]));

  const columns: Column[] = [
    {
      key: "thumb",
      label: "",
      width: "50px",
      sortable: false,
      render: (item) => {
        const snapshot = item.metadata.bcf?.viewpoint.snapshot;
        return snapshot ? <img className="issue-thumb" src={snapshot} alt="" /> : <div className="issue-thumb issue-thumb-empty" />;
      },
    },
    { key: "id", label: "ID", width: "90px", sortable: false, render: (item) => `#${item.id.slice(0, 8)}` },
    { key: "title", label: "Título", width: "1fr", sortable: true },
    {
      key: "status",
      label: "Estado",
      width: "140px",
      sortable: true,
      render: (item) => {
        const status = item.metadata.bcf!.status;
        const color = badgeColorToCss[statusToColor[status]];
        return (
          <span className="issue-status-pill" style={{ color }}>
            <span className="issue-status-dot" style={{ background: color }} />
            {status}
          </span>
        );
      },
    },
    { key: "priority", label: "Prioridad", width: "100px", sortable: true, render: (item) => <span style={{ color: badgeColorToCss[item.badge.color] }}>{item.badge.label}</span> },
    { key: "assignee", label: "Responsable", width: "120px", sortable: false, render: (item) => item.metadata.bcf?.assignee ?? "—" },
    { key: "date", label: "Fecha", width: "110px", sortable: true, render: (item) => item.metadata.bcf?.createdDate },
  ];

  // No existing sort logic to port - IssueTable had none before this
  // refactor (confirmed in BCF_ADAPTER.md/PHASE_1_RISKS.md #5). Orders
  // chosen here: priority/status most-important-first (mirrors Findings'
  // severity convention), date chronological, title alphabetical.
  const config: TableConfig = {
    columns,
    sortable: true,
    sortOptions: {
      priority: {
        label: "Prioridad",
        compareFn: (a, b) => {
          const order = { High: 0, Medium: 1, Low: 2 };
          return order[a.metadata.bcf!.priority] - order[b.metadata.bcf!.priority];
        },
      },
      status: {
        label: "Estado",
        compareFn: (a, b) => {
          const order = { Open: 0, "Pending Review": 1, Resolved: 2 };
          return order[a.metadata.bcf!.status] - order[b.metadata.bcf!.status];
        },
      },
      date: { label: "Fecha", compareFn: (a, b) => new Date(a.metadata.bcf!.createdDate).getTime() - new Date(b.metadata.bcf!.createdDate).getTime() },
      title: { label: "Título", compareFn: (a, b) => a.title.localeCompare(b.title) },
    },
    defaultSort: "priority",
  };

  const handleRowSelect = (item: TableItem) => {
    const topic = topicByGuid.get(item.id);
    if (!topic) return;

    const now = Date.now();
    const last = lastClickRef.current;
    if (last && last.id === item.id && now - last.time < DOUBLE_CLICK_THRESHOLD_MS) {
      onActivate(topic);
      lastClickRef.current = null;
    } else {
      onSelect(topic);
      lastClickRef.current = { id: item.id, time: now };
    }
  };

  return (
    <Table
      items={items}
      columns={columns}
      config={config}
      emptyMessage="Importa un archivo BCF o crea una nueva incidencia"
      onSelectRow={handleRowSelect}
      selectedIndex={activeTopic ? items.find((i) => i.id === activeTopic.guid)?.index : undefined}
    />
  );
}
