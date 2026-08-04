// src/ui/Toolbar/ToolbarButton.tsx
import { forwardRef } from "react";
import type { ReactNode } from "react";

interface ToolbarButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
  id?: string;
}

export const ToolbarButton = forwardRef<HTMLDivElement, ToolbarButtonProps>(
  ({ icon, label, onClick, isActive = false, id }, ref) => (
    <div
      ref={ref}
      id={id}
      className={`toolbar-btn${isActive ? " active" : ""}`}
      title={label}
      aria-label={label}
      role="button"
      onClick={onClick}
    >
      {icon}
    </div>
  ),
);

ToolbarButton.displayName = "ToolbarButton";
