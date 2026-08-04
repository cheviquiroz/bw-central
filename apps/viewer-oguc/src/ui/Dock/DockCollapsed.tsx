// src/ui/Dock/DockCollapsed.tsx
import type { ModelDisplayNames, SelectionState } from "../../engine/createApplication";

function codeFor(name: string): string {
  const cleaned = name.replace(/\.ifc$/i, "");
  const parts = cleaned.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function DockCollapsed({
  displayNames,
  selection,
  onExpand,
}: {
  displayNames: ModelDisplayNames;
  selection: SelectionState;
  onExpand: () => void;
}) {
  const modelIds = Object.keys(displayNames);

  return (
    <div className="dock-collapsed">
      {modelIds.map((modelId) => {
        const isActive = (selection[modelId] || []).length > 0;
        return (
          <span
            key={modelId}
            className={`f-ico${isActive ? " active" : ""}`}
            title={displayNames[modelId]}
            onClick={onExpand}
          >
            {codeFor(displayNames[modelId] || modelId)}
          </span>
        );
      })}
    </div>
  );
}
