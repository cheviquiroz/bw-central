// src/ui/Dock/DockPanel.tsx
import type { ReactNode } from "react";

// No width prop anymore: a docked panel is either mounted at its fixed
// width (see dock.css) or not mounted at all (the parent returns null
// when its zone is hidden - see DockLeft.tsx) - there is no longer an
// intermediate collapsed-rail width to parameterize.
export function DockPanel({ children }: { children: ReactNode }) {
  return <div className="dock-panel">{children}</div>;
}
