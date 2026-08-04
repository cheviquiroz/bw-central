// Traduce las exigencias del Destino OGUC (Art. 4.2.4) a reglas que afectan
// qué requisitos IDS se generan.
//
// HOY la única regla real (verificada en ids-builder) es el filtro de
// propiedades de categoría "fuego": si el destino/condición del proyecto no
// exige resistencia al fuego, esas propiedades (FireRating, etc.) se omiten
// de la especificación en vez de exigirse como requisito.
//
// La exigencia de "zona vertical de seguridad" (verticalSafetyRequired) se
// deriva igual (ver deriveOgucFireSafety) pero NO se traduce hoy a ningún
// requisito IDS estructurado: IDS describe información del modelo IFC, no
// notas de seguridad de obra, y no hay todavía una faceta real (Pset o
// atributo IFC) que represente esa exigencia en la Matriz PlanBIM. Se expone
// el dato igual para que el caller (spec-generator, o una UI) lo use como
// texto descriptivo, sin fingir que existe una faceta IDS para eso.

import { deriveOgucFireSafety } from "../metadata/oguc-fire-safety";
import type { DestinationCategory, FireResistance } from "../types/chilean-context";
import type { MatrixCategory } from "../metadata/planbim-v3";

export interface ChileanFireRule {
  fireSafetyType: FireResistance | null;
  fireRatingRequired: boolean;
  verticalSafetyRequired: boolean;
}

/** Deriva la regla de fuego/seguridad vertical para un destino OGUC y su condición asociada. */
export function deriveFireRule(
  destination: DestinationCategory | undefined,
  destinationCondition: string | undefined
): ChileanFireRule {
  return deriveOgucFireSafety(destination, destinationCondition);
}

/**
 * Única regla real de filtrado hoy: las propiedades de categoría "fuego" de
 * la Matriz PlanBIM solo se incluyen si el destino OGUC exige resistencia
 * al fuego. El resto de las categorías nunca se filtra por esta regla.
 */
export function shouldIncludeCategory(category: MatrixCategory, fireRatingRequired: boolean): boolean {
  if (category === "fuego") return fireRatingRequired;
  return true;
}
