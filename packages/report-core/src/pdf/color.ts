import type { Color } from "../model/document";

/** "#RRGGBB" (o "RRGGBB") -> [r,g,b] para las primitivas de color de jsPDF. */
export function hexToRgb(color: Color): [number, number, number] {
  const hex = color.replace(/^#/, "");
  const r = parseInt(hex.slice(0, 2), 16) || 0;
  const g = parseInt(hex.slice(2, 4), 16) || 0;
  const b = parseInt(hex.slice(4, 6), 16) || 0;
  return [r, g, b];
}
