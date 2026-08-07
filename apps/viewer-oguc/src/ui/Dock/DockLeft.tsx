// src/ui/Dock/DockLeft.tsx
//
// No collapsed-rail state anymore: this panel is either mounted at its
// full 272px width (visible) or not mounted at all (hidden, zones.left
// === false - see LayoutStateContext.tsx). DockCollapsed and the whole
// 56px rail it lived in are deleted, not just unused - a docked panel
// that starts hidden with no affordance explaining what it is or how to
// reopen it read as "broken", not "closed". The Toolbar's workspace
// toggle (Phase 2) is the one, discoverable way back in.
//
// hiddenByModel/onToggleElementVisibility still arrive as props from
// Layout.tsx rather than living inside ModelTree.tsx - unchanged from
// the previous fix (ModelTree still only mounts while this dock is
// visible, and Layout.tsx never unmounts).
import { useRef, useState } from "react";
import type React from "react";
import { useApp } from "../AppContext";
import { useLayoutState, CANVAS_MIN_WIDTH, MIN_SIDE_DOCK_WIDTH } from "../LayoutStateContext";
import { ResizeHandle } from "../ResizeHandle";
import { LoadingOverlay } from "../LoadingOverlay";
import { DockPanel } from "./DockPanel";
import { DockHeader } from "./DockHeader";
import { ModelTree } from "./ModelTree";
import { setModelBytes } from "../../core/ModelBytesRegistry";
import "../../styles/dock.css";

// 32px de padding exterior de .viewport (16 a cada lado) + 16px del
// gutter propio de este dock hacia el canvas (margin-right en
// .dock-panel) - el gutter del lado derecho solo se resta si DockRight
// está montado, ver maxWidth más abajo. Repetir este número acá (en vez
// de leerlo del CSS, que no es posible) documenta de dónde sale.
const OUTER_PADDING_PX = 32;
const GUTTER_PX = 16;

interface DockLeftProps {
  hiddenByModel: Record<string, Set<number>>;
  onToggleElementVisibility: (modelId: string, localId: number) => void;
  /** panel-tree now requires a model (see registry/modules.ts) - the toolbar toggle disables on its own, but zones.left defaults to true regardless, so this dock needs its own gate or it would render its empty state on top of FileUploadModal. */
  hasModel: boolean;
}

export function DockLeft({ hiddenByModel, onToggleElementVisibility, hasModel }: DockLeftProps) {
  const app = useApp();
  const { zones, setZoneVisible, leftWidth, setLeftWidth, rightWidth } = useLayoutState();
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  // web-ifc's own progress reporting is coarse (a handful of discrete
  // jumps - 10%/30%/30-100% during geometry processing - not a smooth
  // per-frame value), but it IS real, already threaded through
  // app.importNewModel's onProgress callback below - not invented for
  // this overlay. Kept separate from progressMessage (the human-readable
  // status string) since LoadingOverlay wants a plain number.
  const [loadingPercentage, setLoadingPercentage] = useState<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    setLoading(true);

    const succeeded: string[] = [];
    const failed: { name: string; error: string }[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        setProgressMessage(`Cargando "${file.name}" (${i + 1}/${fileList.length})...`);
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        const result = await app.importNewModel(file.name, bytes, (progress) => {
          setProgressMessage(`"${file.name}": ${progress.statusMessage}`);
          setLoadingPercentage(progress.percentage);
        });

        if (result.success) {
          succeeded.push(file.name);
          // Retiene los bytes crudos para /revision (Pre-Check gate) -
          // ver ModelBytesRegistry.ts, el visor 3D en sí no los conserva
          // después de importar.
          setModelBytes(result.modelId, bytes);
        } else {
          failed.push({ name: file.name, error: result.error });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error inesperado al leer el archivo.";
        failed.push({ name: file.name, error: message });
        console.error(error);
      }
    }

    setLoading(false);
    setLoadingPercentage(undefined);
    event.target.value = "";

    const parts: string[] = [];
    if (succeeded.length > 0) parts.push(`✅ ${succeeded.join(", ")}`);
    if (failed.length > 0) parts.push(`❌ ${failed.map((f) => `${f.name} (${f.error})`).join("; ")}`);
    setProgressMessage(parts.join(" — "));

    if (parts.length > 0) {
      setTimeout(() => setProgressMessage(""), 5000);
    }
  };

  if (!zones.left || !hasModel) return null;

  // Máximo dinámico: lo que queda de la ventana después del piso del
  // canvas (480px) y del otro dock lateral, SI está montado (su gutter
  // de 16px solo existe mientras existe - ver el comentario largo sobre
  // margin-owned gutters en Layout.css). Se recalcula en cada render, no
  // una vez al montar - este componente ya re-renderiza en cada paso del
  // drag (setLeftWidth dispara un cambio de contexto), así que el valor
  // nunca queda stale ni siquiera si la ventana cambia de tamaño a mitad
  // de un arrastre.
  const rightOverhead = zones.right ? rightWidth + GUTTER_PX : 0;
  const maxWidth = Math.max(MIN_SIDE_DOCK_WIDTH, window.innerWidth - OUTER_PADDING_PX - GUTTER_PX - rightOverhead - CANVAS_MIN_WIDTH);

  return (
    <DockPanel style={{ width: `${leftWidth}px` }}>
      <input ref={fileInputRef} type="file" accept=".ifc" multiple onChange={handleFileChange} style={{ display: "none" }} />

      <DockHeader onAddClick={handleAddClick} onClose={() => setZoneVisible("left", false)} />

      <div className="dock-tree-content">
        {(loading || progressMessage) && (
          <p style={{ fontSize: "11px", color: "var(--dock-text-secondary)", padding: "0 20px 8px", whiteSpace: "normal" }}>
            {progressMessage || "Cargando..."}
          </p>
        )}
        <ModelTree hiddenByModel={hiddenByModel} onToggleElementVisibility={onToggleElementVisibility} />
      </div>

      <ResizeHandle
        direction="horizontal"
        side="left"
        currentSize={leftWidth}
        minSize={MIN_SIDE_DOCK_WIDTH}
        maxSize={maxWidth}
        onResize={setLeftWidth}
        className="dock-panel-resize-handle"
      />

      {/* position:fixed - se pinta sobre TODA la ventana (toolbar,
          canvas, ambos docks), no solo sobre este panel, sin importar que
          esté anidado acá adentro. Vive junto al trigger real (este
          input de archivo), no en Viewport.tsx - Viewport.tsx nunca
          parsea un IFC, solo inicializa el motor 3D vacío; quien
          realmente dispara app.importNewModel es este dock (y, para la
          primera carga, FileUploadModal - ver Layout.tsx, que ya tiene
          su propio spinner acotado al cuadro de carga y no se tocó acá
          para no duplicar/pisar ese tratamiento). */}
      <LoadingOverlay isVisible={loading} message={progressMessage || "Cargando tu modelo..."} progress={loadingPercentage} />
    </DockPanel>
  );
}
