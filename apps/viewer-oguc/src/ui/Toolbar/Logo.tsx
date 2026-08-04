// src/ui/Toolbar/Logo.tsx
export function Logo() {
  return (
    <div className="toolbar-brand">
      <div className="mark">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" stroke="#4a90d9" strokeWidth="1.4" />
          <path d="M12 2V22M3 7L12 12L21 7M3 17L12 12" stroke="#4a90d9" strokeWidth="1" opacity="0.5" />
        </svg>
      </div>
      <span className="name-b">BWise</span>
      <span className="name-wise">Viewer</span>
    </div>
  );
}
