// src/components/PropertiesPanel/PropertiesPanel.tsx
import { useEffect, useState, useMemo, useCallback } from "react";
import type { ReactNode, CSSProperties } from "react";
import { readIfcName, readIfcPropertyValue, groupPropertySets } from "@bw-central/ifc-core";
import { useApp } from "../../ui/AppContext";
import type { SelectionState } from "../../engine/createApplication";
import { IconLock } from "../../ui/icons/dock";
import { usePanelWidth } from "../../ui/PanelWidthContext";
import "../../styles/properties.css";

const COLLAPSED_WIDTH = 56;
const EXPANDED_WIDTH = 272;

type TabType = "PROPERTIES" | "QUANTITIES" | "BSDD";

const BASE_QUANTITIES_KEY = "BaseQuantities";

function getPropertyValue(prop: any): string {
  return readIfcPropertyValue(prop) ?? "—";
}

function getPropertyName(prop: any, index: number): string {
  return readIfcName(prop) ?? `Propiedad #${index + 1}`;
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
  // isRightDockOpen es compartido con BcfPanel (misma tab-slot desde la
  // Fase 3) - ver PanelWidthContext.tsx para por qué no puede ser un
  // useState local a este componente. Reemplaza tanto el viejo isPinned
  // como la interpolación de ancho por proximity-hover: abrir/cerrar es
  // ahora binario y solo pasa por click, nunca por acercar el mouse.
  const { isRightDockOpen, setIsRightDockOpen, setPanelWidth } = usePanelWidth();
  const width = isRightDockOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  useEffect(() => {
    const unsubscribe = app.subscribeToSelection((newSelection) => {
      setSelection(newSelection);
    });
    return () => unsubscribe();
  }, [app]);

  // Publica el ancho real (56 o 272px, ya no interpolado - ver arriba)
  // para que OrientationCube (en Viewport.tsx, un componente hermano sin
  // relación directa con este) pueda correrse a la izquierda y no quedar
  // tapado cuando el panel expande - ver PanelWidthContext.tsx.
  useEffect(() => {
    setPanelWidth(width);
  }, [width, setPanelWidth]);

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

    Object.entries(data).forEach(([key, val]) => {
      try {
        if (key !== "IsDefinedBy") attrs.push([key, val]);
      } catch (err) {
        console.warn(`⚠️ Error procesando la propiedad IFC [${key}]:`, err);
      }
    });

    let sets: Record<string, any[]> = {};
    try {
      // Solo llegan acá Psets con un array real de propiedades individuales
      // (groupPropertySets omite relaciones sin HasProperties/Quantities) -
      // se prefiere omitir el Pset a mostrar la relación cruda (metadatos
      // internos como _category/_localId/_guid).
      sets = groupPropertySets(data);
    } catch (err) {
      console.warn("⚠️ Error procesando Property Sets:", err);
    }

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

  const isCollapsed = !isRightDockOpen;

  return (
    <div
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
        {/* Antes alternaba isPinned - ya no hay proximity-hover del que
            "pinnear" (ver PanelWidthContext.tsx), así que esto es
            simplemente cerrar el panel, no un toggle con estado propio. */}
        <button className="properties-pin" onClick={() => setIsRightDockOpen(false)} title="Cerrar panel">
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
