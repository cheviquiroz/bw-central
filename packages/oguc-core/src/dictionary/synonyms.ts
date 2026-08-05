// Starter seam for destino matching (see engine/matchDestino.ts). This is
// deliberately small: real, defensible Italian->Spanish word
// translations for terms actually observed in the real fixtures
// (CASA-ARQ.ifc uses Italian room-naming conventions), not an invented
// or exhaustive room-naming synonym list. The domain expert extends this
// file directly as more real-world naming conventions are encountered -
// no engine code changes needed to add an entry.
//
// Each entry translates a single normalized (lowercase, no accents)
// token found in a space's Name/LongName/Description to the Spanish word
// used in the Art. 4.2.4 table, so the matcher in matchDestino.ts can
// compare like with like. Adding a wrong or over-eager entry here is
// exactly how a false regulatory match happens - keep this list narrow.
export const STARTER_SYNONYMS: Record<string, string> = {
  // Italian, real loanwords/cognates - CASA-ARQ.ifc's actual vocabulary.
  bagno: "baño",
  cucina: "cocina",
  garage: "estacionamiento",
  ufficio: "oficina",
};
