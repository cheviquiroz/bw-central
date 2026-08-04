// src/ui/Search/SearchResults.tsx
import type { SearchResult } from "../../viewer/SearchManager";

interface SearchResultsProps {
  results: SearchResult[];
  onHover: (result: SearchResult | null) => void;
  onSelect: (result: SearchResult) => void;
}

export function SearchResults({ results, onHover, onSelect }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div style={{ padding: "24px 16px", textAlign: "center", color: "#777", fontSize: "12px" }}>
        Sin resultados
      </div>
    );
  }

  return (
    <div style={{ maxHeight: "320px", overflowY: "auto" }}>
      {results.map((result) => (
        <div
          key={`${result.modelId}-${result.localId}`}
          onMouseEnter={() => onHover(result)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onSelect(result)}
          style={{
            padding: "9px 14px",
            cursor: "pointer",
            fontSize: "13px",
            color: "#eee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.name}</span>
          <span style={{ color: "#888", fontSize: "10px", flexShrink: 0, fontFamily: "monospace" }}>{result.category}</span>
        </div>
      ))}
    </div>
  );
}
