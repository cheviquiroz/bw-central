// src/viewer/bcf/base64.ts
//
// Conversión bytes <-> base64 para snapshots BCF (bcf-core entrega/espera
// siempre bytes crudos, nunca base64 - ver @bw-central/bcf-core). Ambas
// direcciones viven acá, compartidas entre BcfImporter.ts (decode: bytes ->
// data URI para <img src>) y BcfExporter.ts (encode: data URI -> bytes para
// escribir de vuelta el snapshot.png), en vez de mantener una copia
// duplicada en cada archivo.
//
// Deliberadamente SIN spread (`String.fromCharCode(...bytes)`): spreadear
// un TypedArray grande en una llamada variádica depende de un límite de
// argumentos que ningún estándar garantiza - distinto por engine, y
// concretamente más bajo en JavaScriptCore (Safari) que en V8 (Chrome).
// Un array de varios MB revienta ese límite y tira un error solo en
// Safari. El loop indexado de acá abajo no tiene ese límite: no importa
// cuántos bytes tenga la imagen, nunca es una única llamada con miles de
// argumentos.

/** Bytes crudos -> string base64 (sin el prefijo "data:...;base64,"). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** String base64 (sin el prefijo "data:...;base64,") -> bytes crudos. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
