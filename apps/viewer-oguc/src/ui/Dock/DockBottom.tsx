// src/ui/Dock/DockBottom.tsx
//
// Full-width zone below the viewport (spans all three columns of
// .viewport's grid - see Layout.css), holding BcfPanel. Chosen over
// "between the side panels" because: (1) it's a simpler
// grid-template-areas than threading the bottom row between two
// independently-hideable columns, (2) it matches what Navisworks/Solibri
// actually do (full width, not squeezed between side docks), and (3)
// squeezing it between side panels would undercut the entire reason this
// moved out of the right dock - the extra width is the point.
//
// Visibility/height/resize-handle chrome lives in DockBottomShell, shared
// with /revision's findings dock (RevisionFindingsDock.tsx) - this file
// only supplies the BCF-specific content.
import { useLayoutState } from "../LayoutStateContext";
import { DockBottomShell } from "./DockBottomShell";
import { BcfPanel } from "../BcfPanel/BcfPanel";
import type { BcfFilterStatus, BcfManagerState, BcfPriority, BcfTopic } from "../../viewer/bcf/types/bcf";
import type { ModuleRuntimeMap } from "../registry/modules";

interface DockBottomProps {
  bcfState: BcfManagerState;
  onBcfFilterChange: (status: BcfFilterStatus) => void;
  onBcfTopicSelect: (topic: BcfTopic | null) => void;
  /** viewpointIndex optional - BcfDetailPanel passes it explicitly, IssueTable's double-click omits it (defaults to 0 in Layout.tsx's handleBcfTopicActivate). */
  onBcfTopicActivate: (topic: BcfTopic, viewpointIndex?: number) => void;
  moduleRuntime: ModuleRuntimeMap;
  hasModel: boolean;
  createDialogOpen: boolean;
  onCreateDialogClose: () => void;
  onCreateTopicSubmit: (title: string, description: string, priority: BcfPriority) => boolean;
}

export function DockBottom({
  bcfState,
  onBcfFilterChange,
  onBcfTopicSelect,
  onBcfTopicActivate,
  moduleRuntime,
  hasModel,
  createDialogOpen,
  onCreateDialogClose,
  onCreateTopicSubmit,
}: DockBottomProps) {
  const { setZoneVisible } = useLayoutState();

  return (
    <DockBottomShell>
      <BcfPanel
        state={bcfState}
        onFilterChange={onBcfFilterChange}
        onTopicSelect={onBcfTopicSelect}
        onTopicActivate={onBcfTopicActivate}
        moduleRuntime={moduleRuntime}
        hasModel={hasModel}
        onClose={() => setZoneVisible("bottom", false)}
        createDialogOpen={createDialogOpen}
        onCreateDialogClose={onCreateDialogClose}
        onCreateTopicSubmit={onCreateTopicSubmit}
      />
    </DockBottomShell>
  );
}
