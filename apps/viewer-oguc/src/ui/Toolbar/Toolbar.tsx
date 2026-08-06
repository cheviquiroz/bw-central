// src/ui/Toolbar/Toolbar.tsx
import type { ReactNode } from "react";
import "../../styles/toolbar.css";
import { Logo } from "./Logo";
import { ToolbarButton } from "./ToolbarButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { ProjectPill } from "./ProjectPill";
import {
  IconSelect,
  IconMeasure,
  IconIsolate,
  IconSectionBox,
  IconHidePlane,
  IconFitAll,
  IconXYZ,
  IconBcfImport,
  IconBcfExport,
} from "../icons/toolbar";

// IconOpenIfc/IconSaveView eran botones sin onClick (ver el resumen de la
// Auditoría UI/UX, Paso 1) - se sacaron del render en vez de mostrarse
// deshabilitados: un botón sin función no le dice al usuario si es "por
// cablear" o "roto", y una lista limpia de botones reales es más clara
// que una con relleno. Se reincorporan (con su categoría VIEW/INTERACT/
// BCF real) el día que tengan un onClick de verdad detrás.

interface ToolbarProps {
  searchBar: ReactNode;
  onIsolateClick: () => void;
  onSectionBoxClick: () => void;
  onHidePlaneClick: () => void;
  onFitAllClick: () => void;
  onAxesClick: () => void;
  onMeasureClick: () => void;
  isMeasuring: boolean;
  isIsolateActive: boolean;
  isSectionBoxActive: boolean;
  isHidePlaneActive: boolean;
  isAxesActive: boolean;
  onImportBcf: () => void;
  onExportBcf: () => void;
}

export function Toolbar({
  searchBar,
  onIsolateClick,
  onSectionBoxClick,
  onHidePlaneClick,
  onFitAllClick,
  onAxesClick,
  onMeasureClick,
  isMeasuring,
  isIsolateActive,
  isSectionBoxActive,
  isHidePlaneActive,
  isAxesActive,
  onImportBcf,
  onExportBcf,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <Logo />

      {/* VIEW: cámara/orientación - encuadrar y mostrar el origen. */}
      <div className="toolbar-group">
        <ToolbarButton icon={<IconFitAll />} label="Encuadrar todo (Z)" onClick={onFitAllClick} />
        <ToolbarButton
          id="btn-axes"
          icon={<IconXYZ />}
          label="Mostrar origen XYZ (0,0,0)"
          onClick={onAxesClick}
          isActive={isAxesActive}
        />
      </div>

      <ToolbarSeparator />

      {/* INTERACT: selección, medición y geometría de corte/aislamiento. */}
      <div className="toolbar-group">
        {/* isActive fijo en true, calcando el mockup - no hay un "modo
            selección" real que activar/desactivar en esta app (la
            selección por click ya funciona siempre, no es una
            herramienta que se prenda/apague). Puramente decorativo. */}
        <ToolbarButton icon={<IconSelect />} label="Seleccionar (clic izquierdo)" isActive />
        <ToolbarButton icon={<IconMeasure />} label="Medir" onClick={onMeasureClick} isActive={isMeasuring} />
        <ToolbarButton
          id="btn-isolate"
          icon={<IconIsolate />}
          label="Aislar Selección"
          onClick={onIsolateClick}
          isActive={isIsolateActive}
        />
        <ToolbarButton
          id="btn-section-box"
          icon={<IconSectionBox />}
          label="Section Box"
          onClick={onSectionBoxClick}
          isActive={isSectionBoxActive}
        />
        <ToolbarButton
          id="btn-hide-plane"
          icon={<IconHidePlane />}
          label="Ocultar plano (el corte sigue activo)"
          onClick={onHidePlaneClick}
          isActive={isHidePlaneActive}
        />
      </div>

      <ToolbarSeparator />

      {/* BCF: coordinación de incidencias. */}
      <div className="toolbar-group">
        <ToolbarButton icon={<IconBcfImport />} label="Importar BCF" onClick={onImportBcf} />
        <ToolbarButton icon={<IconBcfExport />} label="Exportar BCF" onClick={onExportBcf} />
      </div>

      <ToolbarSeparator />

      {searchBar}

      <div className="toolbar-spacer" />

      {/* Sin dato real de federación/proyecto detrás - a diferencia del
          mockup, que hardcodea "Hospital La Serena", esto no debería
          inventar un nombre de proyecto que no existe en el dominio real. */}
      <ProjectPill label="Sesión local" />
    </header>
  );
}
