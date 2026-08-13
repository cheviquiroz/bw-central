// src/ui/icons/toolbar/index.tsx
//
// Los 5 primeros son EXACTAMENTE los <svg> de public/mockup-v1.0.html
// (Abrir IFC, Guardar vista, Seleccionar, Medir, Aislar Selección) - se
// reusan literales para calzar pixel a pixel con el mockup, en vez de
// redibujarlos. IconSectionBox reusa el ícono "Corte" que el mockup ya
// tiene en su vp-toolbar (el toolbar flotante del viewport, no el de
// arriba) - mismo concepto, mismo trazo. IconHidePlane es el único
// realmente nuevo (el mockup no tiene un botón equivalente).

export function IconOpenIfc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

export function IconSaveView() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  );
}

export function IconSelect() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 4l6 16 2.5-6.5L19 11 4 4z" />
    </svg>
  );
}

export function IconMeasure() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 17l14-14M8 12l2 2M12 8l2 2M6 14l2 2M14 6l2 2" />
      <path d="M17 3l4 4-14 14-4-4L17 3z" />
    </svg>
  );
}

export function IconIsolate() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function IconSectionBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  );
}

export function IconHidePlane() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M1 12s4-8 11-8c2 0 3.8.6 5.3 1.5M23 12s-4 8-11 8c-2 0-3.8-.6-5.3-1.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

// Calca el ícono "Maximize2" de lucide-react (dos escuadras en esquinas
// opuestas) - lucide-react no está instalado en este proyecto, así que se
// redibuja como SVG propio con el mismo trazo que el resto de los íconos.
export function IconFitAll() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

// Import/Export BCF - mismo trazo que el resto (viewBox 24, strokeWidth
// 1.6), flecha hacia la bandeja o hacia afuera de ella. Nada de emoji
// (📥/📤): esta app ya reemplazó los emoji de Dock por SVG por la misma
// razón de consistencia visual (ver src/ui/icons/dock).
export function IconBcfImport() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
      <path d="M12 3v11M7 10l5 5 5-5" />
    </svg>
  );
}

export function IconBcfExport() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
      <path d="M12 14V3M7 8l5-5 5 5" />
    </svg>
  );
}

export function IconBcfCreate() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
      <path d="M12 4v9M7.5 8.5h9" />
    </svg>
  );
}

// Workspace toggles (Fase 2 de "WORKSPACE LAYOUT") - togglean paneles
// propios del usuario, no herramientas sobre el modelo, así que se
// dibujan como "paneles" abstractos (un rectángulo con una franja),
// no como iconografía de acción como el resto de este archivo.
export function IconPanelTree() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M9 4v16" />
    </svg>
  );
}

export function IconPanelData() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M15 4v16" />
    </svg>
  );
}

export function IconPanelIssues() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 15h18" />
    </svg>
  );
}

// review - "Revisar OGUC" (/revision entry point). Círculo con check, el
// símbolo estándar de "cumplimiento verificado" - distinto del resto de
// íconos de acción (measure/isolate/etc.) porque esto no actúa sobre el
// modelo en el viewport, lanza un modo/contexto distinto.
export function IconCheckCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  );
}

// Etapa 4b-4 - 4 íconos nuevos para los paneles todavía sin migrar
// (file-manager/review-info/review-geometry/schedules). Mismo trazo que
// IconPanelTree/Data/Issues (strokeWidth 1.6, sin fill) por consistencia
// con este archivo - no el 1.5 que sugería el brief original, que no
// coincide con ningún ícono real ya en este archivo.
export function IconFileManager() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

export function IconReviewInfo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01M12 11v5" strokeLinecap="round" />
    </svg>
  );
}

export function IconReviewGeometry() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3l9 5v8l-9 5-9-5V8l9-5z" />
      <path d="M12 12v9M3 8l9 4 9-4" />
    </svg>
  );
}

export function IconSchedules() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9h18M8 4v3M16 4v3" />
    </svg>
  );
}

// A diferencia de los demás íconos de este archivo, este NO usa
// currentColor - el punto es mostrar los 3 ejes con sus colores reales
// (rojo/verde/azul), igual que AxesHelper.ts los dibuja en la escena.
export function IconXYZ() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
      {/* X: rojo, horizontal */}
      <line x1="3" y1="12" x2="19" y2="12" stroke="#ff4d4d" />
      {/* Y: verde, vertical */}
      <line x1="12" y1="21" x2="12" y2="4" stroke="#4dff88" />
      {/* Z: azul, diagonal (profundidad) */}
      <line x1="7" y1="20" x2="19" y2="6" stroke="#4d88ff" />
    </svg>
  );
}
