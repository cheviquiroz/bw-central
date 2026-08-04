// src/engine/domain/model/ModelId.ts

/**
 * Identificador único para los modelos dentro del dominio del motor.
 *
 * Determinístico: se deriva de un hash del contenido real del archivo,
 * nunca del nombre ni de un valor aleatorio. Dos archivos con bytes
 * idénticos producen el mismo ModelId (duplicado real, se rechaza).
 * Dos archivos con nombre igual pero contenido distinto producen
 * ModelId distintos (no son duplicados; el nombre visible se resuelve
 * aparte, ver registerModelInFederation).
 */
export class ModelId {
  private readonly value: string;

  constructor(contentHash: string) {
    this.value = contentHash;
  }

  toString(): string {
    return this.value;
  }

  equals(other: ModelId): boolean {
    return this.value === other.toString();
  }
}
