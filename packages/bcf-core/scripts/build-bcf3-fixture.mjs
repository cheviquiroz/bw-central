// Genera un archivo .bcf SINTÉTICO en formato BCF 3.0, para poder probar
// los caminos específicos de esa versión (DueDate, múltiples viewpoints por
// topic) - NO existe ningún archivo BCF 3.0 real (capturado de BIMcollab,
// Solibri, etc.) en ningún repo de este ecosistema al momento de escribir
// esto, así que este fixture es una construcción manual, con el mismo
// criterio que ya usaba bcf-pdf-exporter para su fixture 2.1
// (test-fixtures/build-sample-bcf.mjs) - no un archivo "real" capturado de
// una herramienta BCF de verdad.
//
// Uso: node scripts/build-bcf3-fixture.mjs
import JSZip from "jszip";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zip = new JSZip();

zip.file(
  "bcf.version",
  `<?xml version="1.0" encoding="UTF-8"?>\n<Version VersionId="3.0"></Version>`,
);

const guid = "b3c3d4e5-0001-0000-0000-000000000001";
const vp1Guid = "vp-0001";
const vp2Guid = "vp-0002";
const folder = zip.folder(guid);

folder.file(
  "markup.bcf",
  `<?xml version="1.0" encoding="UTF-8"?>
<Markup>
  <Topic Guid="${guid}" TopicType="Issue" TopicStatus="InProgress">
    <Title>Conflicto de trazado — Ducto vs. viga (BCF 3.0)</Title>
    <Priority>High</Priority>
    <Index>1</Index>
    <Labels>MEP</Labels>
    <Labels>Estructura</Labels>
    <CreationDate>2026-07-01T09:00:00Z</CreationDate>
    <CreationAuthor>cvergara@bwisebim.cl</CreationAuthor>
    <ModifiedDate>2026-07-02T10:00:00Z</ModifiedDate>
    <ModifiedAuthor>cvergara@bwisebim.cl</ModifiedAuthor>
    <AssignedTo>coordinador@bwisebim.cl</AssignedTo>
    <DueDate>2026-07-15T00:00:00Z</DueDate>
    <Stage>Diseño de Detalle</Stage>
    <Description>Topic de prueba BCF 3.0, con dos viewpoints (antes/después) y DueDate.</Description>
    <RelatedTopic Guid="b3c3d4e5-0002-0000-0000-000000000002"/>
  </Topic>
  <Comment Guid="c-3000">
    <Date>2026-07-01T09:30:00Z</Date>
    <Author>cvergara@bwisebim.cl</Author>
    <Comment>Ver viewpoint inicial (antes de la corrección).</Comment>
    <Viewpoint Guid="${vp1Guid}"/>
  </Comment>
  <Comment Guid="c-3001">
    <Date>2026-07-02T10:15:00Z</Date>
    <Author>mep.lead@bwisebim.cl</Author>
    <Comment>Corregido, ver segundo viewpoint.</Comment>
    <ModifiedDate>2026-07-02T11:00:00Z</ModifiedDate>
    <ModifiedAuthor>mep.lead@bwisebim.cl</ModifiedAuthor>
    <Viewpoint Guid="${vp2Guid}"/>
  </Comment>
  <Viewpoints Guid="${vp1Guid}" Viewpoint="viewpoint_1.bcfv" Snapshot="snapshot_1.png"/>
  <Viewpoints Guid="${vp2Guid}" Viewpoint="viewpoint_2.bcfv" Snapshot="snapshot_2.png"/>
</Markup>`,
);

function viewpointXml(guidValue, x) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<VisualizationInfo Guid="${guidValue}">
  <Components>
    <Selection>
      <Component IfcGuid="1a2b3c4d5e6f7g8h9i0j1k" OriginatingSystem="Revit" AuthoringToolId="Revit2025"/>
    </Selection>
    <Visibility DefaultVisibility="true">
      <Exceptions>
        <Component IfcGuid="2b3c4d5e6f7g8h9i0j1k2l"/>
      </Exceptions>
    </Visibility>
    <Coloring>
      <Color Color="00FF00">
        <Component IfcGuid="1a2b3c4d5e6f7g8h9i0j1k"/>
      </Color>
    </Coloring>
  </Components>
  <PerspectiveCamera>
    <CameraViewPoint><X>${x}</X><Y>8.320</Y><Z>3.100</Z></CameraViewPoint>
    <CameraDirection><X>-0.707</X><Y>-0.707</Y><Z>0.000</Z></CameraDirection>
    <CameraUpVector><X>0.000</X><Y>0.000</Y><Z>1.000</Z></CameraUpVector>
    <FieldOfView>60</FieldOfView>
  </PerspectiveCamera>
</VisualizationInfo>`;
}

folder.file("viewpoint_1.bcfv", viewpointXml(vp1Guid, "12.450"));
folder.file("viewpoint_2.bcfv", viewpointXml(vp2Guid, "13.900"));

const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
folder.file("snapshot_1.png", pngBase64, { base64: true });
folder.file("snapshot_2.png", pngBase64, { base64: true });

const outPath = path.join(__dirname, "../src/__tests__/fixtures/sample-3.0.bcf");
zip.generateAsync({ type: "nodebuffer" }).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log("BCF 3.0 sintético generado en", outPath);
});
