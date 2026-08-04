// Catálogo de organismos mandantes de proyectos públicos chilenos.
//
// ALCANCE DELIBERADO: esto es SOLO un catálogo de nombres (id + nombre
// completo real del organismo) - no incluye "perfiles de requisitos" por
// mandante (qué Usos BIM, TDI o exigencias exige cada uno). No existe hoy
// una fuente de datos real y verificada para eso (a diferencia de la Matriz
// PlanBIM o los destinos OGUC, que sí vienen de fuentes oficiales
// verificadas - ver planbim-v3.ts y oguc-fire-safety.ts). Inventar esos
// perfiles sin una fuente real sería presentar como oficial algo que no lo
// es, en un dominio de cumplimiento normativo real - se deja explícitamente
// pendiente hasta contar con esa fuente.

import type { Mandante } from "../types/chilean-context";

export interface MandanteInfo {
  id: Mandante;
  name: string;
}

export const MANDANTES: Record<Mandante, MandanteInfo> = {
  MOP: { id: "MOP", name: "Ministerio de Obras Públicas" },
  MINVU: { id: "MINVU", name: "Ministerio de Vivienda y Urbanismo" },
  MINSAL: { id: "MINSAL", name: "Ministerio de Salud" },
  MINEDUC: { id: "MINEDUC", name: "Ministerio de Educación" },
  MINDEP: { id: "MINDEP", name: "Ministerio del Deporte" },
  OTRO: { id: "OTRO", name: "Otro organismo mandante" },
};
