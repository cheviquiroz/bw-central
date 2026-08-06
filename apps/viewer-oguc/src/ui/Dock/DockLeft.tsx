// src/ui/Dock/DockLeft.tsx
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { useApp } from "../AppContext";
import { usePanelWidth } from "../PanelWidthContext";
import { DockPanel } from "./DockPanel";
import { DockHeader } from "./DockHeader";
import { DockCollapsed } from "./DockCollapsed";
import { ModelTree } from "./ModelTree";
import type { ModelDisplayNames, SelectionState } from "../../engine/createApplication";
import "../../styles/dock.css";

const COLLAPSED_WIDTH = 56;
const EXPANDED_WIDTH = 272;

export function DockLeft() {
  const app = useApp();
  const { isLeftDockOpen, setIsLeftDockOpen } = usePanelWidth();
  const [displayNames, setDisplayNames] = useState<ModelDisplayNames>(app.getModelDisplayNames());
  const [selection, setSelection] = useState<SelectionState>(app.getSelection());
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const width = isLeftDockOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  useEffect(() => {
    const unsubNames = app.subscribeToModelDisplayNames(setDisplayNames);
    const unsubSelection = app.subscribeToSelection(setSelection);
    return () => {
      unsubNames();
      unsubSelection();
    };
  }, [app]);

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

        if (result.success) succeeded.push(file.name);
        else failed.push({ name: file.name, error: result.error });
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

  const showCollapsed = !isLeftDockOpen;

  return (
    <DockPanel width={width}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc"
        multiple
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <DockHeader
        visible={isLeftDockOpen}
        onAddClick={handleAddClick}
        onCollapse={() => setIsLeftDockOpen(false)}
      />

      {showCollapsed ? (
        <DockCollapsed displayNames={displayNames} selection={selection} onExpand={() => setIsLeftDockOpen(true)} />
      ) : (
        <div className="dock-tree-content">
          {(loading || progressMessage) && (
            <p style={{ fontSize: "11px", color: "var(--dock-text-secondary)", padding: "0 20px 8px", whiteSpace: "normal" }}>
              {progressMessage || "Cargando..."}
            </p>
          )}
          <ModelTree />
        </div>
      )}
    </DockPanel>
  );
}
