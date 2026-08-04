// Tipos del contexto chileno (OGUC + Estándar BIM para Proyectos Públicos +
// Matriz PlanBIM V3.0). Ver src/metadata/ para los datos reales asociados a
// estos tipos.

/** Fase de diseño IDS: DC (Conceptual), DA (Anteproyecto), DB (Básico), DD (Detallado/Ejecutivo). */
export type Phase = "DC" | "DA" | "DB" | "DD";

/**
 * Organismo mandante de un proyecto público chileno. NO tiene todavía
 * ninguna lógica de generación/derivación asociada - no existe hoy una
 * fuente de datos real que varíe requisitos IDS por mandante (a diferencia
 * de Phase/BIMUse/TDI/DestinationCategory, que sí derivan de datos reales
 * verificados). Se declara para que el tipo esté disponible cuando esa
 * fuente exista.
 */
export type Mandante = "MOP" | "MINVU" | "MINSAL" | "MINEDUC" | "MINDEP" | "OTRO";

/** Identificador de Uso BIM (Estándar BIM para Proyectos Públicos, Tabla 06). Ver metadata/bim-uses.ts para las 25 definiciones reales. */
export type BIMUseId = string;

/** Identificador de Tipo de Información (Estándar BIM para Proyectos Públicos, Tabla 07). Ver metadata/bim-uses.ts para las 15 definiciones reales. */
export type TDIId = string;

/**
 * Destino del edificio según OGUC Art. 4.2.4. Las claves reales (no las
 * etiquetas en español) - ver metadata/oguc-fire-safety.ts para las
 * definiciones completas (label, condición, exigencia de fuego).
 */
export type DestinationCategory =
  | "vivienda"
  | "oficinas"
  | "comercio"
  | "educacion"
  | "salud"
  | "industrial"
  | "otro";

/**
 * Resistencia al fuego exigida (sin guion: "F60", no "F-60") - coincide con
 * el formato real que devuelve deriveOgucFireSafety() en metadata/oguc-fire-safety.ts.
 */
export type FireResistance = "F30" | "F60" | "F90" | "F120";
