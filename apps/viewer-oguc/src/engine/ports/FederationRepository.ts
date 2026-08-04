import type { Federation, FederationId } from "@bw-central/ifc-core";

export interface FederationRepository {
  get(id: FederationId): Promise<Federation | null>;
  save(federation: Federation): Promise<void>;
}