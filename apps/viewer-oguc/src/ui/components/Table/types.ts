// src/ui/components/Table/types.ts
//
// Shapes locked by CONTRACT_FINAL_SEALED.md, Sections 1-4. TableProps.onSelectRow
// has no `event` parameter - the sealed contract's Option B correction means
// Table never knows single-click from double-click exists as a concept; a
// domain that needs that distinction (today: BCF) detects it in its own
// wrapper around <Table>, outside this component tree entirely (see Section 6
// of the contract for the reference pattern).
import type { ReactNode } from "react";
import type { BcfViewpoint } from "../../../viewer/bcf/types/bcf";

export interface TableItem {
  id: string;
  index: number;
  title: string;
  level?: "critical" | "high" | "medium" | "low" | "info";
  badge: {
    label: string;
    color: "red" | "orange" | "green" | "blue" | "gray";
    semantics: "severity" | "status" | "priority";
  };
  metadata: {
    oguc?: {
      ruleId: string;
      severity: "error" | "warning" | "info";
      state: "pending" | "accepted" | "rejected";
      elementId?: number;
      elementName?: string;
      userNote?: string;
    };
    bcf?: {
      guid: string;
      priority: "Low" | "Medium" | "High";
      status: "Open" | "Pending Review" | "Resolved";
      assignee?: string;
      createdDate: string;
      viewpoint: BcfViewpoint;
    };
  };
}

export interface Column {
  key: string;
  label: string;
  width: string;
  sortable: boolean;
  render?: (item: TableItem) => ReactNode;
}

export interface TableConfig {
  columns: Column[];
  sortable: boolean;
  sortOptions: Record<string, { label: string; compareFn: (a: TableItem, b: TableItem) => number }>;
  defaultSort: string;
}

export interface TableProps<T extends TableItem = TableItem> {
  items: T[];
  columns: Column[];
  config: TableConfig;
  emptyMessage: string;
  /** Single-click only - see this file's header comment and CONTRACT_FINAL_SEALED.md's Option B correction. */
  onSelectRow: (item: T) => void;
  selectedIndex?: number;
}
