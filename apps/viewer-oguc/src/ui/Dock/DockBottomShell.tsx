// src/ui/Dock/DockBottomShell.tsx
//
// Chrome shared by every bottom-dock content type: visibility (zones.bottom),
// height (bottomDockHeight, LayoutStateContext), and the drag-based resize
// handle on the top edge. Extracted out of DockBottom.tsx (which was BCF-only)
// so /revision's findings dock can reuse the exact same shell instead of
// duplicating the resize math - only the CONTENT differs between "/" (BcfPanel)
// and "/revision" (a findings placeholder today, the real findings list later).
//
// Resize math itself now lives in ResizeHandle.tsx (shared with
// DockLeft/DockRight's horizontal resize) - this file only supplies the
// vertical-specific size bounds.
import { useLayoutState, MIN_BOTTOM_DOCK_HEIGHT, MAX_BOTTOM_DOCK_HEIGHT_VH } from "../LayoutStateContext";
import { ResizeHandle } from "../ResizeHandle";
import type { ReactNode } from "react";
import "./dock-bottom.css";

export function DockBottomShell({ children }: { children: ReactNode }) {
  const { zones, bottomDockHeight, setBottomDockHeight } = useLayoutState();

  if (!zones.bottom) return null;

  return (
    <div className="dock-bottom" style={{ height: `${bottomDockHeight}px` }}>
      <ResizeHandle
        direction="vertical"
        currentSize={bottomDockHeight}
        minSize={MIN_BOTTOM_DOCK_HEIGHT}
        maxSize={window.innerHeight * MAX_BOTTOM_DOCK_HEIGHT_VH}
        onResize={setBottomDockHeight}
        className="dock-bottom-resize-handle"
      />
      {children}
    </div>
  );
}
