// src/routes/revision/ReviewActions.tsx
//
// "Guardar revisión" / "Cargar revisión" / "Exportar reporte" - route-
// chrome specific to /revision, same reasoning as Toolbar's backTo prop
// (Paso 1): these need findings/preCheckResults state that only exists
// on this route, so they are NOT registry modules (which are meant to
// make sense on every surface that queries them) - RevisionLayout.tsx
// renders this component into Toolbar's extraActions slot instead.
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { calculateSHA256 } from "@bw-central/ifc-core";
import type { BwrevFile, Finding, PreCheckResult } from "@bw-central/oguc-core";
import { useToast } from "../../ui/Toast/ToastContext";
import { Tooltip } from "../../ui/Tooltip/Tooltip";
import { buildBwrevFile, bwrevModelsMismatchCurrentlyLoaded, downloadBwrevFile, parseBwrevFile } from "./bwrev";
import { generateReportsAndDownload } from "./generateReports";
import { reviewToReportDocument } from "./reviewToReportDocument";
import { getAllModelBytes } from "../../core/ModelBytesRegistry";
import "./review-actions.css";

function IconSave() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  );
}

function IconLoad() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      <path d="M12 10v6M9 13l3 3 3-3" />
    </svg>
  );
}

function IconExport() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
      <path d="M12 14V3M7 8l5-5 5 5" />
    </svg>
  );
}

interface ReviewActionsProps {
  modelDisplayNames: Record<string, string>;
  preCheckResults: Record<string, PreCheckResult | Error>;
  findings: Finding[];
  bwrevCreatedAt: number | null;
  onSaved: (createdAt: number) => void;
  onLoaded: (file: BwrevFile) => void;
}

export function ReviewActions({ modelDisplayNames, preCheckResults, findings, bwrevCreatedAt, onSaved, onLoaded }: ReviewActionsProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingMismatchFile, setPendingMismatchFile] = useState<BwrevFile | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const primaryModelName = Object.values(modelDisplayNames)[0];

  const handleSave = async () => {
    try {
      const file = await buildBwrevFile({
        modelDisplayNames,
        preCheckResults,
        findings,
        existingCreatedAt: bwrevCreatedAt,
        reviewStatus: "in-progress",
      });
      const filename = downloadBwrevFile(file, primaryModelName);
      onSaved(file.createdAt);
      showToast("success", `Revisión guardada: ${filename}`);
    } catch (error) {
      console.error("❌ Error al guardar la revisión:", error);
      showToast("error", "No se pudo guardar la revisión.");
    }
  };

  const handleLoadClick = () => fileInputRef.current?.click();

  const applyLoadedFile = (file: BwrevFile) => {
    onLoaded(file);
    showToast("success", `Revisión cargada: ${file.findings.length} hallazgos`);
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const inputFile = event.target.files?.[0];
    event.target.value = "";
    if (!inputFile) return;

    let raw: string;
    try {
      raw = await inputFile.text();
    } catch (error) {
      console.error("❌ Error al leer el archivo .bwrev:", error);
      showToast("error", "No se pudo leer el archivo.");
      return;
    }

    const result = parseBwrevFile(raw);
    if (!result.ok) {
      showToast("error", result.error);
      return;
    }

    try {
      const mismatched = await bwrevModelsMismatchCurrentlyLoaded(result.file, getAllModelBytes());
      if (mismatched) {
        setPendingMismatchFile(result.file);
        return;
      }
    } catch (error) {
      console.error("❌ Error al comparar hashes de modelo:", error);
      // No bloquea la carga por un error al comparar - degradar con
      // gracia (cargar igual) es más útil que atascar al usuario en un
      // fallo de una comprobación secundaria.
    }

    applyLoadedFile(result.file);
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const firstBytes = Object.values(getAllModelBytes())[0];
      const modelHash = firstBytes ? await calculateSHA256(firstBytes) : "";

      const document = reviewToReportDocument({
        modelName: primaryModelName ?? "modelo_sin_nombre",
        modelHash,
        reviewDate: new Date(),
        preCheckResults: {
          blocking: Object.values(preCheckResults).flatMap((r) => (r instanceof Error ? [] : r.blocking)),
          warnings: Object.values(preCheckResults).flatMap((r) => (r instanceof Error ? [] : r.warnings)),
          info: Object.values(preCheckResults).flatMap((r) => (r instanceof Error ? [] : r.info)),
          acknowledgedWarnings: [],
        },
        findings,
      });

      const { pdfFilename, excelFilename } = await generateReportsAndDownload(document, primaryModelName);
      showToast("success", `Reporte exportado: ${pdfFilename} y ${excelFilename}`);
    } catch (error) {
      console.error("❌ Error al exportar el reporte:", error);
      showToast("error", "No se pudo generar el reporte.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="review-actions">
      <input ref={fileInputRef} type="file" accept=".bwrev" style={{ display: "none" }} onChange={handleFileSelected} />

      <Tooltip label="Guardar revisión">
        <button className="review-action-btn" onClick={handleSave}>
          <IconSave />
        </button>
      </Tooltip>
      <Tooltip label="Cargar revisión">
        <button className="review-action-btn" onClick={handleLoadClick}>
          <IconLoad />
        </button>
      </Tooltip>
      <Tooltip label="Exportar reporte">
        <button className="review-action-btn" onClick={handleExport} disabled={isExporting}>
          <IconExport />
        </button>
      </Tooltip>

      {pendingMismatchFile && (
        <div className="review-mismatch-overlay">
          <div className="review-mismatch-dialog">
            <h3>Archivo de revisión corresponde a modelo diferente</h3>
            <p>
              El .bwrev seleccionado fue guardado para un modelo distinto al que está cargado ahora. Los hallazgos
              cargados podrían no corresponder a elementos reales de este modelo.
            </p>
            <div className="review-mismatch-actions">
              <button className="review-mismatch-cancel" onClick={() => setPendingMismatchFile(null)}>
                Cancelar
              </button>
              <button
                className="review-mismatch-confirm"
                onClick={() => {
                  applyLoadedFile(pendingMismatchFile);
                  setPendingMismatchFile(null);
                }}
              >
                Cargar de todas formas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
