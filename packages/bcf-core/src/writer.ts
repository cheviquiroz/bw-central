// Escribe el modelo de dominio (ver types.ts) hacia un archivo .bcf/.bcfzip
// completo y válido. A diferencia de las dos implementaciones originales -
// bcf-pdf-exporter no tenía ningún writer completo (solo un parche
// quirúrgico de Labels/AssignedTo sobre un archivo existente, ver
// bcfTagEditor.js en ese repo) y el writer de viewer-oguc solo escribía el
// subconjunto angosto de su propio modelo (un viewpoint, sin selección de
// componentes/coloring/visibility, sin labels) - este writer serializa el
// modelo COMPLETO, así que un round-trip real (parseBcf -> writeBcf ->
// parseBcf) no pierde datos.
//
// El orden de los elementos hijos de <Topic> importa: el schema BCF los
// define como xs:sequence, así que un lector estricto puede rechazar el
// XML si no lo respeta. El orden usado acá (ReferenceLink*, Title,
// Priority?, Index?, Labels*, CreationDate, CreationAuthor, ModifiedDate?,
// ModifiedAuthor?, AssignedTo?, Stage?, Description?, BimSnippet?,
// RelatedTopic*) está verificado contra los comentarios de las dos
// implementaciones originales (bcfTagEditor.js, BcfExporter.ts), que a su
// vez documentan haberlo confirmado contra el schema real.
//
// ⚠️ DueDate (BCF 3.0) es la ÚNICA excepción: ninguna de las dos fuentes
// originales lo escribía nunca, así que su posición acá (después de
// AssignedTo, antes de Stage) es la más plausible dado el propósito del
// campo, pero NO está verificada contra un XSD 3.0 real ni contra un
// archivo 3.0 real de ejemplo. Si un lector estricto de BCF 3.0 rechaza el
// orden, este es el primer lugar a revisar.
//
// El orden dentro de <VisualizationInfo> (Components, Camera,
// ClippingPlanes) sí está verificado: es exactamente el orden que usa el
// fixture BCF 2.1 real de bcf-pdf-exporter (test-fixtures/build-sample-bcf.mjs),
// que se probó funcionando en su pipeline de parseo.

import JSZip from "jszip";
import type { BcfProject, BcfTopic, BcfViewpoint, BcfVector3, BcfComponent } from "./types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlDeclaration(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n';
}

function simpleTag(tag: string, value: string | undefined, indent: string): string | null {
  if (value === undefined || value === "") return null;
  return `${indent}<${tag}>${escapeXml(value)}</${tag}>`;
}

function viewpointFileNames(index: number, total: number): { vpFileName: string; snapFileName: string } {
  // Con un solo viewpoint (el caso común) se usan los nombres por
  // convención "viewpoint.bcfv"/"snapshot.png" - máxima compatibilidad con
  // lectores BCF reales. Con más de uno, se numeran (viewpoint_2.bcfv...).
  if (total <= 1) return { vpFileName: "viewpoint.bcfv", snapFileName: "snapshot.png" };
  return { vpFileName: `viewpoint_${index + 1}.bcfv`, snapFileName: `snapshot_${index + 1}.png` };
}

