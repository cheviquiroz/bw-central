// src/ui/BcfPanel/FilterBar.tsx
import type { BcfFilterStatus } from "../../viewer/bcf/types/bcf";

interface FilterBarProps {
  filter: BcfFilterStatus;
  topicsCount: number;
  filteredCount: number;
  onFilterChange: (filter: BcfFilterStatus) => void;
}

export function FilterBar({ filter, topicsCount, onFilterChange }: FilterBarProps) {
  return (
    <div className="filter-bar">
      {/* Sin emoji en las <option> - un <select> nativo solo renderiza texto
          plano adentro de <option>, no admite spans/SVG, así que no hay
          forma de meter un punto de color ahí como en IssueCard. */}
      <select className="filter-dropdown" value={filter} onChange={(e) => onFilterChange(e.target.value as BcfFilterStatus)}>
        <option value="All">Todas ({topicsCount})</option>
        <option value="Open">Open</option>
        <option value="Pending Review">Pending Review</option>
        <option value="Resolved">Resolved</option>
      </select>
    </div>
  );
}
