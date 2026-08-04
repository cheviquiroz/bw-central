// src/viewer/bcf/types/schema.ts
import type { BcfPriority, BcfStatus, BcfTopic } from "./bcf";

// El estándar BCF NO fija un vocabulario cerrado para Priority/TopicStatus -
// son texto libre por proyecto (confirmado con un .bcf real de ejemplo,
// donde Priority viene en español: "Alta"). Estos normalizadores existen
// para no perder datos reales solo porque no calzan textualmente con el
// union type restringido que usa esta UI - mejor "Medium"/"Open" por
// default que descartar el topic entero.
export function normalizePriority(raw: string | null | undefined): BcfPriority {
  const value = (raw ?? "").trim().toLowerCase();
  if (["high", "alta", "alto", "urgent", "urgente"].includes(value)) return "High";
  if (["low", "baja", "bajo"].includes(value)) return "Low";
  return "Medium";
}

export function normalizeStatus(raw: string | null | undefined): BcfStatus {
  const value = (raw ?? "").trim().toLowerCase();
  if (/resolv|closed|cerrad|done|complet/.test(value)) return "Resolved";
  if (/review|pending|progress|revisi|pendient/.test(value)) return "Pending Review";
  return "Open";
}

// Chequeo defensivo mínimo antes de aceptar un topic parseado - un
// markup.bcf sin Guid o sin Title real no sirve para nada en la UI
// (no hay con qué identificarlo ni qué mostrar en la card).
export function isValidBcfTopic(topic: Partial<BcfTopic>): topic is BcfTopic {
  return Boolean(topic.guid) && Boolean(topic.title);
}
