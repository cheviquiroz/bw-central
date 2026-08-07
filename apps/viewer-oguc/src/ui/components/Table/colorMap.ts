// src/ui/components/Table/colorMap.ts
import type { BadgeColor } from "./types";

export const severityToColor: Record<"error" | "warning" | "info", BadgeColor> = {
  error: "red",
  warning: "orange",
  info: "gray",
};

// Filled in for Phase 3 (IssueTable). priority is BCF's badge/level axis
// (CONTRACT_AMENDMENTS.md Amendment 1 - status is deliberately NOT badge/
// level, see IssueTable.tsx's own header comment); statusToColor is still
// exported for the status column's custom render, which reads it directly
// rather than through badge.
export const statusToColor: Record<"Open" | "Pending Review" | "Resolved", BadgeColor> = {
  Open: "red",
  "Pending Review": "orange",
  Resolved: "green",
};

export const priorityToColor: Record<"Low" | "Medium" | "High", BadgeColor> = {
  High: "red",
  Medium: "orange",
  Low: "green",
};

// Resolves badge.color's closed abstract enum (CONTRACT_FINAL_SEALED.md
// Section 1) into an actual paintable CSS value. Same hex/var values
// FindingsTable.tsx's own SEVERITY_COLOR map already used before this
// refactor, kept for visual continuity rather than picking new colors.
export const badgeColorToCss: Record<BadgeColor, string> = {
  red: "#ef4444",
  orange: "var(--amber)",
  green: "var(--green)",
  blue: "var(--blue)",
  gray: "var(--text-low)",
};
