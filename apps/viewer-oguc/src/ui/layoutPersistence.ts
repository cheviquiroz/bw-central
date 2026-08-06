// src/ui/layoutPersistence.ts
//
// Fase 5b: persiste visibilidad de paneles, tab activa de PropertiesPanel
// y altura de DockBottom entre recargas. Versionado en la key misma
// ("v1") - si el shape vuelve a cambiar, se sube a "v2" y el valor viejo
// simplemente deja de matchear (ver isValidPersistedLayout), en vez de
// migrar datos viejos a mano.
const STORAGE_KEY = "bwise.viewer.layout.v1";

// LayoutZones vive acá, no en LayoutStateContext.tsx (que la reexporta) -
// ese archivo importa loadPersistedLayout/savePersistedLayout de este
// mismo módulo, así que si LayoutZones se quedara allá este módulo
// tendría que importarla de vuelta, un ciclo real que
// check:architecture (dependency-cruiser) rechaza.
export interface LayoutZones {
  left: boolean;
  right: boolean;
  bottom: boolean;
}

export type PropertiesTab = "PROPERTIES" | "QUANTITIES" | "BSDD";

export interface PersistedLayout {
  zones: LayoutZones;
  propertiesTab: PropertiesTab;
  bottomDockHeight: number;
}

function isValidZones(value: unknown): value is LayoutZones {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as LayoutZones).left === "boolean" &&
    typeof (value as LayoutZones).right === "boolean" &&
    typeof (value as LayoutZones).bottom === "boolean"
  );
}

function isValidPropertiesTab(value: unknown): value is PropertiesTab {
  return value === "PROPERTIES" || value === "QUANTITIES" || value === "BSDD";
}

function isValidPersistedLayout(value: unknown): value is PersistedLayout {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as PersistedLayout;
  return (
    isValidZones(candidate.zones) &&
    isValidPropertiesTab(candidate.propertiesTab) &&
    typeof candidate.bottomDockHeight === "number" &&
    Number.isFinite(candidate.bottomDockHeight)
  );
}

// null en cualquier escenario "no hay nada útil que leer" (nunca visitó
// antes, localStorage deshabilitado/lleno, JSON corrupto, shape de una
// versión vieja) - el caller siempre tiene que tener un fallback a
// defaults listo, así que este helper nunca lanza.
export function loadPersistedLayout(): PersistedLayout | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidPersistedLayout(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function savePersistedLayout(layout: PersistedLayout): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Cuota excedida, modo privado, localStorage deshabilitado, etc. -
    // persistir el layout es un nice-to-have, nunca debe romper la app.
  }
}
