declare const __brand: unique symbol;

/**
 * Creates a nominal type from a base type.
 */
export type Brand<T, Name> = T & {
  readonly [__brand]: Name;
};

/**
 * Uniquely identifies a Project within the Engine.
 */
export type ProjectId = Brand<string, "ProjectId">;

export type Project = {
  readonly id: ProjectId;
};

/**
 * Uniquely identifies a Federation within the Engine.
 */
export type FederationId = Brand<string, "FederationId">;

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

export interface ModelProps {
  id: ModelId;
  name: string;
}

/**
 * Entidad de Dominio que representa un modelo IFC dentro de nuestro ecosistema.
 */
export class Model {
  private props: ModelProps;

  constructor(props: ModelProps) {
    this.props = props;
  }

  get id(): ModelId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }
}

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
