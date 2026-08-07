// src/ui/registry/modules-3d-floating.ts
//
// The 3D-scene modules (act on the model/camera, not the app shell) -
// derived from MODULE_REGISTRY via surface:"toolbar-3d-floating", not a
// second set of ModuleDefinition objects. modules.ts's own header
// comment establishes it as the single declarative source of truth for
// module structure; a second array holding copies of the same
// id/label/icon would silently drift the moment one side changed. This
// file exists so Toolbar3DFloating.tsx has a named import that reads as
// "the floating panel's modules" without re-deriving the filter itself.
//
// Only 5 modules, not 7: fit-all, axes, section-box (+ its hide-plane
// child), measure, isolate. These are the only 3D tools that actually
// exist in this app, each with a real handler in useModelToolActions.ts.
// "Hide Element" / "Isolate Element" / "Transparentar" / "Paint Element"
// have no implementation anywhere in this codebase (grepped before
// writing this file) - adding registry entries for them would produce
// buttons with no onClick, a half-finished feature this project's own
// conventions rule out. If those tools get built, they belong here too,
// added once they have a real handler to point at.
import { getModulesForSurface } from "./modules";

export const MODULES_3D_FLOATING = getModulesForSurface("toolbar-3d-floating");
