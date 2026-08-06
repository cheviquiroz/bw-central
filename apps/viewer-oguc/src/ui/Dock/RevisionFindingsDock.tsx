// src/ui/Dock/RevisionFindingsDock.tsx
//
// /revision's bottom dock - same shell as "/" (DockBottomShell: zones.bottom
// visibility, height, drag-resize), different content: this is the future
// home of Pre-Check warnings/blockers and OGUC compliance findings, not BCF
// issues. No compliance logic yet (that's a later phase) - this is the
// placeholder that proves the shell is reusable across routes.
import { useLayoutState } from "../LayoutStateContext";
import { DockBottomShell } from "./DockBottomShell";
import { IconLock } from "../icons/dock";
import { Tooltip } from "../Tooltip/Tooltip";
import "./revision-findings.css";

export function RevisionFindingsDock() {
  const { setZoneVisible } = useLayoutState();

  return (
    <DockBottomShell>
      <div className="revision-findings">
        <div className="revision-findings-header">
          <h3 className="revision-findings-title">Hallazgos OGUC</h3>
          <Tooltip label="Ocultar panel">
            <button className="revision-findings-close" onClick={() => setZoneVisible("bottom", false)}>
              <IconLock />
            </button>
          </Tooltip>
        </div>
        <div className="revision-findings-empty">
          Sin hallazgos todavía. La revisión de cumplimiento OGUC (Pre-Check, motor de reglas, hallazgos) llega en una fase posterior.
        </div>
      </div>
    </DockBottomShell>
  );
}
