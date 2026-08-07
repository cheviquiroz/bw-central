// src/ui/Toolbar3DFloating/Toolbar3DFloating.tsx
//
// Floating column of 3D-scene tools (fit-all, axes, section box, measure,
// isolate), separated out of the global Toolbar (see registry/modules.ts's
// surface:"toolbar-3d-floating") so tools that act on the model live over
// the viewport that has one, not in the app-wide chrome. Lives inside
// Viewport.tsx's own .viewport-container (position:relative), same
// pattern OrientationCube already established for anchoring to the
// canvas itself rather than any sibling panel's width.
import { renderModule } from "../Toolbar/Toolbar";
import { MODULES_3D_FLOATING } from "../registry/modules-3d-floating";
import type { ModuleRuntimeMap } from "../registry/modules";
import "./toolbar-3d-floating.css";

// No selectedElement prop, and no "disabled unless something is
// selected" gate on every button: of the 5 real 3D tools here, only
// Isolate is conceptually about a selection - Fit All, Axes, Section Box
// and Measure are standalone camera/scene tools that already work with
// nothing selected (that's the actual, current, working behavior in
// useModelToolActions.ts). Gating all 5 on a selection would disable
// working functionality, not add a real safeguard - renderModule already
// disables on requiresModel/hasModel, the one precondition every module
// here genuinely has.
interface Toolbar3DFloatingProps {
  hasModels: boolean;
  moduleRuntime: ModuleRuntimeMap;
}

export function Toolbar3DFloating({ hasModels, moduleRuntime }: Toolbar3DFloatingProps) {
  // No hay geometría que medir/aislar/encuadrar sin un modelo - mismo
  // criterio que OrientationCube.tsx (hasModels === false -> no renderiza).
  if (!hasModels) return null;

  return (
    <div className="toolbar-3d-floating">
      {MODULES_3D_FLOATING.map((module) => renderModule(module, moduleRuntime, hasModels))}
    </div>
  );
}
