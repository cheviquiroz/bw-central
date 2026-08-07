// src/ui/EmptyState.tsx
//
// Shared "nothing here yet" block - icon + title + optional description +
// optional action button, centered. Used wherever a list/tree/canvas has
// legitimately nothing to show (as opposed to LoadingOverlay, which is for
// "something IS happening, wait").
//
// icon is typed as a component (no props) rather than importing from
// lucide-react - not a dependency of this app (confirmed before writing
// this file, same as LoadingOverlay.tsx), every icon here is a hand-drawn
// inline SVG (see icons/dock/index.tsx, icons/toolbar/index.tsx).
import type React from "react";
import "./empty-state.css";

export interface EmptyStateProps {
  icon?: React.ComponentType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {Icon && (
        <span className="empty-state-icon">
          <Icon />
        </span>
      )}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-description">{description}</p>}
      {action && (
        <button className="empty-state-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
