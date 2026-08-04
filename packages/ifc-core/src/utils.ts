/**
 * Hash de contenido determinístico, usado como identidad de dominio para
 * un modelo (ver ModelId): dos archivos con bytes idénticos producen el
 * mismo hash, sin importar su nombre de archivo.
 */
export async function calculateSHA256(content: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", content.buffer as ArrayBuffer);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Chequeo liviano de que un buffer es un archivo IFC-SPF (STEP physical
 * file) válido: el formato de texto estándar de IFC siempre arranca con
 * la cabecera "ISO-10303-21;". No valida el contenido más allá de eso.
 */
export function isValidIfcHeader(content: Uint8Array): boolean {
  const headerBytes = content.subarray(0, 32);
  const header = new TextDecoder("utf-8").decode(headerBytes).trimStart();
  return header.startsWith("ISO-10303-21");
}
