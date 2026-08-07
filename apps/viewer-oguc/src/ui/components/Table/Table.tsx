// src/ui/components/Table/Table.tsx
//
// Per CONTRACT_FINAL_SEALED.md Sections 4-5 (Option B): a real <table>, not
// a CSS-grid reimplementation - the contract's own Section 5 calls for
// "<table> wrapper with grid CSS", but a literal HTML <table> element fights
// display:grid (thead/tr/td keep their table-model roles unless every
// descendant is also re-styled, which would mean reimplementing the whole
// table layout algorithm by hand for no benefit - this app's own existing
// tables, findings-table.css/bcf-panel's issue table, already use standard
// table layout with border-collapse, not grid). Deviating to that same
// proven pattern rather than fighting the browser.
//
// No onDoubleClick anywhere in this file - Table only ever emits a single
// selection event. See types.ts's header comment and
// CONTRACT_FINAL_SEALED.md's Option B correction.
import { useMemo, useState } from "react";
import { TableHeader } from "./TableHeader";
import { TableRow } from "./TableRow";
import type { TableItem, TableProps } from "./types";
import "./table.css";

export function Table<T extends TableItem>({
  items,
  columns,
  config,
  emptyMessage,
  onSelectRow,
  selectedIndex,
}: TableProps<T>) {
  const [sortBy, setSortBy] = useState<string>(config.defaultSort);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [internalSelectedIndex, setInternalSelectedIndex] = useState<number | null>(null);

  // Controlled (selectedIndex prop given) vs. uncontrolled - same pattern a
  // controlled <input> uses, so an adapter that already tracks "which item
  // is active" for its own domain reasons (e.g. BcfManager.activeTopic)
  // doesn't need to duplicate that state a second time just for Table's
  // highlight.
  const activeSelectedIndex = selectedIndex ?? internalSelectedIndex;

  const sortableKeys = useMemo(() => new Set(Object.keys(config.sortOptions)), [config.sortOptions]);

  const sortedItems = useMemo(() => {
    const sortEntry = config.sortable ? config.sortOptions[sortBy] : undefined;
    const sorted = sortEntry ? [...items].sort(sortEntry.compareFn) : [...items];
    if (sortEntry && sortDirection === "desc") sorted.reverse();
    // index recalculates on every sort, per CONTRATO FINAL's original rule
    // ("positional, recalculates on sort: 1, 2, 3...") - never trusted from
    // whatever index value the adapter set when building TableItem[].
    return sorted.map((item, i) => ({ ...item, index: i + 1 }));
  }, [items, config.sortable, config.sortOptions, sortBy, sortDirection]);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDirection("asc");
    }
  };

  const handleRowClick = (item: T) => {
    setInternalSelectedIndex(item.index);
    onSelectRow(item);
  };

  return (
    <div className="table-wrap">
      <table className="table">
        <TableHeader
          columns={columns}
          sortBy={sortBy}
          sortDirection={sortDirection}
          sortableKeys={sortableKeys}
          onSort={handleSort}
        />
        <tbody className="table-body">
          {sortedItems.length === 0 ? (
            <tr className="table-empty-row">
              <td colSpan={columns.length}>{emptyMessage}</td>
            </tr>
          ) : (
            sortedItems.map((item) => (
              <TableRow
                key={item.id}
                item={item}
                columns={columns}
                isSelected={activeSelectedIndex === item.index}
                onClick={handleRowClick}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
