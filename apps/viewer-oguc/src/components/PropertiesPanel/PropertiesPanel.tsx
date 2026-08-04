// src/components/PropertiesPanel/PropertiesPanel.tsx
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { ReactNode, CSSProperties } from "react";
import { useApp } from "../../ui/AppContext";
import type { SelectionState } from "../../engine/createApplication";
import { IconLock } from "../../ui/icons/dock";
import { usePanelWidth } from "../../ui/PanelWidthContext";
import "../../styles/properties.css";

const COLLAPSED_WIDTH = 56;
const EXPANDED_WIDTH = 272;
const COLLAPSE_THRESHOLD = 150;
const PROXIMITY_THRESHOLD = 30;
const PANEL_RIGHT = 16; // debe coincidir con `right: 16px` de .properties-panel
const PANEL_EDGE_FROM_RIGHT = PANEL_RIGHT + COLLAPSED_WIDTH; // 72 - espejo de PANEL_EDGE en DockLeft

type TabType = "PROPERTIES" | "QUANTITIES" | "BSDD";

const BASE_QUANTITIES_KEY = "BaseQuantities";

// Cada propiedad IFC (IfcPropertySingleValue, IfcQuantityLength, etc.)
// guarda su valor en un campo distinto según el tipo (NominalValue,
// LengthValue, AreaValue...), pero todos siguen la misma convención de
// nombre: terminan en "Value". Buscar por ese patrón, en vez de una lista
// fija de nombres, cubre tanto Psets como Quantities sin enumerarlos.
function getPropertyValue(prop: any): string {
  if (!prop || typeof prop !== "object") return "—";

  for (const [key, val] of Object.entries(prop)) {
    if (key === "Name" || key.startsWith("_") || !key.endsWith("Value")) continue;
    const unwrapped = val && typeof val === "object" && "value" in val ? (val as any).value : val;
    if (unwrapped === null || unwrapped === undefined) continue;
    return String(unwrapped);
  }

  return "—";
}

function getPropertyName(prop: any, index: number): string {
  const raw = prop?.Name?.value ?? prop?.Name;
  return typeof raw === "string" ? raw : `Propiedad #${index + 1}`;
}

// toLocaleString con locale 'es-ES' se probó y descartó: da coma decimal
// ("3,78") en vez del punto que se espera, y de paso agrupa miles
// ("1.234,5") - inconsistente con el resto de valores numéricos del panel,
// que siempre se muestran en formato plano. Redondear y volver a string
// evita el locale por completo: Number.prototype.toString() usa punto
// decimal siempre, sin importar la configuración regional del navegador.
function formatQuantity(value: number, decimals = 2): string {
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(value * factor) / factor;
  return rounded.toString();
}

