// src/ui/Search/SearchBar.tsx
import { useEffect, useRef, useState } from "react";
import type { SearchManager, SearchResult } from "../../viewer/SearchManager";
import { SearchAutocomplete } from "./SearchAutocomplete";

interface SearchBarProps {
  searchManager: SearchManager | null;
  // "Comando" de un solo uso desde afuera (click-to-filter en
  // PropertiesPanel/3D) - cada dispatch trae un nonce distinto para que el
  // useEffect dispare incluso si se pide la MISMA query dos veces seguidas.
  externalQuery: { value: string; nonce: number } | null;
}

export function SearchBar({ searchManager, externalQuery }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (event.key === "Escape") {
        // ESC limpia la búsqueda de verdad (texto + resaltado en 3D), no
        // solo cierra el dropdown - separado de handleClear() porque acá
        // también hace falta soltar el foco del input.
        inputRef.current?.blur();
        setIsOpen(false);
        setQuery("");
        searchManager?.clearAllResultsHighlight();
        searchManager?.clearHover();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchManager]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Click-to-filter externo (PropertiesPanel/3D) empuja una query acá.
  useEffect(() => {
    if (!externalQuery) return;
    setQuery(externalQuery.value);
    setIsOpen(true);
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuery?.nonce]);

  // Resalta TODOS los resultados en vivo, en azul, a medida que se escribe -
  // igual que el conteo, atado al éxito real de la búsqueda (no a un efecto
  // reactivo separado sobre `results`: eso podría dispararse también
  // cuando handleSelect vacía la query después de elegir UN resultado
  // puntual, corriendo la carrera de pisarle el highlight recién puesto a
  // ese elemento con un clear() tardío - ver handleSelect más abajo).
  useEffect(() => {
    if (!searchManager || !query) {
      setResults([]);
      return;
    }
    let cancelled = false;
    searchManager.search(query).then((found) => {
      if (!cancelled) {
        setResults(found);
        searchManager.highlightAllResults(found);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query, searchManager]);

  const handleRunQuery = (value: string) => {
    setQuery(value);
    inputRef.current?.focus();
  };

  // No limpia el resaltado de búsqueda acá a propósito: selectAndFocus ya
  // resalta el elemento elegido con el mismo estilo "select", y un clear()
  // posterior (disparado por setQuery("") vía el efecto de arriba) podría
  // llegar DESPUÉS y borrar tanto el highlight como la selección recién
  // hecha - mismo motivo que el comentario del efecto de búsqueda.
  const handleSelect = (result: SearchResult) => {
    searchManager?.selectAndFocus(result.modelId, result.localId);
    setIsOpen(false);
    setQuery("");
  };

  const handleClear = () => {
    setQuery("");
    searchManager?.clearHover();
    searchManager?.clearAllResultsHighlight();
    inputRef.current?.focus();
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    // Vaciar el campo escribiendo (backspace hasta "") sí debe limpiar el
    // resaltado - a diferencia de handleSelect, acá no hay ninguna
    // selección nueva en curso con la que competir.
    if (!value) searchManager?.clearAllResultsHighlight();
  };

  // Estilo del mockup (search-trigger): 230px fijo, borde que resalta en
  // foco, kbd de atajo a la derecha - pero el kbd solo tiene sentido
  // cuando no hay nada escrito; con texto, el botón "✕" para limpiar es
  // más útil que un atajo que ya se usó, así que se muestra uno u otro,
  // no ambos.
  return (
    <div ref={containerRef} style={{ position: "relative", width: "230px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "#171c22",
          border: `1px solid ${isOpen ? "#2c5f8a" : "#2c3540"}`,
          borderRadius: "7px",
          padding: "6px 10px",
          transition: "border-color 0.15s",
        }}
      >
        <span style={{ color: "#5d6773", fontSize: "12px", flexShrink: 0 }}>🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar por nombre o tipo…"
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "#e9edf1", fontSize: "12px" }}
        />
        {query ? (
          <button
            onClick={handleClear}
            title="Limpiar búsqueda"
            style={{ background: "none", border: "none", color: "#a3aebb", cursor: "pointer", fontSize: "12px", padding: 0, flexShrink: 0 }}
          >
            ✕
          </button>
        ) : (
          <kbd
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10px",
              color: "#5d6773",
              background: "#262d37",
              padding: "2px 5px",
              borderRadius: "4px",
              border: "1px solid #2c3540",
              flexShrink: 0,
            }}
          >
            Ctrl K
          </kbd>
        )}
      </div>

      {isOpen && (
        <SearchAutocomplete
          searchManager={searchManager}
          query={query}
          results={results}
          onRunQuery={handleRunQuery}
          onSelectResult={handleSelect}
        />
      )}
    </div>
  );
}
