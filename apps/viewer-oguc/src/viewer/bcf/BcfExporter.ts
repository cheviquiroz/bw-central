// src/viewer/bcf/BcfExporter.ts
import JSZip from "jszip";
import type { BcfProject, BcfTopic } from "./types/bcf";

// Escribe contra el mismo formato real que lee BcfImporter (bcf.version +
// {guid}/markup.bcf + {guid}/viewpoint.bcfv + {guid}/snapshot.png) - así
// un .bcf exportado acá se puede volver a importar acá mismo Y en
// herramientas BCF reales (BIMcollab, Solibri, etc.), no solo en esta app.
//
// El orden de los elementos hijos de <Topic> importa: el schema BCF los
// define como xs:sequence, así que un lector estricto puede rechazar el
// XML si no respeta el orden (Title, Priority, ..., CreationDate,
// CreationAuthor, ..., AssignedTo, ..., Description). Se escriben acá en
// ese mismo orden relativo, aunque este tipo no tenga todos los campos
// intermedios del schema completo (Index/Labels/ModifiedDate/Stage) - el
// orden solo importa ENTRE los campos que sí están presentes.
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

function buildMarkupXml(topic: BcfTopic): string {
  const lines: string[] = [];
  lines.push(`<Markup>`);
  lines.push(`  <Topic Guid="${escapeXml(topic.guid)}" TopicStatus="${escapeXml(topic.status)}">`);
  lines.push(`    <Title>${escapeXml(topic.title)}</Title>`);
  lines.push(`    <Priority>${escapeXml(topic.priority)}</Priority>`);
  lines.push(`    <CreationDate>${escapeXml(topic.createdDate)}</CreationDate>`);
  lines.push(`    <CreationAuthor>${escapeXml(topic.createdAuthor)}</CreationAuthor>`);
  if (topic.assignee) {
    lines.push(`    <AssignedTo>${escapeXml(topic.assignee)}</AssignedTo>`);
  }
  if (topic.description) {
    lines.push(`    <Description>${escapeXml(topic.description)}</Description>`);
  }
  lines.push(`  </Topic>`);

  for (const comment of topic.comments) {
    lines.push(`  <Comment Guid="${escapeXml(comment.guid)}">`);
    lines.push(`    <Date>${escapeXml(comment.date)}</Date>`);
    lines.push(`    <Author>${escapeXml(comment.author)}</Author>`);
    lines.push(`    <Comment>${escapeXml(comment.text)}</Comment>`);
    if (comment.replyToGuid) {
      lines.push(`    <Viewpoint Guid="${escapeXml(comment.replyToGuid)}"/>`);
    }
    lines.push(`  </Comment>`);
  }

  const hasSnapshot = Boolean(topic.viewpoint.snapshot);
  lines.push(
    `  <Viewpoints Guid="${escapeXml(topic.viewpoint.guid)}" Viewpoint="viewpoint.bcfv"${
      hasSnapshot ? ' Snapshot="snapshot.png"' : ""
    }/>`,
  );

  lines.push(`</Markup>`);
  return xmlDeclaration() + lines.join("\n");
}

function vectorXml(tag: string, v: { x: number; y: number; z: number }, indent: string): string {
  return `${indent}<${tag}><X>${v.x}</X><Y>${v.y}</Y><Z>${v.z}</Z></${tag}>`;
}

function buildViewpointXml(topic: BcfTopic): string {
  const { camera, clippingPlane, guid } = topic.viewpoint;
  const lines: string[] = [];
  lines.push(`<VisualizationInfo Guid="${escapeXml(guid)}">`);
  lines.push(`  <PerspectiveCamera>`);
  lines.push(vectorXml("CameraViewPoint", camera.position, "    "));
  lines.push(vectorXml("CameraDirection", camera.direction, "    "));
  lines.push(vectorXml("CameraUpVector", camera.up, "    "));
  lines.push(`  </PerspectiveCamera>`);
  if (clippingPlane) {
    lines.push(`  <ClippingPlanes>`);
    lines.push(`    <ClippingPlane>`);
    lines.push(vectorXml("Location", clippingPlane.location, "      "));
    lines.push(vectorXml("Direction", clippingPlane.direction, "      "));
    lines.push(`    </ClippingPlane>`);
    lines.push(`  </ClippingPlanes>`);
  }
  lines.push(`</VisualizationInfo>`);
  return xmlDeclaration() + lines.join("\n");
}

export class BcfExporter {
  static async create(project: BcfProject): Promise<Blob> {
    const zip = new JSZip();

    zip.file("bcf.version", `${xmlDeclaration()}<Version VersionId="${project.version}"></Version>`);

    for (const topic of project.topics) {
      const folder = `${topic.guid}/`;
      zip.file(`${folder}markup.bcf`, buildMarkupXml(topic));
      zip.file(`${folder}viewpoint.bcfv`, buildViewpointXml(topic));

      if (topic.viewpoint.snapshot) {
        // El snapshot se guarda como data URI ("data:image/png;base64,...")
        // - hay que sacarle el prefijo antes de pasárselo a JSZip, que
        // espera el base64 crudo con {base64:true}.
        const base64 = topic.viewpoint.snapshot.replace(/^data:image\/\w+;base64,/, "");
        zip.file(`${folder}snapshot.png`, base64, { base64: true });
      }
    }

    return zip.generateAsync({ type: "blob" });
  }
}
