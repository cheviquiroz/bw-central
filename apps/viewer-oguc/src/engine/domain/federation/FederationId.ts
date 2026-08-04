import type { Brand } from "../shared/primitives";

/**
 * Uniquely identifies a Federation within the Engine.
 */
export type FederationId = Brand<string, "FederationId">;