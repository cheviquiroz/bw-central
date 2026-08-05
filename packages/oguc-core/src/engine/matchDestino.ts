// Maps a real IfcSpace's declared name fields to a destino category in
// the Art. 4.2.4 table (dictionary/occupancyLoad.ts). This is assisted
// matching, never silent auto-assignment: every result carries a
// confidence level, which field matched, and a plain-language reasoning
// string, so a human can check it before it feeds a report. An unmatched
// space is a real, named outcome ("deberán asimilarse a los allí
// señalados" - Art. 4.2.4), not a fallback default.
//
// KNOWN LIMITATION, worth restating even though the confidence field
// exists to flag it: this matcher only compares the destino NOUN
// (e.g. "estacionamiento" vs "Estacionamientos de uso común o
// públicos"). It does not evaluate qualifiers baked into the table text
// itself, like "de uso común o público", "en niveles con acceso
// exterior", or "superficie total" vs "superficie útil". A private
// single-house garage and a public parking garage can both match
// "otros.estacionamientos" by this mechanism even though the article's
// "uso común o público" qualifier may not actually apply to the former -
// that judgement call is left to the human reviewing the match, which is
// exactly why this function never resolves to a number on its own
// without a confidence/reasoning trail attached.

import type { IfcSpaceRecord } from "@bw-central/ifc-headless";
import { OCCUPANCY_LOAD_TABLE, type OccupancyFactorEntry } from "../dictionary/occupancyLoad.js";
import { STARTER_SYNONYMS } from "../dictionary/synonyms.js";

export type DestinoMatchConfidence = "exact" | "high" | "low" | "unmatched";

export interface DestinoMatch {
  destino: string | null;
  categoria: string | null;
  label: string | null;
  articulo: "4.2.4" | null;
  m2PorPersona: number | null;
  requiresManualTier: boolean;
  confidence: DestinoMatchConfidence;
  matchedField: "longName" | "description" | "name" | "objectType" | null;
  matchedText: string | null;
  reasoning: string;
}

const FIELD_PRIORITY: Array<"longName" | "description" | "name" | "objectType"> = ["longName", "description", "name", "objectType"];

const STOPWORDS = new Set([
  "de", "del", "la", "las", "el", "los", "en", "y", "o", "a", "con", "para", "por", "su", "un", "una",
  // Generic grammatical qualifiers that recur across many, unrelated
  // Art. 4.2.4 rows ("de uso comun o publicos", "superficie total",
  // "superficie util") - these are not category-defining nouns, and
  // matching on one alone produces a false category match (e.g. a space
  // literally named "Comun" matching "Estacionamientos... de uso comun"
  // on the word "comun", not on "estacionamientos"). Excluded from
  // tokenization entirely so they can never be the sole basis of a match.
  "comun", "comunes", "publico", "publicos", "total", "totales", "superficie", "util", "utiles", "general", "generales",
]);

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents (combining diacritical marks after NFD decomposition)
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/** Crude plural stem: strips a single trailing "s" on tokens long enough that this is unlikely to eat a real word ("estacionamientos" -> "estacionamiento"). Not a real stemmer - a defensible minimal one for Spanish table-label matching only. */
function stem(token: string): string {
  return token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token;
}

function translateTokens(tokens: string[]): string[] {
  return tokens.flatMap((t) => {
    const translated = STARTER_SYNONYMS[t];
    return translated ? translated.split(" ") : [t];
  });
}

interface FieldMatch {
  entry: OccupancyFactorEntry;
  confidence: Exclude<DestinoMatchConfidence, "unmatched">;
  matchedText: string;
  viaSynonym: boolean;
}

