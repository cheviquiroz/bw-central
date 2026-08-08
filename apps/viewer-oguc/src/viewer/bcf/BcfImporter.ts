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
import { bytesToBase64 } from "./base64";
import { CoordinateTransform } from "../../utils/CoordinateTransform";

const DEFAULT_VIEWPOINT: BcfViewpoint = {
  guid: "default",
  camera: {
    position: { x: 0, y: 0, z: 100 },
    direction: { x: 0, y: 0, z: -1 },
    up: { x: 0, y: 1, z: 0 },
  },
};

function adaptViewpoint(vp: CoreBcfViewpoint | undefined): BcfViewpoint {
  if (!vp) return DEFAULT_VIEWPOINT;

  // Transforms BCF (Z-up) to Three.js (Y-up). Symmetric inverse in
  // CoordinateTransform.threeJSToBcf() for future export. Only applied to
  // REAL parsed BCF numbers - DEFAULT_VIEWPOINT.camera (the vp.camera-
  // missing fallback below) is already authored directly in Three.js
  // Y-up terms as a sensible default, not real BCF data - running it
  // through this transform too would silently rotate it away from its
  // intended meaning.
  const camera = vp.camera
    ? {
        position: CoordinateTransform.transformBcfVector(vp.camera.viewPoint),
        direction: CoordinateTransform.transformBcfVector(vp.camera.direction),
        up: CoordinateTransform.transformBcfVector(vp.camera.upVector),
      }
    : DEFAULT_VIEWPOINT.camera;

  const clippingPlane = vp.clippingPlanes[0]
    ? {
        location: CoordinateTransform.transformBcfVector(vp.clippingPlanes[0].location),
        direction: CoordinateTransform.transformBcfVector(vp.clippingPlanes[0].direction),
      }
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
