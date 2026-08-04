// src/ui/icons/dock/index.tsx
// Mismo criterio que src/ui/icons/toolbar: los SVG que ya existen en
// public/mockup-v1.0.html se reusan literales.

export function IconAdd() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// Candado en vez de estrella para la acción de fijar/desfijar un panel -
// mismo ícono pensado para reusarse en Properties Panel más adelante
// (todavía no tiene su propio botón de pin), por eso vive en este barril
// compartido en vez de ser local a Dock.
export function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="8" rx="1" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="15" r="1" />
    </svg>
  );
}

export function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" />
      <path d="M5 6v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6" />
      <path d="M10 9v6M14 9v6" />
    </svg>
  );
}

export function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function IconFolder() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

export function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
