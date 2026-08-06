// src/ui/BcfPanel/FilterBar.tsx
import type { BcfFilterStatus } from "../../viewer/bcf/types/bcf";

interface FilterBarProps {
  filter: BcfFilterStatus;
  topicsCount: number;
  filteredCount: number;
  onFilterChange: (filter: BcfFilterStatus) => void;
}

// Fase 3: ya no envuelve el <select> en un div con su propia fila/borde -
// vive inline dentro de .bcf-header-actions (ver BcfPanel.tsx), junto a
// Importar/Exportar y el botón de ocultar.
export function FilterBar({ filter, topicsCount, onFilterChange }: FilterBarProps) {
  return (
    // Sin emoji en las <option> - un <select> nativo solo renderiza texto
    // plano adentro de <option>, no admite spans/SVG, así que no hay forma
    // de meter un punto de color ahí como en IssueTable.
    <select className="filter-dropdown" value={filter} onChange={(e) => onFilterChange(e.target.value as BcfFilterStatus)}>
      <option value="All">Todas ({topicsCount})</option>
      <option value="Open">Open</option>
      <option value="Pending Review">Pending Review</option>
      <option value="Resolved">Resolved</option>
    </select>
  );
}
