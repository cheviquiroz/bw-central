// src/ui/Dock/DockPanel.tsx
import type { ReactNode } from "react";

export function DockPanel({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div className="dock-panel" style={{ width: `${width}px` }}>
      {children}
    </div>
  );
}
