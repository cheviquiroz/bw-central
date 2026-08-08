// src/viewer/bcf/BcfExporter.ts
//
// Adaptador delgado sobre @bw-central/bcf-core: la escritura real del XML/
// ZIP vive ahí ahora. Este archivo traduce el modelo angosto de esta app
// (un viewpoint por topic, sin selección de componentes/coloring/
// visibility - eso nunca se capturaba acá) al modelo completo de bcf-core,
// y envuelve el resultado en un Blob para descarga - Blob es una API de
// browser a propósito acá (no en bcf-core), es la app la que decide cómo
// se entrega el archivo al usuario.
import { writeBcf } from "@bw-central/bcf-core";
import type { BcfTopic as CoreBcfTopic, BcfViewpoint as CoreBcfViewpoint, BcfComment as CoreBcfComment, BcfProject as CoreBcfProject } from "@bw-central/bcf-core";
import type { BcfProject, BcfTopic, BcfViewpoint } from "./types/bcf";
import { base64ToBytes } from "./base64";

function parseDataUri(dataUri: string): { bytes: Uint8Array; mimeType: string } | null {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUri);
  if (!match) return null;
  return { mimeType: match[1], bytes: base64ToBytes(match[2]) };
}

function adaptViewpoint(vp: BcfViewpoint): CoreBcfViewpoint {
  const snapshotData = vp.snapshot ? parseDataUri(vp.snapshot) : null;

  return {
    guid: vp.guid,
    // Esta app nunca distinguió Perspective/Orthogonal (el viewer original
    // tampoco lo hacía - siempre escribía <PerspectiveCamera>), así que se
    // preserva ese mismo comportamiento, no es una regresión nueva.
    camera: {
      type: "Perspective",
      viewPoint: vp.camera.position,
      direction: vp.camera.direction,
      upVector: vp.camera.up,
    },
    clippingPlanes: vp.clippingPlane ? [vp.clippingPlane] : [],
    components: { selection: [], coloring: [] },
    snapshot: snapshotData?.bytes,
    snapshotMimeType: snapshotData?.mimeType,
  };
}

function adaptComment(c: BcfTopic["comments"][number]): CoreBcfComment {
  return { guid: c.guid, date: c.date, author: c.author, text: c.text, viewpointGuid: c.replyToGuid };
}

function adaptTopic(topic: BcfTopic): CoreBcfTopic {
  return {
    guid: topic.guid,
    title: topic.title,
    topicStatus: topic.status,
    priority: topic.priority,
    labels: [],
    creationDate: topic.createdDate,
    creationAuthor: topic.createdAuthor,
    assignedTo: topic.assignee,
    description: topic.description,
    referenceLinks: [],
    relatedTopics: [],
    comments: topic.comments.map(adaptComment),
    // Was [adaptViewpoint(topic.viewpoint)] (always exactly one) - now
    // exports every viewpoint the topic actually has, matching
    // BcfTopic.viewpoints[] (BcfImporter.ts's adaptTopic, same task).
    //
    // NOT fixed here (pre-existing, separate bug, out of this task's
    // scope): this function still does not apply
    // CoordinateTransform.threeJSToBcf() to convert these Three.js
    // (Y-up) coordinates back to BCF's Z-up space before writing them -
    // an exported .bcf file's viewpoints are still numerically wrong
    // today, the mirror image of the import bug CoordinateTransform.ts
    // was built to fix (see that file's own "future BcfExporter usage"
    // comment/PHASE roadmap docs). Flagged, not silently left
    // undocumented.
    viewpoints: topic.viewpoints.map(adaptViewpoint),
  };
}

export class BcfExporter {
  static async create(project: BcfProject): Promise<Blob> {
    const coreProject: CoreBcfProject = {
      version: project.version,
      topics: project.topics.map(adaptTopic),
    };
    const bytes = await writeBcf(coreProject);
    // new Uint8Array(bytes) copia a un ArrayBuffer "plano": el tipo de retorno
    // de JSZip es Uint8Array<ArrayBufferLike> (podría venir respaldado por un
    // SharedArrayBuffer), y BlobPart exige específicamente ArrayBuffer.
    return new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" });
  }
}
