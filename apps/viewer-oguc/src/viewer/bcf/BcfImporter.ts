// src/viewer/bcf/BcfImporter.ts
import JSZip from "jszip";
import type { BcfComment, BcfProject, BcfTopic, BcfVector3, BcfViewpoint } from "./types/bcf";
import { normalizePriority, normalizeStatus } from "./types/schema";

// Parser contra el formato BCF real (verificado contra un .bcf de ejemplo
// real, NO contra la documentación de memoria):
//   bcf.version                  <Version VersionId="2.1">
//   {topic-guid}/markup.bcf      <Markup><Topic .../><Comment>*</Markup>
//   {topic-guid}/viewpoint.bcfv  <VisualizationInfo><PerspectiveCamera>...
//   {topic-guid}/snapshot.png
// (el nombre de carpeta NO se asume UUID por regex - se deriva directo del
// path real de cada markup.bcf encontrado, así funciona aunque el ZIP no
// tenga entradas de directorio explícitas, que muchos exportadores BCF
// reales omiten).
const domParser = new DOMParser();

function xmlToDoc(xml: string): Document {
  return domParser.parseFromString(xml, "application/xml");
}

function text(node: Element | null | undefined, selector: string): string {
  return node?.querySelector(selector)?.textContent?.trim() ?? "";
}

function vector3(node: Element | null | undefined, tag: string): BcfVector3 {
  const el = node?.querySelector(tag);
  return {
    x: parseFloat(text(el, "X")) || 0,
    y: parseFloat(text(el, "Y")) || 0,
    z: parseFloat(text(el, "Z")) || 0,
  };
}

const DEFAULT_VIEWPOINT: BcfViewpoint = {
  guid: "default",
  camera: {
    position: { x: 0, y: 0, z: 100 },
    direction: { x: 0, y: 0, z: -1 },
    up: { x: 0, y: 1, z: 0 },
  },
};

function parseComments(markupDoc: Document): BcfComment[] {
  // <Comment> se usa tanto para el elemento contenedor (hijo directo de
  // <Markup>) como para el campo de texto adentro de él
  // (<Comment><Comment>texto</Comment></Comment>) - un querySelectorAll
  // genérico de "Comment" matchea ambos y duplica todo. Se filtra
  // explícitamente a los hijos directos de <Markup>.
  const root = markupDoc.documentElement;
  const commentNodes = Array.from(root.children).filter((n) => n.tagName === "Comment");

  return commentNodes.map((c) => ({
    guid: c.getAttribute("Guid") || "",
    author: text(c, "Author"),
    date: text(c, "Date"),
    text: text(c, "Comment"),
    replyToGuid: c.querySelector("Viewpoint")?.getAttribute("Guid") || undefined,
  }));
}

async function parseViewpoint(
  markupDoc: Document,
  folder: string,
  zip: JSZip,
): Promise<BcfViewpoint> {
  const viewpointsRef = markupDoc.querySelector("Viewpoints");
  const vpFileName = viewpointsRef?.getAttribute("Viewpoint") || "viewpoint.bcfv";
  const snapshotFileName = viewpointsRef?.getAttribute("Snapshot") || "snapshot.png";
  const guid = viewpointsRef?.getAttribute("Guid") || "default";

  const vpFile = zip.file(`${folder}${vpFileName}`);
  const snapshotFile = zip.file(`${folder}${snapshotFileName}`);

  let camera = DEFAULT_VIEWPOINT.camera;
  let clippingPlane: BcfViewpoint["clippingPlane"];

  if (vpFile) {
    const vpDoc = xmlToDoc(await vpFile.async("string"));
    const camNode = vpDoc.querySelector("PerspectiveCamera") ?? vpDoc.querySelector("OrthogonalCamera");
    if (camNode) {
      camera = {
        position: vector3(camNode, "CameraViewPoint"),
        direction: vector3(camNode, "CameraDirection"),
        up: vector3(camNode, "CameraUpVector"),
      };
    }
    const clipNode = vpDoc.querySelector("ClippingPlanes > ClippingPlane");
    if (clipNode) {
      clippingPlane = {
        location: vector3(clipNode, "Location"),
        direction: vector3(clipNode, "Direction"),
      };
    }
  }

  let snapshot: string | undefined;
  if (snapshotFile) {
    const base64 = await snapshotFile.async("base64");
    snapshot = `data:image/png;base64,${base64}`;
  }

  return { guid, camera, clippingPlane, snapshot };
}

async function parseTopic(folder: string, markupXml: string, zip: JSZip): Promise<BcfTopic | null> {
  const markupDoc = xmlToDoc(markupXml);
  const topicEl = markupDoc.querySelector("Markup > Topic");
  if (!topicEl) return null;

  const guid = topicEl.getAttribute("Guid") || "";
  if (!guid) return null;

  return {
    guid,
    title: text(topicEl, "Title") || "Untitled",
    description: text(topicEl, "Description"),
    createdAuthor: text(topicEl, "CreationAuthor") || "Unknown",
    createdDate: text(topicEl, "CreationDate") || new Date().toISOString(),
    priority: normalizePriority(text(topicEl, "Priority")),
    // TopicStatus es un ATRIBUTO de <Topic>, no un elemento hijo.
    status: normalizeStatus(topicEl.getAttribute("TopicStatus")),
    assignee: text(topicEl, "AssignedTo") || undefined,
    viewpoint: await parseViewpoint(markupDoc, folder, zip),
    comments: parseComments(markupDoc),
  };
}

export class BcfImporter {
  static async parse(file: File): Promise<BcfProject> {
    const zip = await JSZip.loadAsync(file);

    const versionFile = zip.file(/(^|\/)bcf\.version$/i)[0];
    let version: BcfProject["version"] = "2.1";
    if (versionFile) {
      const versionDoc = xmlToDoc(await versionFile.async("string"));
      const raw = versionDoc.querySelector("Version")?.getAttribute("VersionId");
      if (raw === "2.0" || raw === "2.1" || raw === "3.0") version = raw;
    }

    const markupFiles = zip.file(/(^|\/)markup\.bcf$/i);
    const topics: BcfTopic[] = [];

    for (const markupFile of markupFiles) {
      const lastSlash = markupFile.name.lastIndexOf("/");
      // "" cuando markup.bcf está en la raíz del zip (sin carpeta de topic) -
      // caso raro pero posible, se soporta igual.
      const folder = lastSlash === -1 ? "" : markupFile.name.slice(0, lastSlash + 1);

      const topic = await parseTopic(folder, await markupFile.async("string"), zip);
      if (topic) topics.push(topic);
    }

    return {
      guid: crypto.randomUUID(),
      name: file.name.replace(/\.bcfzip$/i, "").replace(/\.bcf$/i, ""),
      topics,
      version,
    };
  }
}
