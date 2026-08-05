// src/viewer/bcf/BcfImporter.ts
//
// Adaptador delgado sobre @bw-central/bcf-core: el parseo real (XML, ZIP,
// componentes/coloring/visibility, múltiples viewpoints por topic) vive
// ahí ahora, no acá. Este archivo solo traduce el modelo rico de bcf-core
// al modelo angosto que ya consumen BcfPanel/IssueCard/BcfPinRenderer/
// Viewport (un solo viewpoint por topic, Priority/TopicStatus normalizados
// a un enum cerrado para poder indexar colores por Record<BcfStatus,...>) -
// ese modelo angosto no cambió, así que ningún componente de UI ni
// BcfPinRenderer necesitó tocarse.
import { parseBcf, normalizePriority, normalizeStatus } from "@bw-central/bcf-core";
import type { BcfTopic as CoreBcfTopic, BcfViewpoint as CoreBcfViewpoint, BcfComment as CoreBcfComment } from "@bw-central/bcf-core";
import type { BcfComment, BcfProject, BcfTopic, BcfViewpoint } from "./types/bcf";

const DEFAULT_VIEWPOINT: BcfViewpoint = {
  guid: "default",
  camera: {
    position: { x: 0, y: 0, z: 100 },
    direction: { x: 0, y: 0, z: -1 },
    up: { x: 0, y: 1, z: 0 },
  },
};

// btoa espera un string binario ("un char = un byte"), no bytes crudos -
// String.fromCharCode(...bytes) de una sola pasada revienta el límite de
// argumentos del engine en snapshots grandes, por eso se arma en chunks.
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

function adaptViewpoint(vp: CoreBcfViewpoint | undefined): BcfViewpoint {
  if (!vp) return DEFAULT_VIEWPOINT;

  const camera = vp.camera
    ? { position: vp.camera.viewPoint, direction: vp.camera.direction, up: vp.camera.upVector }
    : DEFAULT_VIEWPOINT.camera;

  const clippingPlane = vp.clippingPlanes[0]
    ? { location: vp.clippingPlanes[0].location, direction: vp.clippingPlanes[0].direction }
    : undefined;

  const snapshot = vp.snapshot
    ? `data:${vp.snapshotMimeType ?? "image/png"};base64,${bytesToBase64(vp.snapshot)}`
    : undefined;

  return { guid: vp.guid || "default", camera, clippingPlane, snapshot };
}

function adaptComment(c: CoreBcfComment): BcfComment {
  return { guid: c.guid, author: c.author, date: c.date, text: c.text, replyToGuid: c.viewpointGuid };
}

// bcf-core soporta N viewpoints por topic (gap real que tenía este módulo -
// ver el commit que agrega bcf-core); esta app solo muestra/restaura uno,
// así que se toma el primero. Si en el futuro la UI necesita navegar entre
// varios viewpoints del mismo topic, ese trabajo es en esta capa de
// adaptación, no en bcf-core.
function adaptTopic(topic: CoreBcfTopic): BcfTopic {
  return {
    guid: topic.guid,
    title: topic.title || "Untitled",
    description: topic.description ?? "",
    createdAuthor: topic.creationAuthor || "Unknown",
    createdDate: topic.creationDate || new Date().toISOString(),
    priority: normalizePriority(topic.priority),
    status: normalizeStatus(topic.topicStatus),
    assignee: topic.assignedTo || undefined,
    viewpoint: adaptViewpoint(topic.viewpoints[0]),
    comments: topic.comments.map(adaptComment),
  };
}

export class BcfImporter {
  static async parse(file: File): Promise<BcfProject> {
    // parseBcf acepta Blob directo (File extends Blob) - no hace falta
    // pasar por arrayBuffer() a mano.
    const project = await parseBcf(file);

    return {
      guid: crypto.randomUUID(),
      name: file.name.replace(/\.bcfzip$/i, "").replace(/\.bcf$/i, ""),
      topics: project.topics.map(adaptTopic),
      version: project.version,
    };
  }
}
