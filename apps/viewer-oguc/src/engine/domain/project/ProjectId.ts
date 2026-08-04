import type { Brand } from "../shared/primitives";

/**
 * Uniquely identifies a Project within the Engine.
 */
export type ProjectId = Brand<string, "ProjectId">;