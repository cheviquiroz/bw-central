// src/ui/Dock/DockPanel.tsx
import type { CSSProperties, ReactNode } from "react";

// Width now arrives via an optional inline style (the resizable width
// value from LayoutStateContext, see DockLeft.tsx) instead of being
// fixed in dock.css - dock.css keeps every OTHER visual property
// (background/border/etc.) and no longer declares a width at all, so
// this inline style is the only source of truth for it. Mounted-or-not
// is still the only visibility state (the parent returns null when its
// zone is hidden - see DockLeft.tsx) - there is no intermediate
// collapsed-rail width to parameterize.
export function DockPanel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="dock-panel" style={style}>
      {children}
    </div>
  );
}