// Formatea solo si el string realmente representa un número (no un GUID,
// código, o "—") - un string vacío pasa Number()===0, por eso se excluye
// aparte en vez de confiar solo en Number.isFinite.
function formatQuantityValue(propValue: string): string {
  if (propValue === "—" || propValue.trim() === "") return propValue;
  const numericValue = Number(propValue);
  return Number.isFinite(numericValue) ? formatQuantity(numericValue) : propValue;
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// Nota: la spec original pedía una prop "initialOpen" (valor por defecto,
// no controlado). Acá el panel SÍ necesita recordar qué Psets colapsó el
// usuario mientras navega la selección (está en el "State" pedido:
// expandedPsets), así que este componente quedó controlado de verdad
// (open/onToggle) en vez de manejar su propio estado interno - "initialOpen"
// hubiera sido inconsistente con esa necesidad.
function ExpandibleSection({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="expandible-section">
      <div className="expandible-header" onClick={onToggle}>
        <span className={`expandible-chevron${open ? " open" : ""}`}>
          <IconChevron />
        </span>
        <span className="expandible-title">{title}</span>
        <span className="expandible-count">[{count}]</span>
      </div>
      <div className={`expandible-body${open ? " open" : ""}`}>
        <div className="expandible-body-inner">{children}</div>
      </div>
    </div>
  );
}

export default function PropertiesPanel() {
  const app = useApp();
  const [selection, setSelection] = useState<SelectionState>(app.getSelection());
  const [activeTab, setActiveTab] = useState<TabType>("PROPERTIES");
  const [expandedPsets, setExpandedPsets] = useState<Record<string, boolean>>({});
  const [isPinned, setIsPinned] = useState(false);
  const [width, setWidth] = useState(COLLAPSED_WIDTH);
  const { setPanelWidth } = usePanelWidth();
  const panelRef = useRef<HTMLDivElement>(null);

  const widthRef = useRef(width);
  widthRef.current = width;
  const isPinnedRef = useRef(isPinned);
  isPinnedRef.current = isPinned;
  const rafRef = useRef<number | null>(null);
  const pendingMouseXRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = app.subscribeToSelection((newSelection) => {
      setSelection(newSelection);
    });
    return () => unsubscribe();
  }, [app]);

  // Publica el ancho real (56-272px, ya interpolado por el proximity-hover
  // de más abajo) para que OrientationCube (en Viewport.tsx, un componente
  // hermano sin relación directa con este) pueda correrse a la izquierda y
  // no quedar tapado cuando el panel expande - ver PanelWidthContext.tsx.
  useEffect(() => {
    setPanelWidth(width);
  }, [width, setPanelWidth]);

  // Proximity-hover espejado del de DockLeft.tsx (mismo rAF-batching +
  // umbral de 1px, mismos motivos - ver los comentarios extensos ahí). La
  // diferencia real es que este panel cuelga del borde DERECHO: en vez de
  // comparar mouseX contra PANEL_LEFT/PANEL_EDGE, se compara la distancia
  // del mouse al borde derecho de la ventana (window.innerWidth - clientX)
  // contra PANEL_RIGHT/PANEL_EDGE_FROM_RIGHT, que son sus equivalentes
  // espejados.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPinnedRef.current) return;
      pendingMouseXRef.current = e.clientX;

      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const mouseX = pendingMouseXRef.current;
        if (mouseX === null) return;

        const distanceFromRight = window.innerWidth - mouseX;
        const currentLeftEdgeFromRight = PANEL_RIGHT + widthRef.current;
        const isOverPanel = distanceFromRight >= PANEL_RIGHT && distanceFromRight <= currentLeftEdgeFromRight;

        let nextWidth: number;
        if (isOverPanel) {
          nextWidth = EXPANDED_WIDTH;
        } else {
          const distanceToEdge = Math.max(0, distanceFromRight - PANEL_EDGE_FROM_RIGHT);
          if (distanceToEdge < PROXIMITY_THRESHOLD) {
            const proximityZone = PROXIMITY_THRESHOLD - distanceToEdge;
            nextWidth = Math.round(COLLAPSED_WIDTH + (proximityZone / PROXIMITY_THRESHOLD) * (EXPANDED_WIDTH - COLLAPSED_WIDTH));
          } else {
            nextWidth = COLLAPSED_WIDTH;
          }
        }

        if (Math.abs(nextWidth - widthRef.current) >= 1) {
          setWidth(nextWidth);
        }
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (isPinned) setWidth(EXPANDED_WIDTH);
  }, [isPinned]);

  const activeModelId = Object.keys(selection).find((modelId) => selection[modelId].length > 0);
  const currentGuids = activeModelId ? selection[activeModelId] : [];

  // Clasificación de datos blindada contra referencias circulares
  const { attributes, psets, ifcCategory, elementName, selectedElement, extraData } = useMemo(() => {
    const fallback = {
      attributes: [] as [string, any][],
      psets: {} as Record<string, any[]>,
      ifcCategory: "IFCElement",
      elementName: "Sin Nombre",
      selectedElement: null as any,
      extraData: null as any,
    };
    if (!activeModelId || currentGuids.length === 0) return fallback;

    const el = app.getSelectedElementsData()[0];
    const data = el?.data;
    if (!data) return fallback;

    const category = data?._category?.value || data?.ObjectType?.value || "IfcProduct";
    const name = data?.Name?.value || data?.Name || `Elemento #${data?._localId?.value || "Sin Nombre"}`;

    const attrs: [string, any][] = [];
    const sets: Record<string, any[]> = {};

    Object.entries(data).forEach(([key, val]) => {
      try {
        if (key === "IsDefinedBy" && Array.isArray(val)) {
          val.forEach((rel, rIdx) => {
            try {
              const psetName = rel?.Name?.value || rel?.Name || `PropertySet_#${rIdx}`;
              const props = rel?.HasProperties || rel?.Quantities;
              // Solo aceptar un array real de propiedades individuales - si
              // no existe, es mejor omitir el Pset que mostrar la relación
              // cruda (metadatos internos como _category/_localId/_guid).
              if (Array.isArray(props)) {
                sets[psetName] = props;
              }
            } catch (err) {
              console.warn("⚠️ Error omitiendo rama circular en sub-pset:", err);
            }
          });
        } else {
          attrs.push([key, val]);
        }
      } catch (err) {
        console.warn(`⚠️ Error procesando la propiedad IFC [${key}]:`, err);
      }
    });

    return { attributes: attrs, psets: sets, ifcCategory: category, elementName: name, selectedElement: el, extraData: data };
  }, [selection, activeModelId, currentGuids, app]);

  // Al cambiar de elemento seleccionado, arrancar de nuevo con todo
  // expandido - así un Pset colapsado en el elemento anterior no queda
  // "pegado" por casualidad de nombre en el elemento nuevo.
  useEffect(() => {
    setExpandedPsets({});
  }, [selectedElement]);

  const togglePset = useCallback((name: string) => {
    setExpandedPsets((prev) => ({ ...prev, [name]: !(prev[name] ?? true) }));
  }, []);

  const hasSelection = Boolean(activeModelId) && currentGuids.length > 0;
  const totalSelected = currentGuids.length;
  const isMultiSelection = totalSelected > 1;

  const formatKeyName = (key: string) => {
    let clean = key.startsWith("_") ? key.substring(1) : key;
    if (clean.toLowerCase() === "guid") return "GlobalId (GUID)";
    if (clean.toLowerCase() === "localid") return "Express ID";
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  const renderValue = (val: any): string => {
    if (val === null || val === undefined) return "—";
    if (val && typeof val === "object" && "value" in val) return String(val.value);
    if (Array.isArray(val)) return `[Lista de ${val.length} elemento${val.length === 1 ? "" : "s"}]`;

    if (typeof val === "object") {
      try {
        const seen = new WeakSet();
        return JSON.stringify(val, (_, v) => {
          if (typeof v === "object" && v !== null) {
            if (seen.has(v)) return "[Ref Circular]";
            seen.add(v);
          }
          return v?.value !== undefined ? v.value : v;
        });
      } catch {
        return "[Objeto Complejo]";
      }
    }
    return String(val);
  };

  const guid = selectedElement?.guid || extraData?._guid?.value || extraData?.GlobalId?.value || currentGuids[0] || "—";
  const expressId = extraData?._localId?.value || extraData?.id || "N/A";

  // "Attributes" muestra Name/Description junto con el resto de atributos
  // reales del elemento - solo se excluyen las claves puramente internas
  // (_category/_guid/_localId/id/GlobalId), que ya se muestran arriba como
  // GlobalId/Express ID.
  const otherAttributes = attributes.filter(
    ([key]) => !["_category", "_guid", "_localId", "id", "GlobalId"].includes(key)
  );

  // Búsqueda por substring, no por igualdad exacta: en Casa_Ulivi.ifc y
  // ARC.ifc el quantity set viene nombrado literal "BaseQuantities", pero
  // la convención real de IFC (buildingSMART) los nombra
  // "Qto_<Tipo>BaseQuantities" (ej. "Qto_WallBaseQuantities",
  // "Qto_SlabBaseQuantities") - con igualdad exacta, cualquier IFC
  // exportado de forma estándar (Revit/ArchiCAD reales) nunca hubiera
  // matcheado y la pestaña Quantities habría quedado vacía siempre.
  const baseQuantitiesEntry = Object.entries(psets).find(([name]) => name.includes(BASE_QUANTITIES_KEY));
  const baseQuantitiesName = baseQuantitiesEntry?.[0];
  const baseQuantities = baseQuantitiesEntry?.[1];

  const psetEntries = Object.entries(psets).filter(([name]) => name !== baseQuantitiesName);

  const isCollapsed = width < COLLAPSE_THRESHOLD;

  return (
    <div
      ref={panelRef}
      className={`properties-panel${isCollapsed ? " collapsed" : ""}`}
      style={{ "--properties-width": `${width}px` } as CSSProperties}
    >
      {/* Header contextual: siempre presente, con placeholders si no hay selección */}
      <div className="properties-header">
        <div className="properties-header-text">
          <p className={`prop-type${hasSelection ? " has-selection" : ""}`}>{hasSelection ? ifcCategory : "IFCElement"}</p>
          <p className={`prop-name${hasSelection ? " has-selection" : ""}`}>{hasSelection ? elementName : "Ningún elemento seleccionado"}</p>
          <p className="prop-model">{hasSelection ? activeModelId : "—"}</p>
        </div>
        <button
          className={`properties-pin${isPinned ? " active" : ""}`}
          onClick={() => setIsPinned((v) => !v)}
          title={isPinned ? "Desfijar panel" : "Fijar panel"}
        >
          <IconLock />
        </button>
      </div>

      {/* Ya no se abrevia a "P"/"Q"/"B" en collapsed: el efecto blur+opacity
          de acá abajo (.properties-panel.collapsed .properties-tabs) ya
          resuelve el "compacto pero presente" - abreviar Y blurrear a la vez
          hubiera sido redundante (una letra sola, encima borrosa). */}
      <div className="properties-tabs">
        <button className={`prop-tab${activeTab === "PROPERTIES" ? " active" : ""}`} onClick={() => setActiveTab("PROPERTIES")}>
          Properties
        </button>
        <button className={`prop-tab${activeTab === "QUANTITIES" ? " active" : ""}`} onClick={() => setActiveTab("QUANTITIES")}>
          Quantities
        </button>
        <button className={`prop-tab${activeTab === "BSDD" ? " active" : ""}`} onClick={() => setActiveTab("BSDD")}>
          bSDD
        </button>
      </div>

      <div className="properties-body">
        {!hasSelection && <div className="prop-empty">No element selected</div>}

        {hasSelection && isMultiSelection && (
          <div className="prop-multi">
            {totalSelected} elementos seleccionados. Mostrando propiedades del primero.
          </div>
        )}

        {hasSelection && activeTab === "PROPERTIES" && (
          <>
            <div className="prop-section">
              <div className="prop-section-title">Attributes</div>
              <div className="prop-row">
                <span className="prop-key">GlobalId</span>
                <span className="prop-val">{guid}</span>
              </div>
              <div className="prop-row">
                <span className="prop-key">Express ID</span>
                <span className="prop-val">{expressId}</span>
              </div>
              {otherAttributes.map(([key, val]) => (
                <div className="prop-row" key={key}>
                  <span className="prop-key">{formatKeyName(key)}</span>
                  <span className="prop-val">{renderValue(val)}</span>
                </div>
              ))}
            </div>

            {psetEntries.length === 0 ? (
              <p className="prop-section-empty">No hay Property Sets definidos para este elemento.</p>
            ) : (
              psetEntries.map(([setName, properties]) => (
                <ExpandibleSection
                  key={setName}
                  title={setName}
                  count={properties.length}
                  open={expandedPsets[setName] ?? true}
                  onToggle={() => togglePset(setName)}
                >
                  {properties.map((prop, pIdx) => {
                    const propName = getPropertyName(prop, pIdx);
                    const propValue = getPropertyValue(prop);
                    const canFilter = propValue !== "—";
                    return (
                      <div
                        className={`prop-row${canFilter ? " filterable" : ""}`}
                        key={pIdx}
                        onClick={(e) => {
                          if (canFilter && e.shiftKey) app.requestSearchQuery(`${propName}:${propValue}`);
                        }}
                        title={canFilter ? "Shift+click para buscar por esta propiedad" : undefined}
                      >
                        <span className="prop-key">{propName}</span>
                        <span className="prop-val">{propValue}</span>
                      </div>
                    );
                  })}
                </ExpandibleSection>
              ))
            )}
          </>
        )}

        {hasSelection && activeTab === "QUANTITIES" && (
          baseQuantities && baseQuantitiesName ? (
            <ExpandibleSection
              title={baseQuantitiesName}
              count={baseQuantities.length}
              open={expandedPsets[baseQuantitiesName] ?? true}
              onToggle={() => togglePset(baseQuantitiesName)}
            >
              {baseQuantities.map((prop, pIdx) => {
                const propName = getPropertyName(prop, pIdx);
                const propValue = getPropertyValue(prop);
                const canFilter = propValue !== "—";
                return (
                  <div
                    className={`prop-row${canFilter ? " filterable" : ""}`}
                    key={pIdx}
                    onClick={(e) => {
                      if (canFilter && e.shiftKey) app.requestSearchQuery(`${propName}:${propValue}`);
                    }}
                    title={canFilter ? "Shift+click para buscar por esta propiedad" : undefined}
                  >
                    <span className="prop-key">{propName}</span>
                    <span className="prop-val">{formatQuantityValue(propValue)}</span>
                  </div>
                );
              })}
            </ExpandibleSection>
          ) : (
            <p className="prop-section-empty">Este elemento no tiene BaseQuantities definidas.</p>
          )
        )}

        {hasSelection && activeTab === "BSDD" && <div className="prop-empty">Coming Soon</div>}
      </div>
    </div>
  );
}
