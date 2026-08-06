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
import { useLayoutState } from "../LayoutStateContext";
import { DockPanel } from "./DockPanel";
import { DockHeader } from "./DockHeader";
import { ModelTree } from "./ModelTree";
import { setModelBytes } from "../../core/ModelBytesRegistry";
import "../../styles/dock.css";

interface DockLeftProps {
  hiddenByModel: Record<string, Set<number>>;
  onToggleElementVisibility: (modelId: string, localId: number) => void;
  /** panel-tree now requires a model (see registry/modules.ts) - the toolbar toggle disables on its own, but zones.left defaults to true regardless, so this dock needs its own gate or it would render its empty state on top of FileUploadModal. */
  hasModel: boolean;
}

export function DockLeft({ hiddenByModel, onToggleElementVisibility, hasModel }: DockLeftProps) {
  const app = useApp();
  const { zones, setZoneVisible } = useLayoutState();
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
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

  return (
    <DockPanel>
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
    </DockPanel>
  );
}
