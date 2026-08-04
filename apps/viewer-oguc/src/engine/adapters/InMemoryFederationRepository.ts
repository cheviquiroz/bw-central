// src/engine/adapters/InMemoryFederationRepository.ts
import type { Federation, FederationId } from "@bw-central/ifc-core";
import type { FederationRepository } from "../ports/FederationRepository";

/**
 * Implementación en memoria del repositorio, para V1.
 * Se reemplazará por persistencia real cuando el proyecto lo requiera.
 */
export class InMemoryFederationRepository implements FederationRepository {
  private store = new Map<string, Federation>();

  /** Método de arranque, no forma parte del contrato público del puerto. */
  seed(federation: Federation): void {
    this.store.set(federation.id as unknown as string, federation);
  }

  async get(id: FederationId): Promise<Federation | null> {
    return this.store.get(id as unknown as string) ?? null;
  }

  async save(federation: Federation): Promise<void> {
    this.store.set(federation.id as unknown as string, federation);
  }
}