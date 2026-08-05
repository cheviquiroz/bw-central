// Lee un archivo .bcf/.bcfzip (ZIP) hacia el modelo de dominio (ver
// types.ts). Puro: sin DOMParser, sin ningún API del browser - usa
// fast-xml-parser (ya usado en @bw-central/ids-core, misma elección por
// consistencia) en vez de la dependencia de un DOMParser global, que era
// lo que ataba a DOM tanto a bcf-pdf-exporter como al módulo BCF del
// viewer.
//
// Estructura real de un .bcf (verificada contra un .bcf de ejemplo real,
// no solo contra la documentación - mismo hallazgo en las dos
// implementaciones originales):
//   bcf.version                  <Version VersionId="2.1"/>
//   {topic-guid}/markup.bcf      <Markup><Topic/><Comment>*<Viewpoints>*</Markup>
//   {topic-guid}/viewpoint.bcfv  <VisualizationInfo>...
//   {topic-guid}/snapshot.png
// El nombre de carpeta NO se asume UUID por regex: se deriva del path real
// de cada markup.bcf encontrado, para funcionar aunque el ZIP no tenga
// entradas de directorio explícitas (varios exportadores BCF reales las
// omiten).
//
// SUBTLETY DE <Comment> (ver también types.ts): el schema BCF usa
// <Comment> tanto para el elemento contenedor (hijo directo de <Markup>)
// como para el campo de texto adentro de él
// (<Comment Guid="..."><Comment>texto</Comment></Comment>). Con un parser
// DOM, un querySelectorAll("Comment") genérico matchea ambos niveles y
// duplica todo (las dos implementaciones originales lo resolvían filtrando
// a mano solo los hijos directos de <Markup>). Acá no hace falta ese
// filtro manual: fast-xml-parser arma un objeto anidado, así que
// Markup.Comment (forzado a array por jPath exacto) y cada
// Markup.Comment[i].Comment (el campo de texto interno, un string plano)
// son propiedades distintas en niveles distintos - no hay ambigüedad que
// resolver.

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type {
  BcfProject,
  BcfTopic,
  BcfComment,
  BcfViewpoint,
  BcfCamera,
  BcfClippingPlane,
  BcfComponent,
  BcfComponents,
  BcfVersion,
  BcfVector3,
} from "./types";

/** jPaths donde un tag ambiguo (Comment) debe forzarse a array SOLO en ese nivel exacto. */
const FORCE_ARRAY_JPATHS = new Set(["Markup.Comment"]);

/** Tags sin ambigüedad de nesting: siempre repetibles donde aparecen. */
const FORCE_ARRAY_TAGS = new Set(["Labels", "ReferenceLink", "RelatedTopic", "Viewpoints", "ClippingPlane", "Component", "Color"]);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  isArray: (tagName, jPath) => FORCE_ARRAY_JPATHS.has(jPath) || FORCE_ARRAY_TAGS.has(tagName),
});

type XmlNode = Record<string, unknown>;

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalText(node: XmlNode, key: string): string | undefined {
  return node[key] !== undefined ? textOf(node[key]) : undefined;
}

function attrString(node: XmlNode, attrName: string): string {
  const value = node[`@_${attrName}`];
  return value !== undefined ? String(value) : "";
}

function optionalAttrString(node: XmlNode, attrName: string): string | undefined {
  const value = node[`@_${attrName}`];
  return value !== undefined ? String(value) : undefined;
}

function vector3(node: XmlNode | undefined): BcfVector3 {
  return {
    x: parseFloat(textOf(node?.X)) || 0,
    y: parseFloat(textOf(node?.Y)) || 0,
    z: parseFloat(textOf(node?.Z)) || 0,
  };
}

function parseComponent(node: XmlNode): BcfComponent {
  return {
    ifcGuid: attrString(node, "IfcGuid"),
    originatingSystem: optionalAttrString(node, "OriginatingSystem"),
    authoringToolId: optionalAttrString(node, "AuthoringToolId"),
  };
}

function parseComponents(node: XmlNode | undefined): BcfComponents {
  const componentsNode = node ?? {};

  const selectionNode = componentsNode.Selection as XmlNode | undefined;
  const selection = toArray(selectionNode?.Component as XmlNode[]).map(parseComponent);

  const coloringNode = componentsNode.Coloring as XmlNode | undefined;
  const coloring = toArray(coloringNode?.Color as XmlNode[]).map((colorNode) => ({
    color: attrString(colorNode, "Color"),
    components: toArray(colorNode.Component as XmlNode[]).map(parseComponent),
  }));

  const visibilityNode = componentsNode.Visibility as XmlNode | undefined;
  const visibility = visibilityNode
    ? {
        defaultVisibility: attrString(visibilityNode, "DefaultVisibility") === "true",
        exceptions: toArray((visibilityNode.Exceptions as XmlNode | undefined)?.Component as XmlNode[]).map(parseComponent),
      }
    : undefined;

  return { selection, visibility, coloring };
}

