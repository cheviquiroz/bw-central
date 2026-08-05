// Art. 4.2.10 OGUC - Tabla de Escaleras, transcribed verbatim by the
// domain expert. Ranges are inclusive on both ends ("Desde 51 hasta 100"
// means 51 <= personas <= 100).

export interface StairsTableRow {
  minPersons: number;
  maxPersons: number;
  minCount: number;
  minWidthM: number;
  articulo: "4.2.10";
}

export const STAIRS_TABLE: StairsTableRow[] = [
  { minPersons: 1, maxPersons: 50, minCount: 1, minWidthM: 1.1, articulo: "4.2.10" },
  { minPersons: 51, maxPersons: 100, minCount: 1, minWidthM: 1.2, articulo: "4.2.10" },
  { minPersons: 101, maxPersons: 150, minCount: 1, minWidthM: 1.3, articulo: "4.2.10" },
  { minPersons: 151, maxPersons: 200, minCount: 1, minWidthM: 1.4, articulo: "4.2.10" },
  { minPersons: 201, maxPersons: 250, minCount: 1, minWidthM: 1.5, articulo: "4.2.10" },
  { minPersons: 251, maxPersons: 300, minCount: 2, minWidthM: 1.2, articulo: "4.2.10" },
  { minPersons: 301, maxPersons: 400, minCount: 2, minWidthM: 1.3, articulo: "4.2.10" },
  { minPersons: 401, maxPersons: 500, minCount: 2, minWidthM: 1.4, articulo: "4.2.10" },
  { minPersons: 501, maxPersons: 700, minCount: 2, minWidthM: 1.5, articulo: "4.2.10" },
  { minPersons: 701, maxPersons: 1000, minCount: 2, minWidthM: 1.6, articulo: "4.2.10" },
];

/** "Sobre 1.000 personas: requiere Estudio de Evacuación adjunto" - the table does not extend past this, and this package does not extrapolate it. */
export const STAIRS_STUDY_REQUIRED_ABOVE_PERSONS = 1000;

export type StairsLookupResult =
  | { status: "no-requirement"; detail: string }
  | { status: "requires-study"; articulo: "4.2.10"; detail: string }
  | { status: "table"; row: StairsTableRow };

export function lookupStairsRequirement(totalPersons: number): StairsLookupResult {
  if (totalPersons <= 0) {
    return { status: "no-requirement", detail: "Zero or negative occupancy load - no stairs requirement to evaluate." };
  }
  if (totalPersons > STAIRS_STUDY_REQUIRED_ABOVE_PERSONS) {
    return {
      status: "requires-study",
      articulo: "4.2.10",
      detail: `Occupancy load of ${totalPersons} exceeds ${STAIRS_STUDY_REQUIRED_ABOVE_PERSONS} personas - Art. 4.2.10 requires an Estudio de Evacuación adjunto (cantidad, disposición y características de escaleras adicionales) above this threshold. This package does not extrapolate the table past 1.000 and cannot produce that study itself.`,
    };
  }
  const row = STAIRS_TABLE.find((r) => totalPersons >= r.minPersons && totalPersons <= r.maxPersons);
  if (!row) {
    // No debería ocurrir: la tabla cubre 1..1000 sin huecos. Si esto se
    // dispara, es un error de transcripción de la tabla, no un caso de
    // negocio a resolver en silencio.
    throw new Error(`No Art. 4.2.10 table row covers ${totalPersons} personas - gap in the transcribed table.`);
  }
  return { status: "table", row };
}
