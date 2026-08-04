// src/ui/Toolbar/Toolbar.tsx
import type { ReactNode, RefObject } from "react";
import "../../styles/toolbar.css";
import { Logo } from "./Logo";
import { ToolbarButton } from "./ToolbarButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { ProjectPill } from "./ProjectPill";
import {
  IconOpenIfc,
  IconSaveView,
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

interface ToolbarProps {
  searchBar: ReactNode;
  onIsolateClick: () => void;
  onSectionBoxClick: () => void;
  onHidePlaneClick: () => void;
  onFitAllClick: () => void;
  onAxesClick: () => void;
  onMeasureClick: () => void;
  isMeasuring: boolean;
  onImportBcf: () => void;
  onExportBcf: () => void;
  btnIsolateRef: RefObject<HTMLDivElement | null>;
  btnSectionBoxRef: RefObject<HTMLDivElement | null>;
  btnHidePlaneRef: RefObject<HTMLDivElement | null>;
  btnAxesRef: RefObject<HTMLDivElement | null>;
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
  onImportBcf,
  onExportBcf,
  btnIsolateRef,
  btnSectionBoxRef,
  btnHidePlaneRef,
  btnAxesRef,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <Logo />

      <div className="toolbar-group">
        <ToolbarButton icon={<IconOpenIfc />} label="Abrir IFC" />
        <ToolbarButton icon={<IconSaveView />} label="Guardar vista" />
      </div>

      <ToolbarSeparator />

      <div className="toolbar-group">
        {/* isActive fijo en true, calcando el mockup - no hay un "modo
            selección" real que activar/desactivar en esta app (la
            selección por click ya funciona siempre, no es una
            herramienta que se prenda/apague). Puramente decorativo. */}
        <ToolbarButton icon={<IconSelect />} label="Seleccionar (clic izquierdo)" isActive />
        <ToolbarButton icon={<IconMeasure />} label="Medir" onClick={onMeasureClick} isActive={isMeasuring} />
        <ToolbarButton
          ref={btnIsolateRef}
          id="btn-isolate"
          icon={<IconIsolate />}
          label="Aislar Selección"
          onClick={onIsolateClick}
        />
        <ToolbarButton
          ref={btnSectionBoxRef}
          id="btn-section-box"
          icon={<IconSectionBox />}
          label="Section Box"
          onClick={onSectionBoxClick}
        />
        <ToolbarButton
          ref={btnHidePlaneRef}
          id="btn-hide-plane"
          icon={<IconHidePlane />}
          label="Ocultar plano (el corte sigue activo)"
          onClick={onHidePlaneClick}
        />
        <ToolbarButton icon={<IconFitAll />} label="Encuadrar todo (Z)" onClick={onFitAllClick} />
        <ToolbarButton
          ref={btnAxesRef}
          id="btn-axes"
          icon={<IconXYZ />}
          label="Mostrar origen XYZ (0,0,0)"
          onClick={onAxesClick}
        />
      </div>

      <ToolbarSeparator />

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
