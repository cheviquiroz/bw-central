// Gráficos vectoriales dibujados directamente con las primitivas de jsPDF
// (rect, triangle, circle, line, text) - portado casi verbatim de
// bcf-pdf-exporter/src/lib/chartDraw.js (que a su vez no depende de
// ninguna librería de charting externa ni de canvas/DOM: son formas
// geométricas simples calculadas a mano, por eso pesan casi nada en el PDF
// final y se ven nítidas a cualquier zoom). La única diferencia real con
// el original es de tipos: acá los datos vienen como ChartDataPoint[] del
// modelo genérico (Color en hex "#RRGGBB"), no como arrays [r,g,b] sueltos.

import type { jsPDF } from "jspdf";
import type { ChartDataPoint } from "../model/document";
import { hexToRgb } from "./color";

// Misma paleta que el original, para series sin un color "canónico" propio
// (a diferencia de p.ej. un estado BCF, que si trae color explícito en el
// ChartDataPoint).
const PALETTE: [number, number, number][] = [
  [37, 99, 235], // azul
  [220, 53, 69], // rojo
  [40, 167, 69], // verde
  [255, 193, 7], // amarillo
  [111, 66, 193], // morado
  [23, 162, 184], // celeste
  [253, 126, 20], // naranja
  [108, 117, 125], // gris
];

function paletteColor(i: number): [number, number, number] {
  return PALETTE[i % PALETTE.length];
}

function colorOf(point: ChartDataPoint, fallbackIndex: number): [number, number, number] {
  return point.color ? hexToRgb(point.color) : paletteColor(fallbackIndex);
}

export interface PieChartOptions {
  cx: number;
  cy: number;
  radius: number;
  innerRadiusRatio?: number;
  data: ChartDataPoint[];
}

/** Gráfico de torta (o donut si innerRadiusRatio > 0). */
export function drawPieChart(doc: jsPDF, { cx, cy, radius, innerRadiusRatio = 0, data }: PieChartOptions): void {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return;

  let startAngle = -90; // 12 en punto
  data.forEach((seg, i) => {
    const angle = (seg.value / total) * 360;
    if (angle > 0) {
      const [r, g, b] = colorOf(seg, i);
      doc.setFillColor(r, g, b);
      const steps = Math.max(1, Math.round(angle / 3)); // ~3° por triángulo, se ve suave
      const angleStep = angle / steps;
      for (let s = 0; s < steps; s++) {
        const a0 = ((startAngle + s * angleStep) * Math.PI) / 180;
        const a1 = ((startAngle + (s + 1) * angleStep) * Math.PI) / 180;
        const x0 = cx + radius * Math.cos(a0);
        const y0 = cy + radius * Math.sin(a0);
        const x1 = cx + radius * Math.cos(a1);
        const y1 = cy + radius * Math.sin(a1);
        doc.triangle(cx, cy, x0, y0, x1, y1, "F");
      }
    }
    startAngle += angle;
  });

  if (innerRadiusRatio > 0) {
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, radius * innerRadiusRatio, "F");
  }
}

export interface LegendOptions {
  x: number;
  y: number;
  items: ChartDataPoint[];
  fontSize?: number;
  rowGap?: number;
}

/** Leyenda simple: cuadradito de color + "Etiqueta (valor)" en filas. */
export function drawLegend(doc: jsPDF, { x, y, items, fontSize = 8, rowGap = 5.5 }: LegendOptions): void {
  items.forEach((it, i) => {
    const iy = y + i * rowGap;
    const [r, g, b] = colorOf(it, i);
    doc.setFillColor(r, g, b);
    doc.rect(x, iy - 3, 3, 3, "F");
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    doc.text(`${it.label} (${it.value})`, x + 5, iy);
    doc.setTextColor(0);
  });
}

export interface BarChartOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  bars: ChartDataPoint[];
  maxValue?: number;
}

/** Gráfico de barras verticales. */
export function drawBarChart(doc: jsPDF, { x, y, width, height, bars, maxValue }: BarChartOptions): void {
  if (!bars.length) return;
  doc.setDrawColor(210);
  doc.line(x, y + height, x + width, y + height);

  const n = bars.length;
  const gap = 3;
  const barWidth = Math.max(2, (width - gap * (n + 1)) / n);
  const max = maxValue || Math.max(...bars.map((b) => b.value), 1);

  bars.forEach((b, i) => {
    const bh = max > 0 ? (b.value / max) * height : 0;
    const bx = x + gap + i * (barWidth + gap);
    const by = y + height - bh;
    const [r, g, b2] = colorOf(b, i);
    doc.setFillColor(r, g, b2);
    if (bh > 0.3) doc.rect(bx, by, barWidth, bh, "F");

    doc.setFontSize(7.5);
    doc.setTextColor(70);
    doc.text(String(b.value), bx + barWidth / 2, by - 1.5, { align: "center" });

    doc.setFontSize(6.5);
    doc.setTextColor(90);
    const labelLines = doc.splitTextToSize(b.label, barWidth + 3);
    doc.text(labelLines.slice(0, 2), bx + barWidth / 2, y + height + 4, { align: "center" });
    doc.setTextColor(0);
  });
}

export interface HBarChartOptions {
  x: number;
  y: number;
  width: number;
  bars: ChartDataPoint[];
  rowHeight?: number;
  labelWidth?: number;
}

/** Gráfico de barras horizontales (rankings). Devuelve el alto total (mm) que ocupó, para seguir posicionando contenido después. */
export function drawHBarChart(doc: jsPDF, { x, y, width, bars, rowHeight = 7, labelWidth = 45 }: HBarChartOptions): number {
  if (!bars.length) return 0;
  const max = Math.max(...bars.map((b) => b.value), 1);
  const barMaxW = width - labelWidth - 12;

  bars.forEach((b, i) => {
    const by = y + i * rowHeight;
    doc.setFontSize(7.5);
    doc.setTextColor(50);
    const labelLines = doc.splitTextToSize(b.label, labelWidth - 2);
    doc.text(labelLines[0] || "", x, by + rowHeight / 2 + 1);

    const bw = (b.value / max) * barMaxW;
    const [r, g, bl] = colorOf(b, i);
    doc.setFillColor(r, g, bl);
    if (bw > 0.3) doc.rect(x + labelWidth, by + 1.2, bw, rowHeight - 3, "F");

    doc.setFontSize(7);
    doc.setTextColor(80);
    doc.text(String(b.value), x + labelWidth + bw + 2, by + rowHeight / 2 + 1);
    doc.setTextColor(0);
  });

  return bars.length * rowHeight;
}