function buildMarkupXml(topic: BcfTopic): string {
  const lines: string[] = [];

  const topicAttrs = [`Guid="${escapeXml(topic.guid)}"`];
  if (topic.topicType) topicAttrs.push(`TopicType="${escapeXml(topic.topicType)}"`);
  if (topic.topicStatus) topicAttrs.push(`TopicStatus="${escapeXml(topic.topicStatus)}"`);

  lines.push(`<Markup>`);
  lines.push(`  <Topic ${topicAttrs.join(" ")}>`);

  for (const link of topic.referenceLinks) {
    const t = simpleTag("ReferenceLink", link, "    ");
    if (t) lines.push(t);
  }
  lines.push(`    <Title>${escapeXml(topic.title)}</Title>`);
  const priorityTag = simpleTag("Priority", topic.priority, "    ");
  if (priorityTag) lines.push(priorityTag);
  if (topic.index !== undefined) lines.push(`    <Index>${topic.index}</Index>`);
  for (const label of topic.labels) {
    const t = simpleTag("Labels", label, "    ");
    if (t) lines.push(t);
  }
  lines.push(`    <CreationDate>${escapeXml(topic.creationDate)}</CreationDate>`);
  lines.push(`    <CreationAuthor>${escapeXml(topic.creationAuthor)}</CreationAuthor>`);
  const modDateTag = simpleTag("ModifiedDate", topic.modifiedDate, "    ");
  if (modDateTag) lines.push(modDateTag);
  const modAuthorTag = simpleTag("ModifiedAuthor", topic.modifiedAuthor, "    ");
  if (modAuthorTag) lines.push(modAuthorTag);
  const assignedTag = simpleTag("AssignedTo", topic.assignedTo, "    ");
  if (assignedTag) lines.push(assignedTag);
  const dueDateTag = simpleTag("DueDate", topic.dueDate, "    "); // ver nota de posición no verificada arriba
  if (dueDateTag) lines.push(dueDateTag);
  const stageTag = simpleTag("Stage", topic.stage, "    ");
  if (stageTag) lines.push(stageTag);
  const descTag = simpleTag("Description", topic.description, "    ");
  if (descTag) lines.push(descTag);
  const bimSnippetTag = simpleTag("BimSnippet", topic.bimSnippet, "    "); // ver nota en reader.ts: soporte incompleto, texto plano únicamente
  if (bimSnippetTag) lines.push(bimSnippetTag);
  for (const relatedGuid of topic.relatedTopics) {
    lines.push(`    <RelatedTopic Guid="${escapeXml(relatedGuid)}"/>`);
  }

  lines.push(`  </Topic>`);

  for (const comment of topic.comments) {
    lines.push(`  <Comment Guid="${escapeXml(comment.guid)}">`);
    lines.push(`    <Date>${escapeXml(comment.date)}</Date>`);
    lines.push(`    <Author>${escapeXml(comment.author)}</Author>`);
    lines.push(`    <Comment>${escapeXml(comment.text)}</Comment>`);
    const cModDate = simpleTag("ModifiedDate", comment.modifiedDate, "    ");
    if (cModDate) lines.push(cModDate);
    const cModAuthor = simpleTag("ModifiedAuthor", comment.modifiedAuthor, "    ");
    if (cModAuthor) lines.push(cModAuthor);
    if (comment.viewpointGuid) {
      lines.push(`    <Viewpoint Guid="${escapeXml(comment.viewpointGuid)}"/>`);
    }
    lines.push(`  </Comment>`);
  }

  topic.viewpoints.forEach((vp, i) => {
    const { vpFileName, snapFileName } = viewpointFileNames(i, topic.viewpoints.length);
    const attrs = [`Guid="${escapeXml(vp.guid)}"`, `Viewpoint="${vpFileName}"`];
    if (vp.snapshot) attrs.push(`Snapshot="${snapFileName}"`);
    lines.push(`  <Viewpoints ${attrs.join(" ")}/>`);
  });

  lines.push(`</Markup>`);
  return xmlDeclaration() + lines.join("\n");
}

function vectorXml(tag: string, v: BcfVector3, indent: string): string {
  return `${indent}<${tag}><X>${v.x}</X><Y>${v.y}</Y><Z>${v.z}</Z></${tag}>`;
}

function componentXml(c: BcfComponent, indent: string): string {
  const attrs = [`IfcGuid="${escapeXml(c.ifcGuid)}"`];
  if (c.originatingSystem) attrs.push(`OriginatingSystem="${escapeXml(c.originatingSystem)}"`);
  if (c.authoringToolId) attrs.push(`AuthoringToolId="${escapeXml(c.authoringToolId)}"`);
  return `${indent}<Component ${attrs.join(" ")}/>`;
}

