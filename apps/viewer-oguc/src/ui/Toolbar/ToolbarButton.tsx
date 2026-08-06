// src/ui/Toolbar/ToolbarButton.tsx
import { forwardRef } from "react";
import type { ReactNode } from "react";
import { Tooltip } from "../Tooltip/Tooltip";

interface ToolbarButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
  disabled?: boolean;
  /** Smaller size, for a nested sub-control (e.g. Hide Plane under Section Box) that must read as subordinate, not a sibling tool. */
  compact?: boolean;
  id?: string;
  /** e.g. "Ctrl+1" - shown in the tooltip alongside the label. */
  shortcut?: string;
}

export const ToolbarButton = forwardRef<HTMLDivElement, ToolbarButtonProps>(
  ({ icon, label, onClick, isActive = false, disabled = false, compact = false, id, shortcut }, ref) => (
    <Tooltip label={label} shortcut={shortcut}>
      <div
        ref={ref}
        id={id}
        className={`toolbar-btn${isActive ? " active" : ""}${disabled ? " disabled" : ""}${compact ? " compact" : ""}`}
        aria-label={label}
        aria-disabled={disabled}
        role="button"
        onClick={disabled ? undefined : onClick}
      >
        {icon}
      </div>
    </Tooltip>
  ),
);

ToolbarButton.displayName = "ToolbarButton";
