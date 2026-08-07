// src/ui/components/Table/TableHeader.tsx
//
// Sort indicator uses plain "▲"/"▼" text glyphs, not an SVG icon - matches
// this app's own existing precedent for small state glyphs (see
// PreCheckGate.tsx's "▾" collapse chevron) rather than drawing a new icon for
// something this simple. No lucide-react: confirmed in an earlier task that
// it isn't a dependency of this app.
import type { Column } from "./types";

interface TableHeaderProps {
  columns: Column[];
  sortBy: string;
  sortDirection: "asc" | "desc";
  /** Which sortBy keys actually have a comparator (config.sortOptions) - a column can declare sortable:true (its own UI-affordance opt-in per CONTRACT_FINAL_SEALED.md Section 2) without a matching sortOptions entry existing yet; clicking such a column is a safe no-op rather than a runtime error. */
  sortableKeys: ReadonlySet<string>;
  onSort: (key: string) => void;
}

export function TableHeader({ columns, sortBy, sortDirection, sortableKeys, onSort }: TableHeaderProps) {
  return (
    <thead className="table-header">
      <tr>
        {columns.map((column) => {
          const canSort = column.sortable && sortableKeys.has(column.key);
          const isActiveSort = sortBy === column.key;
          const sortClass = isActiveSort ? ` table-header-cell--sort-${sortDirection}` : "";

          return (
            <th
              key={column.key}
              className={`table-header-cell${canSort ? " table-header-cell--sortable" : ""}${sortClass}`}
              style={{ width: column.width }}
              onClick={canSort ? () => onSort(column.key) : undefined}
            >
              {column.label}
              {isActiveSort && <span className="table-sort-indicator">{sortDirection === "asc" ? "▲" : "▼"}</span>}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