function buildViewpointXml(vp: BcfViewpoint): string {
  const lines: string[] = [];
  lines.push(`<VisualizationInfo Guid="${escapeXml(vp.guid)}">`);

  const { selection, visibility, coloring } = vp.components;
  const hasComponents = selection.length > 0 || visibility !== undefined || coloring.length > 0;

  if (hasComponents) {
    lines.push(`  <Components>`);
    if (selection.length > 0) {
      lines.push(`    <Selection>`);
      selection.forEach((c) => lines.push(componentXml(c, "      ")));
      lines.push(`    </Selection>`);
    }
    if (visibility) {
      if (visibility.exceptions.length > 0) {
        lines.push(`    <Visibility DefaultVisibility="${visibility.defaultVisibility}">`);
        lines.push(`      <Exceptions>`);
        visibility.exceptions.forEach((c) => lines.push(componentXml(c, "        ")));
        lines.push(`      </Exceptions>`);
        lines.push(`    </Visibility>`);
      } else {
        lines.push(`    <Visibility DefaultVisibility="${visibility.defaultVisibility}"/>`);
      }
    }
    if (coloring.length > 0) {
      lines.push(`    <Coloring>`);
      coloring.forEach((group) => {
        lines.push(`      <Color Color="${escapeXml(group.color)}">`);
        group.components.forEach((c) => lines.push(componentXml(c, "        ")));
        lines.push(`      </Color>`);
      });
      lines.push(`    </Coloring>`);
    }
    lines.push(`  </Components>`);
  }

  if (vp.camera) {
    const tag = vp.camera.type === "Perspective" ? "PerspectiveCamera" : "OrthogonalCamera";
    lines.push(`  <${tag}>`);
    lines.push(vectorXml("CameraViewPoint", vp.camera.viewPoint, "    "));
    lines.push(vectorXml("CameraDirection", vp.camera.direction, "    "));
    lines.push(vectorXml("CameraUpVector", vp.camera.upVector, "    "));
    if (vp.camera.type === "Perspective" && vp.camera.fieldOfView !== undefined) {
      lines.push(`    <FieldOfView>${vp.camera.fieldOfView}</FieldOfView>`);
    }
    if (vp.camera.type === "Orthogonal" && vp.camera.viewToWorldScale !== undefined) {
      lines.push(`    <ViewToWorldScale>${vp.camera.viewToWorldScale}</ViewToWorldScale>`);
    }
    lines.push(`  </${tag}>`);
  }

  if (vp.clippingPlanes.length > 0) {
    lines.push(`  <ClippingPlanes>`);
    vp.clippingPlanes.forEach((cp) => {
      lines.push(`    <ClippingPlane>`);
      lines.push(vectorXml("Location", cp.location, "      "));
      lines.push(vectorXml("Direction", cp.direction, "      "));
      lines.push(`    </ClippingPlane>`);
    });
    lines.push(`  </ClippingPlanes>`);
  }

  lines.push(`</VisualizationInfo>`);
  return xmlDeclaration() + lines.join("\n");
}

/** Serializa el modelo completo hacia los bytes de un .bcfzip válido (formato ZIP). */
export async function writeBcf(project: BcfProject): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("bcf.version", `${xmlDeclaration()}<Version VersionId="${escapeXml(project.version)}"></Version>`);

  for (const topic of project.topics) {
    const folder = `${topic.guid}/`;
    zip.file(`${folder}markup.bcf`, buildMarkupXml(topic));

    topic.viewpoints.forEach((vp, i) => {
      const { vpFileName, snapFileName } = viewpointFileNames(i, topic.viewpoints.length);
      zip.file(`${folder}${vpFileName}`, buildViewpointXml(vp));
      if (vp.snapshot) {
        zip.file(`${folder}${snapFileName}`, vp.snapshot);
      }
    });
  }

  return zip.generateAsync({ type: "uint8array" });
}
