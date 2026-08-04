// src/ui/Toolbar/ProjectPill.tsx
interface ProjectPillProps {
  label: string;
}

// El mockup hardcodea "Federación · Hospital La Serena" - acá se recibe
// como prop porque en la app real ese texto tendría que salir de datos
// reales de la federación cargada, no quedar fijo.
export function ProjectPill({ label }: ProjectPillProps) {
  return (
    <div className="toolbar-project-pill">
      <span className="dot" />
      <span>{label}</span>
    </div>
  );
}
