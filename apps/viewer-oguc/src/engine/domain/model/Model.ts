// src/engine/domain/model/Model.ts
import { ModelId } from "./ModelId";

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