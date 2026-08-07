// src/ui/components/Table/colorMap.ts
import type { BadgeColor } from "./types";

export const severityToColor: Record<"error" | "warning" | "info", BadgeColor> = {
  error: "red",
  warning: "orange",
  info: "gray",
};

// Not filled in yet - BCF's Phase 3 adapter will populate these once it
// exists (see PHASE_2_RISKS.md #8: this palette-resolution layer is shared
// across domains, not Findings-specific, so it lives here rather than each
// adapter inventing its own copy).
export const statusToColor: Partial<Record<"Open" | "Pending Review" | "Resolved", BadgeColor>> = {};
export const priorityToColor: Partial<Record<"Low" | "Medium" | "High", BadgeColor>> = {};

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
