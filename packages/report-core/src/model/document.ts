// Modelo genérico de reporte: no sabe nada de BCF, IFC ni OGUC. Está
// diseñado a partir de lo que las dos generación reales existentes
// (bcf-pdf-exporter's pdfGenerator.js/xlsxGenerator.js) efectivamente
// necesitan expresar - no de una lista abstracta de "lo que un reporte
// podría necesitar" - pero sin ningún campo específico de BCF: la
// traducción BCF -> este modelo vive en adapters/bcf.ts.
//
// Pensado también para los dos consumidores futuros ya conocidos (ver el
// prompt de extracción): un cuadro de superficies OGUC (Excel, agrupado por
// piso/destino/unidad, con drill-down a los recintos de origen) y un
// informe de cumplimiento normativo (PDF, hallazgos con artículo OGUC
// citado, ubicación y captura de pantalla). Ambos calzan con Section +
// TableBlock(rows con `detail`) + ImageBlock + TextBlock, sin necesitar
// ningún campo nuevo - ver el adaptador BCF para el patrón real de uso.

/** Color en hex "#RRGGBB". Cada renderer lo convierte a su propio formato nativo (PDF: [r,g,b]; Excel: ARGB). */
export type Color = string;

export interface ImageBlock {
  type: "image";
  /** Bytes crudos (PNG/JPEG) - nunca un data URI, ni un objeto DOM Image/canvas. */
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
  caption?: string;
  /** Límites de layout en mm; si se omiten, cada renderer aplica un tamaño por defecto razonable manteniendo el aspect ratio. */
  maxWidthMm?: number;
  maxHeightMm?: number;
  /**
   * Variante de mayor resolución de la MISMA imagen (p.ej. el screenshot
   * original, sin recomprimir a miniatura). El renderer Excel la vuelca en
   * una hoja de detalle aparte con un link desde la miniatura - mismo
   * patrón que ya usaba xlsxGenerator.js por topic, ahora genérico. El
   * renderer PDF la ignora (un PDF no tiene el concepto de "hoja aparte";
   * si se necesita, usar TableRow.detail con su propio ImageBlock).
   */
  fullResolution?: { bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" };
}

export type CellValue = string | number | null;

export interface TableColumn {
  key: string;
  header: string;
  /** Ancho de columna: "unidades de caracter" en Excel, o mm sugeridos en PDF (se autoescala si no caben todas). */
  width?: number;
}

export interface TableRow {
  cells: Record<string, CellValue>;
  /** Color de fondo para toda la fila (p.ej. estado). */
  fill?: Color;
  /** Imagen embebida en una celda específica (columna = key). */
  images?: Record<string, ImageBlock>;
  /**
   * Contenido de detalle asociado a esta fila (drill-down). El renderer
   * Excel lo vuelca en una hoja aparte con un hyperlink desde la fila
   * ("Ver detalle →") - mismo patrón que las hojas por topic del
   * Coordination Report original. El renderer PDF lo ignora hoy (no hay
   * concepto de navegación entre páginas implementado) - queda disponible
   * en el modelo para cuando haga falta.
   */
  detail?: { label: string; blocks: Block[] };
}

export interface TableBlock {
  type: "table";
  columns: TableColumn[];
  rows: TableRow[];
}

export interface KeyValueBlock {
  type: "keyValue";
  items: { label: string; value: string }[];
  /** Cuántas columnas de pares label:value en paralelo. Por defecto 1. */
  columns?: 1 | 2;
}

export interface TextBlock {
  type: "text";
  text: string;
  style?: "heading" | "subheading" | "body" | "caption";
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: Color;
}

/**
 * Gráfico vectorial (sin canvas, sin imagen rasterizada). El renderer PDF
 * lo dibuja con las primitivas de jsPDF (ver pdf/charts.ts, portado de
 * chartDraw.js). El renderer Excel NO dibuja gráficos nativos de Excel
 * (xlsxGenerator.js original tampoco lo hacía - no había nada que portar
 * ahí): en su lugar, vuelca los mismos datos como una tabla compacta
 * label/valor, para no descartar contenido en silencio.
 */
export interface ChartBlock {
  type: "chart";
  chartType: "pie" | "donut" | "barVertical" | "barHorizontal";
  title?: string;
  data: ChartDataPoint[];
}

export type Block = TextBlock | KeyValueBlock | TableBlock | ImageBlock | ChartBlock;

export interface Section {
  heading?: string;
  blocks: Block[];
  /** Si true, la sección arranca en página nueva (PDF). En Excel, cada Section con heading se vuelca en su propia hoja de todos modos. */
  pageBreakBefore?: boolean;
  /**
   * Barra de color fina bajo el encabezado de la sección (PDF) - generaliza
   * el color-por-estado que pdfGenerator.js dibujaba por topic (ver
   * adapters/bcf.ts), sin que el renderer conozca "estado" como concepto:
   * cualquier reporte puede querer un acento de color por sección (p.ej.
   * severidad de un hallazgo normativo).
   */
  accentColor?: Color;
}

export interface ReportDocument {
  title: string;
  subtitle?: string;
  author?: string;
  /** ISO 8601. Si se omite, cada renderer usa la fecha de generación actual. */
  date?: string;
  logo?: ImageBlock;
  sections: Section[];
  /** Pie de página PDF, con tokens {page} y {total}. Si se omite, no se agrega pie de página. Sin efecto en Excel. */
  footerTemplate?: string;
  /** Portada dedicada (título/subtítulo/autor/fecha/logo) como página 1 del PDF. Por defecto true. Sin efecto en Excel. */
  showCoverPage?: boolean;
}
