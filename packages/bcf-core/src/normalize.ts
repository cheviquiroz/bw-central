// Helpers OPT-IN para bucketing de Priority/TopicStatus en un enum cerrado.
// El estándar BCF no fija un vocabulario para estos campos (confirmado
// contra un .bcf real donde Priority venía en español: "Alta") - por eso
// reader.ts los deja como string libre en BcfTopic. Estas funciones existen
// para UI que sí necesita un conjunto pequeño y cerrado de valores para
// colorear/agrupar (p.ej. las cards de BcfPanel en viewer-oguc), sin perder
// el dato real: el caller decide si normaliza o no, no queda aplicado por
// default en el reader.
//
// Portado de viewer-oguc (src/viewer/bcf/types/schema.ts).

export type BcfPriorityBucket = "Low" | "Medium" | "High";
export type BcfStatusBucket = "Open" | "Pending Review" | "Resolved";

export function normalizePriority(raw: string | null | undefined): BcfPriorityBucket {
  const value = (raw ?? "").trim().toLowerCase();
  if (["high", "alta", "alto", "urgent", "urgente"].includes(value)) return "High";
  if (["low", "baja", "bajo"].includes(value)) return "Low";
  return "Medium";
}

export function normalizeStatus(raw: string | null | undefined): BcfStatusBucket {
  const value = (raw ?? "").trim().toLowerCase();
  if (/resolv|closed|cerrad|done|complet/.test(value)) return "Resolved";
  if (/review|pending|progress|revisi|pendient/.test(value)) return "Pending Review";
  return "Open";
}
