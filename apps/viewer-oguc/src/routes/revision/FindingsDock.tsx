// src/routes/revision/FindingsDock.tsx
//
// /revision's bottom dock - same shell as "/" (DockBottomShell:
// zones.bottom visibility, height, drag-resize). Was RevisionFindingsDock
// (ui/Dock/), a placeholder with only an empty state - moved here and
// renamed once it started hosting real findings (FindingsTable), since
// it now belongs with the rest of /revision's own components, not the
// generic Dock/ folder shared with "/".
import { useLayoutState } from "../../ui/LayoutStateContext";
import { DockBottomShell } from "../../ui/Dock/DockBottomShell";
import { IconLock } from "../../ui/icons/dock";
import { Tooltip } from "../../ui/Tooltip/Tooltip";
import { FindingsTable } from "./FindingsTable";
import type { Finding } from "@bw-central/oguc-core";
import "./findings-dock.css";

interface FindingsDockProps {
  findings: Finding[];
  onSelectFinding: (finding: Finding) => void;
  onUpdateFinding: (findingId: string, patch: Partial<Finding>) => void;
}

export function FindingsDock({ findings, onSelectFinding, onUpdateFinding }: FindingsDockProps) {
  const { setZoneVisible } = useLayoutState();

  return (
    <DockBottomShell>
      <div className="findings-dock">
        <div className="findings-dock-header">
          <h3 className="findings-dock-title">Hallazgos OGUC</h3>
          <Tooltip label="Ocultar panel">
            <button className="findings-dock-close" onClick={() => setZoneVisible("bottom", false)}>
              <IconLock />
            </button>
          </Tooltip>
        </div>
        <div className="findings-dock-content">
          <FindingsTable findings={findings} onSelectFinding={onSelectFinding} onUpdateFinding={onUpdateFinding} />
        </div>
      </div>
    </DockBottomShell>
  );
}