function matchField(rawFieldValue: string, entry: OccupancyFactorEntry): FieldMatch | null {
  const fieldNormalized = normalize(rawFieldValue);
  const labelNormalized = normalize(entry.label);
  if (fieldNormalized.length === 0) return null;

  if (fieldNormalized === labelNormalized) {
    return { entry, confidence: "exact", matchedText: rawFieldValue, viaSynonym: false };
  }

  const fieldTokensRaw = tokenize(fieldNormalized);
  const fieldTokensTranslated = translateTokens(fieldTokensRaw);
  const usedSynonym = fieldTokensTranslated.join(" ") !== fieldTokensRaw.join(" ");

  // Whole-token comparison only, deliberately - NOT raw substring
  // matching on the full normalized string. A raw `labelNormalized.includes(x)`
  // check would let "comun" match inside "...areas comunes..." (a
  // different word), which is exactly the false-positive class this
  // matcher must not produce silently.
  const labelTokens = tokenize(labelNormalized).map(stem);
  const fieldTokensStemmed = fieldTokensTranslated.map(stem);

  const shorter = fieldTokensStemmed.length <= labelTokens.length ? fieldTokensStemmed : labelTokens;
  const longer = shorter === fieldTokensStemmed ? labelTokens : fieldTokensStemmed;
  const hasSignificantToken = shorter.some((t) => t.length >= 5);
  const everyShorterTokenFound = shorter.length > 0 && shorter.every((t) => longer.includes(t));
  if (everyShorterTokenFound && hasSignificantToken) {
    return { entry, confidence: "high", matchedText: rawFieldValue, viaSynonym: usedSynonym };
  }

  const sharedToken = fieldTokensStemmed.find((t) => t.length >= 5 && labelTokens.includes(t));
  if (sharedToken) {
    return { entry, confidence: "low", matchedText: rawFieldValue, viaSynonym: usedSynonym };
  }

  return null;
}

function unmatched(reasoning: string): DestinoMatch {
  return {
    destino: null,
    categoria: null,
    label: null,
    articulo: null,
    m2PorPersona: null,
    requiresManualTier: false,
    confidence: "unmatched",
    matchedField: null,
    matchedText: null,
    reasoning,
  };
}

const CONFIDENCE_RANK: Record<Exclude<DestinoMatchConfidence, "unmatched">, number> = { exact: 2, high: 1, low: 0 };

export function matchDestino(space: IfcSpaceRecord): DestinoMatch {
  const fields: Array<{ field: (typeof FIELD_PRIORITY)[number]; value: string | null }> = FIELD_PRIORITY.map((field) => ({
    field,
    value: space[field],
  }));

  let best: { field: (typeof FIELD_PRIORITY)[number]; match: FieldMatch } | null = null;

  for (const { field, value } of fields) {
    if (!value) continue;
    for (const entry of OCCUPANCY_LOAD_TABLE) {
      const match = matchField(value, entry);
      if (!match) continue;
      if (!best || CONFIDENCE_RANK[match.confidence] > CONFIDENCE_RANK[best.match.confidence]) {
        best = { field, match };
      }
    }
    // Un match "exact" en el campo de más prioridad ya no puede ser
    // superado por otro campo de menor prioridad - no sigue buscando en
    // los campos restantes.
    if (best?.match.confidence === "exact") break;
  }

  if (!best) {
    return unmatched(
      `No dictionary entry's label shares a distinctive word with this space's name/longName/description/objectType (checked in that priority order, with the starter Italian->Spanish synonym list applied). Per Art. 4.2.4's own text ("deberán asimilarse a los allí señalados"), this space needs a manual destino assignment from the domain expert - not a guessed default.`
    );
  }

  const { field, match } = best;
  const synonymNote = match.viaSynonym ? " (matched after applying a starter Italian->Spanish synonym translation - verify the translation is appropriate here)." : ".";
  const qualifierNote =
    match.entry.categoria === "Otros" && match.confidence !== "exact"
      ? " NOTE: this table row may carry qualifiers (e.g. \"de uso común o público\", \"superficie total\") not evaluated by this matcher - confirm the qualifier actually applies before using this match."
      : "";

  return {
    destino: match.entry.destino,
    categoria: match.entry.categoria,
    label: match.entry.label,
    articulo: match.entry.articulo,
    m2PorPersona: match.entry.requiresUnitLevelArea ? null : match.entry.m2PorPersona,
    requiresManualTier: Boolean(match.entry.requiresUnitLevelArea),
    confidence: match.confidence,
    matchedField: field,
    matchedText: match.matchedText,
    reasoning: `Matched space's "${field}" ("${match.matchedText}") to Art. 4.2.4 row "${match.entry.label}" (${match.entry.categoria}) with ${match.confidence} confidence${synonymNote}${qualifierNote}`,
  };
}
