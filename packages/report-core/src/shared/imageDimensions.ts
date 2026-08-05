// Lee ancho/alto de una imagen sin canvas ni ninguna librería de imágenes -
// usado por el renderer Excel (a diferencia de jsPDF, que trae su propio
// parser de headers PNG/JPEG vía getImageProperties, ExcelJS no expone
// nada equivalente).
//
// Solo PNG está implementado: el spec define su header en offsets fijos
// (firma de 8 bytes + chunk IHDR, con width en el byte 16 y height en el
// byte 20, big-endian uint32) - un parseo directo y de bajo riesgo. JPEG
// requeriría escanear marcadores SOF en offsets variables (más lógica, más
// superficie de error) y no hay una fuente real en este ecosistema que ya
// lo resolviera para copiar con confianza - se devuelve null, igual que el
// comportamiento original de getImageDimensions() en Node (gracefully
// degrada a un aspect ratio asumido en el caller, no revienta).

export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24) return null;
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (width === 0 || height === 0) return null;
  return { width, height };
}
