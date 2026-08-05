import type { IfcApi } from "./webifc.js";
import type { IfcSchemaVersion } from "../types.js";

export function readSchema(api: IfcApi, modelID: number): IfcSchemaVersion {
  return api.GetModelSchema(modelID);
}
