export interface IfcNamed {
  Name?: { value?: unknown } | string | null;
  [key: string]: unknown;
}

export interface IfcItemData extends IfcNamed {
  IsDefinedBy?: unknown;
}

/**
 * Lee el atributo Name de una entidad IFC, sea que venga envuelto
 * ({ value: "..." }, forma típica de @thatopen/fragments) o como string
 * plano. Devuelve null si no hay un nombre no vacío.
 */
export function readIfcName(entity: IfcNamed | null | undefined): string | null {
  const raw = entity?.Name;
  const unwrapped = raw && typeof raw === "object" && "value" in raw ? (raw as { value: unknown }).value : raw;
  return typeof unwrapped === "string" && unwrapped.length > 0 ? unwrapped : null;
}

/**
 * Cada propiedad IFC (IfcPropertySingleValue, IfcQuantityLength, etc.)
 * guarda su valor en un campo distinto según el tipo (NominalValue,
 * LengthValue, AreaValue...), pero todos siguen la misma convención de
 * nombre: terminan en "Value". Buscar por ese patrón, en vez de una lista
 * fija de nombres, cubre tanto Psets como Quantities sin enumerarlos.
 */
export function readIfcPropertyValue(prop: unknown): string | null {
  if (!prop || typeof prop !== "object") return null;

  for (const [key, val] of Object.entries(prop as Record<string, unknown>)) {
    if (key === "Name" || key.startsWith("_") || !key.endsWith("Value")) continue;
    const unwrapped = val && typeof val === "object" && "value" in val ? (val as { value: unknown }).value : val;
    if (unwrapped === null || unwrapped === undefined) continue;
    return String(unwrapped);
  }

  return null;
}

/**
 * Agrupa las relaciones IsDefinedBy de un elemento por Pset/Quantity set,
 * sin transformar los valores individuales - pensado para UI que renderiza
 * cada propiedad con su propio formato (ver PropertiesPanel).
 */
export function groupPropertySets(
  data: IfcItemData | null | undefined,
  fallbackName: (relationIndex: number) => string = (i) => `PropertySet_#${i}`
): Record<string, unknown[]> {
  const sets: Record<string, unknown[]> = {};
  const relations = data?.IsDefinedBy;
  if (!Array.isArray(relations)) return sets;

  relations.forEach((rel: unknown, rIdx: number) => {
    const relRecord = rel as IfcNamed & { HasProperties?: unknown; Quantities?: unknown };
    const psetName = readIfcName(relRecord) ?? fallbackName(rIdx);
    const props = relRecord?.HasProperties ?? relRecord?.Quantities;
    if (Array.isArray(props)) sets[psetName] = props;
  });

  return sets;
}

/**
 * Igual que groupPropertySets, pero con los valores ya extraídos a string -
 * pensado para indexar/filtrar (ver SearchManager), no para renderizar.
 * Los quantity sets (ej. BaseQuantities/Qto_*) son IfcElementQuantity, no
 * IfcPropertySet - guardan sus valores bajo Quantities, no HasProperties.
 */
export function extractPsetValues(
  data: IfcItemData | null | undefined,
  fallbackName: string = "Pset"
): Record<string, Record<string, string>> {
  const psets: Record<string, Record<string, string>> = {};
  const relations = data?.IsDefinedBy;
  if (!Array.isArray(relations)) return psets;

  for (const rel of relations as unknown[]) {
    const relRecord = rel as IfcNamed & { HasProperties?: unknown; Quantities?: unknown };
    const psetName = readIfcName(relRecord) ?? fallbackName;
    const props = relRecord?.HasProperties ?? relRecord?.Quantities;
    if (!Array.isArray(props)) continue;

    const values: Record<string, string> = {};
    for (const prop of props) {
      const propName = readIfcName(prop as IfcNamed);
      if (propName === null) continue;

      const value = readIfcPropertyValue(prop);
      if (value !== null) values[propName] = value;
    }
    psets[psetName] = values;
  }

  return psets;
}