function parseCamera(vpNode: XmlNode): BcfCamera | undefined {
  const perspective = vpNode.PerspectiveCamera as XmlNode | undefined;
  const orthogonal = vpNode.OrthogonalCamera as XmlNode | undefined;
  const camNode = perspective ?? orthogonal;
  if (!camNode) return undefined;

  const camera: BcfCamera = {
    type: perspective ? "Perspective" : "Orthogonal",
    viewPoint: vector3(camNode.CameraViewPoint as XmlNode),
    direction: vector3(camNode.CameraDirection as XmlNode),
    upVector: vector3(camNode.CameraUpVector as XmlNode),
  };

  if (perspective?.FieldOfView !== undefined) {
    camera.fieldOfView = parseFloat(textOf(perspective.FieldOfView));
  }
  if (orthogonal?.ViewToWorldScale !== undefined) {
    camera.viewToWorldScale = parseFloat(textOf(orthogonal.ViewToWorldScale));
  }

  return camera;
}

function parseClippingPlanes(vpNode: XmlNode): BcfClippingPlane[] {
  const clippingPlanesNode = vpNode.ClippingPlanes as XmlNode | undefined;
  return toArray(clippingPlanesNode?.ClippingPlane as XmlNode[]).map((cp) => ({
    location: vector3(cp.Location as XmlNode),
    direction: vector3(cp.Direction as XmlNode),
  }));
}

function parseComments(markupNode: XmlNode): BcfComment[] {
  const comments = toArray(markupNode.Comment as XmlNode[]).map((c): BcfComment => {
    const viewpointRef = c.Viewpoint as XmlNode | undefined;
    const viewpointGuid = viewpointRef ? optionalAttrString(viewpointRef, "Guid") : undefined;
    return {
      guid: attrString(c, "Guid"),
      date: textOf(c.Date),
      author: textOf(c.Author),
      text: textOf(c.Comment),
      modifiedDate: optionalText(c, "ModifiedDate"),
      modifiedAuthor: optionalText(c, "ModifiedAuthor"),
      viewpointGuid,
    };
  });

  // Orden cronológico - mismo criterio que bcf-pdf-exporter (viewer-oguc no
  // ordenaba; el orden del archivo no está garantizado por el schema).
  comments.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return comments;
}

interface ViewpointRef {
  guid: string;
  viewpointFile: string;
  snapshotFile: string | null;
}

function parseViewpointRefs(markupNode: XmlNode): ViewpointRef[] {
  const refs = toArray(markupNode.Viewpoints as XmlNode[]);
  if (refs.length > 0) {
    return refs.map((ref) => ({
      guid: attrString(ref, "Guid"),
      viewpointFile: optionalAttrString(ref, "Viewpoint") ?? "viewpoint.bcfv",
      snapshotFile: optionalAttrString(ref, "Snapshot") ?? null,
    }));
  }
  // Fallback por convención: algunos exportadores BCF reales omiten
  // <Viewpoints> pero igual dejan viewpoint.bcfv/snapshot.png en la
  // carpeta del topic (mismo fallback que ya tenían las dos
  // implementaciones originales).
  return [{ guid: "", viewpointFile: "viewpoint.bcfv", snapshotFile: "snapshot.png" }];
}

function guessImageMimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

async function resolveViewpoint(zip: JSZip, ref: ViewpointRef, folder: string): Promise<BcfViewpoint | null> {
  const vpPath = folder + ref.viewpointFile;
  const snapPath = ref.snapshotFile ? folder + ref.snapshotFile : null;

  const vpFile = zip.file(vpPath);
  const snapFile = snapPath ? zip.file(snapPath) : null;
  if (!vpFile && !snapFile) return null;

  let guid = ref.guid;
  let camera: BcfCamera | undefined;
  let clippingPlanes: BcfClippingPlane[] = [];
  let components: BcfComponents = { selection: [], coloring: [] };

  if (vpFile) {
    const parsed = xmlParser.parse(await vpFile.async("string")) as { VisualizationInfo?: XmlNode };
    const vpNode = parsed.VisualizationInfo;
    if (vpNode) {
      if (!guid) guid = attrString(vpNode, "Guid");
      camera = parseCamera(vpNode);
      clippingPlanes = parseClippingPlanes(vpNode);
      components = parseComponents(vpNode.Components as XmlNode | undefined);
    }
  }

  let snapshot: Uint8Array | undefined;
  let snapshotMimeType: string | undefined;
  if (snapFile) {
    snapshot = await snapFile.async("uint8array");
    snapshotMimeType = guessImageMimeType(snapPath as string);
  }

  return { guid, camera, clippingPlanes, components, snapshot, snapshotMimeType };
}

