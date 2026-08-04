// src/engine/domain/federation/Federation.ts
import type { FederationId } from "./FederationId";
import type { ModelId } from "../model/ModelId";

export interface FederatedModelEntry {
  readonly id: ModelId;
  readonly name: string;
}

/**
 * Represents a federated collection of models.
 * It is the operational aggregate root of the Engine.
 */
export type Federation = {
  readonly id: FederationId;
  readonly models: readonly FederatedModelEntry[];
};
