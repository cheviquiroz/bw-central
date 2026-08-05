// Índice público de report-core. NO incluye src/browser/ a propósito: ese
// único módulo depende de APIs de browser (document/canvas/Image) y debe
// importarse explícitamente desde "@bw-central/report-core/browser" - ver
// src/browser/resizeImage.ts para la justificación completa.
export * from "./model";
export * from "./pdf";
export * from "./excel";
export * from "./adapters";
