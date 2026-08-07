// src/ui/components/Table/TableRow.tsx
//
// No .table-row--hovered class wired via onMouseEnter/onMouseLeave state:
// hover stays pure CSS (:hover in table.css). Neither current domain
// (Findings, BCF) needs JS to react to hover - wiring dead state for zero
// behavioral difference is exactly the unnecessary complexity this
// project's own conventions avoid. The class name stays reserved in
// table.css's comments for a future case that actually needs it.
import type { ReactNode } from "react";
import type { Column, TableItem } from "./types";

interface TableRowProps<T extends TableItem> {
  item: T;
  columns: Column[];
  isSelected: boolean;
  onClick: (item: T) => void;
}

// TableItem's only string/number top-level fields are id/index/title/level -
// badge and metadata are objects, not display-ready. Rendering an object
// directly into JSX prints "[object Object]" rather than throwing, which is
// worse than falling back - so this only ever returns a primitive value it
// actually found, never the object itself.
function defaultCellValue(item: TableItem, key: string): ReactNode {
  if (key in item) {
    const value = item[key as keyof TableItem];
    if (typeof value === "string" || typeof value === "number") return value;
  }
  return item.badge.label;
}

export function TableRow<T extends TableItem>({ item, columns, isSelected, onClick }: TableRowProps<T>) {
  return (
    <tr
      className={`table-row${isSelected ? " table-row--selected" : ""}`}
      onClick={() => onClick(item)}
    >
      {columns.map((column) => (
        <td key={column.key} className="table-cell">
          {column.render ? column.render(item) : defaultCellValue(item, column.key)}
        </td>
      ))}
    </tr>
  );
}
