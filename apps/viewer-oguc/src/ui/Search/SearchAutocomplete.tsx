// src/ui/Search/SearchAutocomplete.tsx
import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import type { SearchManager, SearchResult } from "../../viewer/SearchManager";
import { SearchResults } from "./SearchResults";

interface SearchAutocompleteProps {
  searchManager: SearchManager | null;
  query: string;
  results: SearchResult[];
  onRunQuery: (value: string) => void;
  onSelectResult: (result: SearchResult) => void;
}

// Sin query: historial + favoritos. Con query: resultados en vivo. No hay
// un paso de "Enter para buscar" - el efecto de búsqueda en SearchBar.tsx
// ya corre en cada tecleo.
export function SearchAutocomplete({ searchManager, query, results, onRunQuery, onSelectResult }: SearchAutocompleteProps) {
  const [history, setHistory] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (!searchManager) return;
    setHistory(searchManager.getHistory());
    setFavorites(searchManager.getFavorites());
  }, [searchManager, query]);

  const handleHover = (result: SearchResult | null) => {
    if (result) searchManager?.highlightResult(result.modelId, result.localId);
    else searchManager?.clearHover();
  };

  const handleToggleFavorite = (item: string, event: MouseEvent) => {
    event.stopPropagation();
    searchManager?.toggleFavorite(item);
    setFavorites(searchManager?.getFavorites() ?? []);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        width: "360px",
        background: "#1e2229",
        border: "1px solid #444",
        borderRadius: "6px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
        zIndex: 200,
        overflow: "hidden",
      }}
    >
      {query ? (
        <>
          <div style={{ padding: "6px 12px", fontSize: "11px", color: "#888", borderBottom: "1px solid #333" }}>
            {results.length} elemento{results.length === 1 ? "" : "s"} encontrado{results.length === 1 ? "" : "s"}
          </div>
          <SearchResults results={results} onHover={handleHover} onSelect={onSelectResult} />
        </>
      ) : (
        <>
          {favorites.length > 0 && (
            <div style={{ padding: "6px 0", borderBottom: history.length > 0 ? "1px solid #333" : "none" }}>
              <div style={sectionTitleStyle}>Favoritos</div>
              {favorites.map((item) => (
                <div key={item} onClick={() => onRunQuery(item)} style={historyItemStyle}>
                  <span style={itemLabelStyle}>⭐ {item}</span>
                  <button onClick={(e) => handleToggleFavorite(item, e)} style={xButtonStyle} title="Quitar de favoritos">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {history.length > 0 ? (
            <div style={{ padding: "6px 0" }}>
              <div style={sectionTitleStyle}>Búsquedas recientes</div>
              {history.map((item) => (
                <div key={item} onClick={() => onRunQuery(item)} style={historyItemStyle}>
                  <span style={itemLabelStyle}>🕑 {item}</span>
                  <button
                    onClick={(e) => handleToggleFavorite(item, e)}
                    style={xButtonStyle}
                    title={favorites.includes(item) ? "Quitar de favoritos" : "Marcar favorito"}
                  >
                    {favorites.includes(item) ? "⭐" : "☆"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            favorites.length === 0 && (
              <div style={{ padding: "18px 12px", fontSize: "11px", color: "#666", textAlign: "center", lineHeight: 1.5 }}>
                Escribí para buscar por nombre, tipo o "propiedad:valor"
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

const sectionTitleStyle: CSSProperties = {
  padding: "4px 12px",
  fontSize: "10px",
  color: "#666",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const historyItemStyle: CSSProperties = {
  padding: "7px 12px",
  cursor: "pointer",
  fontSize: "12px",
  color: "#ccc",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "8px",
};

const itemLabelStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const xButtonStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: "#888",
  cursor: "pointer",
  fontSize: "11px",
  flexShrink: 0,
};
