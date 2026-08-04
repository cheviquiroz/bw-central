import type { Federation } from "../domain/federation/Federation";
import type { FederationId } from "../domain/federation/FederationId";

export interface FederationRepository {
  get(id: FederationId): Promise<Federation | null>;
  save(federation: Federation): Promise<void>;
}