// ÚNICO archivo de este paquete que depende de APIs de browser
// (document/canvas/Image) - ver el resumen del commit que agrega
// report-core para la justificación completa de por qué el resto del
// paquete es isomorfo (corre en Node sin polyfills, verificado
// empíricamente) y esto específicamente no puede serlo. Portado de
// bcf-pdf-exporter/src/lib/imageUtils.js (resizeImage).
//
// NO se importa desde el índice público del paquete
// (@bw-central/report-core) - hay que importarlo explícitamente desde
// "@bw-central/report-core/browser". Tiene su propio tsconfig
// (tsconfig.browser.json, con lib DOM) separado del resto del paquete, así
// que un uso accidental de `document`/`window` en cualquier otro archivo
// de report-core es un error de compilación, no algo que dependa de
// acordarse de grepear.
//
// DESVIACIÓN DELIBERADA del original: imageUtils.js degradaba en silencio
// si corría en Node (`typeof document === "undefined"` -> devolvía la
// imagen sin tocar), porque ahí el resize se llamaba SIEMPRE como parte
// del pipeline principal, que también debía poder correr en Node (para su
// test de pipeline). Acá el resize es explícitamente opt-in - ningún
// renderer de report-core lo llama automáticamente - así que si un caller
// lo invoca en Node de todos modos, es un error del caller: se prefiere un
// throw claro a un no-op silencioso que podría confundir ("¿por qué mi PDF
// no bajó de peso?").

export interface ResizeOptions {
  mimeType?: "image/png" | "image/jpeg";
  quality?: number;
}

export interface ResizedImage {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  // btoa espera un string binario ("un char = un byte") - construirlo de
  // una sola pasada con String.fromCharCode(...bytes) revienta el límite
  // de argumentos del engine en imágenes grandes, por eso se arma en chunks.
  const CHUNK_SIZE = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Redimensiona/recomprime una imagen usando un <canvas> real de browser -
 * baja el peso de un reporte cuando la imagen fuente es mucho más grande
 * que su tamaño real de despliegue (p.ej. un screenshot BCF de varios MB
 * mostrado a 40mm). Lanza si no hay `document`/canvas disponible (ver nota
 * de diseño arriba).
 */
export async function resizeImageBytes(
  bytes: Uint8Array,
  sourceMimeType: "image/png" | "image/jpeg",
  maxWidthPx: number,
  opts: ResizeOptions = {}
): Promise<ResizedImage> {
  if (typeof document === "undefined") {
    throw new Error("resizeImageBytes requiere un entorno de browser (document/canvas) - no está disponible en Node.");
  }

  const outputMime = opts.mimeType ?? sourceMimeType;
  const quality = opts.quality ?? 0.85;
  const dataUrl = bytesToDataUrl(bytes, sourceMimeType);

  return new Promise<ResizedImage>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        if (!img.width || !img.height) {
          resolve({ bytes, mimeType: sourceMimeType });
          return;
        }
        const scale = Math.min(1, maxWidthPx / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ bytes, mimeType: sourceMimeType });
          return;
        }
        if (outputMime === "image/jpeg") {
          // JPEG no soporta transparencia: fondo blanco para que no queden
          // píxeles negros donde había canal alfa.
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ bytes: dataUrlToBytes(canvas.toDataURL(outputMime, quality)), mimeType: outputMime });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    img.onerror = () => reject(new Error("No se pudo cargar la imagen para redimensionar."));
    img.src = dataUrl;
  });
}

/** mm -> px a una densidad dada (default 200dpi, nítido para impresión sin ser excesivo). */
export function mmToPx(mm: number, dpi = 200): number {
  return Math.round((mm / 25.4) * dpi);
}
