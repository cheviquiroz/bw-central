// Modelo de dominio BCF (BIM Collaboration Format), 2.0/2.1/3.0
// (https://github.com/buildingSMART/BCF-XML). Es la unión de lo que las dos
// implementaciones reales de este ecosistema ya parseaban por separado
// (bcf-pdf-exporter y el módulo BCF de viewer-oguc - ver el resumen de la
// investigación en el commit que agrega este paquete), más lo necesario
// para poder ESCRIBIR de vuelta un archivo BCF completo sin perder campos,
// cosa que ninguna de las dos hacía por sí sola.
//
// DECISIONES DELIBERADAS (donde las dos implementaciones originales
// divergían, o donde ninguna alcanzaba a cubrir el spec completo):
//
// 1. Priority/TopicStatus son STRING LIBRE, no un enum cerrado. El estándar
//    BCF no fija un vocabulario para estos campos (confirmado contra un
//    .bcf real donde Priority venía en español: "Alta") - viewer-oguc los
//    normalizaba a un enum cerrado (High/Medium/Low, Open/Pending
//    Review/Resolved) vía regex multilenguaje, lo cual es lossy (un valor
//    no reconocido caía silenciosamente en "Medium"/"Open", perdiendo el
//    dato real). Ese normalizador SÍ es útil para UI (bucketing para
//    colorear cards) y se portó igual, pero como helper opt-in en
//    normalize.ts - no se aplica en el reader.
//
// 2. Un topic puede tener VARIOS viewpoints (array), no uno solo.
//    bcf-pdf-exporter ya lo soportaba (vía múltiples <Viewpoints> en
//    markup.bcf); viewer-oguc solo leía el primero. El array es lo
//    correcto según el schema.
//
// 3. El snapshot se guarda como bytes crudos (Uint8Array), nunca como data
//    URI base64 ni como objeto DOM Image/canvas - las dos implementaciones
//    originales usaban data URIs ("data:image/png;base64,..."), que solo
//    tiene sentido para un <img src> en el browser. Queda a cargo del
//    caller (la app) convertir a lo que necesite.
//
// 4. version es un string libre (pass-through de VersionId), no un union
//    type cerrado a "2.0"|"2.1"|"3.0". bcf-pdf-exporter hacía pass-through
//    real; viewer-oguc restringía a esas 3 y caía en "2.1" en silencio si
//    no matcheaba - mismo problema de pérdida de información que (1).
//
// GAP CONOCIDO (fuera de alcance deliberado): no se lee/escribe el archivo
// opcional project.bcfp (ProjectId + Name a nivel de proyecto, no de
// topic). Es parte real del schema BCF, pero NINGUNA de las dos
// implementaciones originales lo maneja, así que no hay una referencia
// verificada en la práctica de su forma exacta para portar con confianza -
// se prefiere no tenerlo a adivinarlo.

export interface BcfVector3 {
  x: number;
  y: number;
  z: number;
}

export type BcfCameraType = "Perspective" | "Orthogonal";

export interface BcfCamera {
  type: BcfCameraType;
  viewPoint: BcfVector3;
  direction: BcfVector3;
  upVector: BcfVector3;
  /** Grados. Solo aplica a PerspectiveCamera. */
  fieldOfView?: number;
  /** Solo aplica a OrthogonalCamera. */
  viewToWorldScale?: number;
}

export interface BcfClippingPlane {
  location: BcfVector3;
  direction: BcfVector3;
}

/** Referencia a un componente IFC dentro de un viewpoint (Selection, Coloring, Visibility/Exceptions). */
export interface BcfComponent {
  ifcGuid: string;
  originatingSystem?: string;
  authoringToolId?: string;
}

export interface BcfColorGroup {
  /** Hex sin "#", p.ej. "FF0000" (tal como viene en el atributo Color del XML). */
  color: string;
  components: BcfComponent[];
}

export interface BcfVisibility {
  defaultVisibility: boolean;
  exceptions: BcfComponent[];
}

export interface BcfComponents {
  selection: BcfComponent[];
  visibility?: BcfVisibility;
  coloring: BcfColorGroup[];
}

export interface BcfViewpoint {
  guid: string;
  camera?: BcfCamera;
  clippingPlanes: BcfClippingPlane[];
  components: BcfComponents;
  /** Bytes crudos del snapshot (normalmente PNG) - nunca un data URI ni un objeto DOM. */
  snapshot?: Uint8Array;
  /** p.ej. "image/png". Solo tiene sentido si snapshot está presente. */
  snapshotMimeType?: string;
}

export interface BcfComment {
  guid: string;
  /** ISO 8601, tal cual viene del XML - no se reparsea a Date. */
  date: string;
  author: string;
  text: string;
  modifiedDate?: string;
  modifiedAuthor?: string;
  /** Guid del viewpoint al que responde este comentario, si aplica. */
  viewpointGuid?: string;
}

export interface BcfTopic {
  guid: string;
  title: string;
  topicType?: string;
  /** Texto libre (ver nota de diseño #1 arriba). Ver normalize.ts para bucketing opcional. */
  topicStatus?: string;
  /** Texto libre (ver nota de diseño #1 arriba). */
  priority?: string;
  index?: number;
  labels: string[];
  creationDate: string;
  creationAuthor: string;
  modifiedDate?: string;
  modifiedAuthor?: string;
  assignedTo?: string;
  /** BCF 3.0. */
  dueDate?: string;
  /** BCF 3.0. */
  stage?: string;
  description?: string;
  bimSnippet?: string;
  referenceLinks: string[];
  relatedTopics: string[];
  /** Orden cronológico (ver reader.ts). */
  comments: BcfComment[];
  viewpoints: BcfViewpoint[];
}

/** Pass-through del atributo VersionId de bcf.version (ver nota de diseño #4 arriba). "unknown" si el archivo no trae bcf.version. */
export type BcfVersion = string;

export interface BcfProject {
  version: BcfVersion;
  topics: BcfTopic[];
}