function parseTopicFields(topicNode: XmlNode): Omit<BcfTopic, "comments" | "viewpoints"> {
  const indexRaw = topicNode.Index !== undefined ? parseInt(textOf(topicNode.Index), 10) : NaN;

  return {
    guid: attrString(topicNode, "Guid"),
    title: textOf(topicNode.Title) || "Untitled",
    topicType: optionalAttrString(topicNode, "TopicType"),
    topicStatus: optionalAttrString(topicNode, "TopicStatus"),
    priority: optionalText(topicNode, "Priority"),
    index: Number.isNaN(indexRaw) ? undefined : indexRaw,
    labels: toArray(topicNode.Labels as string[]),
    creationDate: textOf(topicNode.CreationDate),
    creationAuthor: textOf(topicNode.CreationAuthor),
    modifiedDate: optionalText(topicNode, "ModifiedDate"),
    modifiedAuthor: optionalText(topicNode, "ModifiedAuthor"),
    assignedTo: optionalText(topicNode, "AssignedTo"),
    dueDate: optionalText(topicNode, "DueDate"),
    stage: optionalText(topicNode, "Stage"),
    description: optionalText(topicNode, "Description"),
    // BimSnippet es en realidad un elemento complejo (Type/isExternal +
    // <Reference>/<ReferenceSchema>), no texto plano - ninguna de las dos
    // implementaciones originales lo parseaba correctamente (ambas leían
    // solo su textContent, casi siempre vacío en la práctica). Se preserva
    // ese mismo comportamiento incompleto en vez de fingir soporte real.
    bimSnippet: optionalText(topicNode, "BimSnippet"),
    referenceLinks: toArray(topicNode.ReferenceLink as string[]),
    relatedTopics: toArray(topicNode.RelatedTopic as XmlNode[]).map((r) => attrString(r, "Guid")),
  };
}

async function parseTopicFolder(zip: JSZip, markupFile: JSZip.JSZipObject): Promise<BcfTopic | null> {
  const lastSlash = markupFile.name.lastIndexOf("/");
  const folder = lastSlash === -1 ? "" : markupFile.name.slice(0, lastSlash + 1);

  const parsed = xmlParser.parse(await markupFile.async("string")) as { Markup?: XmlNode };
  const markupNode = parsed.Markup;
  if (!markupNode) return null;

  const topicNode = markupNode.Topic as XmlNode | undefined;
  if (!topicNode) return null;

  const fields = parseTopicFields(topicNode);
  if (!fields.guid) return null;

  const comments = parseComments(markupNode);

  const refs = parseViewpointRefs(markupNode);
  const viewpoints: BcfViewpoint[] = [];
  for (const ref of refs) {
    const vp = await resolveViewpoint(zip, ref, folder);
    if (vp) viewpoints.push(vp);
  }

  return { ...fields, comments, viewpoints };
}

export type BcfInput = Uint8Array | ArrayBuffer | Blob;

/** Parsea un archivo .bcf/.bcfzip completo hacia el modelo de dominio. */
export async function parseBcf(input: BcfInput): Promise<BcfProject> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input);
  } catch (err) {
    throw new Error(`No se pudo leer el archivo como .bcf/.bcfzip (¿está corrupto o no es un ZIP?): ${err instanceof Error ? err.message : String(err)}`);
  }

  const versionFiles = zip.file(/(^|\/)bcf\.version$/i);
  let version: BcfVersion = "unknown";
  if (versionFiles.length > 0) {
    const parsed = xmlParser.parse(await versionFiles[0].async("string")) as { Version?: XmlNode };
    version = parsed.Version ? attrString(parsed.Version, "VersionId") || "unknown" : "unknown";
  }

  const markupFiles = zip.file(/(^|\/)markup\.bcf$/i);
  if (markupFiles.length === 0) {
    throw new Error("El archivo no contiene ningún markup.bcf - no parece ser un archivo BCF válido.");
  }

  const topics: BcfTopic[] = [];
  for (const markupFile of markupFiles) {
    const topic = await parseTopicFolder(zip, markupFile);
    if (topic) topics.push(topic);
  }

  // Orden por Index si todos los topics lo traen, si no por fecha de creación.
  topics.sort((a, b) => {
    if (a.index !== undefined && b.index !== undefined) return a.index - b.index;
    return Date.parse(a.creationDate || "") - Date.parse(b.creationDate || "");
  });

  return { version, topics };
}
