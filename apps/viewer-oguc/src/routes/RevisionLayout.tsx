// src/routes/RevisionLayout.tsx
//
// /revision is a separate URL with its own Layout, not a modal on top of
// "/" - but it shares the same UI vocabulary (Toolbar, DockLeft, Viewport,
// DockRight, the module registry) so navigating here feels like a mode
// switch within one application, not a jump to a different tool. Modeled
// on Layout.tsx; the parts that differ: no FileUploadModal (models come
// from "/", not uploaded here), DockBottom's content is a findings
// placeholder instead of BCF, and the Toolbar carries a "← Volver" button
// back to "/".
//
// No compliance logic yet (Pre-Check gate, findings engine, .bwrev format)
// - this is the door existing and wired, per this task's explicit scope.
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import "../components/Layout/Layout.css";
import Viewport from "../ui/Viewport/Viewport";
import { DockLeft } from "../ui/Dock/DockLeft";
import { DockRight } from "../ui/Dock/DockRight";
import { RevisionFindingsDock } from "../ui/Dock/RevisionFindingsDock";
import { StatusBar } from "../ui/StatusBar/StatusBar";
import { SearchBar } from "../ui/Search/SearchBar";
import { Toolbar } from "../ui/Toolbar/Toolbar";
import { useApp } from "../ui/AppContext";
import { LayoutStateProvider, useLayoutState } from "../ui/LayoutStateContext";
import { useModelToolActions } from "../components/Layout/useModelToolActions";
import type { ModelDisplayNames } from "../engine/createApplication";
import type { ModuleRuntimeMap } from "../ui/registry/modules";

export default function RevisionLayout() {
  return (
    <LayoutStateProvider>
      <RevisionLayoutInner />
    </LayoutStateProvider>
  );
}

function RevisionLayoutInner() {
  const app = useApp();
  const navigate = useNavigate();
  const {
    viewportRef,
    searchManager,
    externalQuery,
    isSectionBoxActive,
    isMeasuring,
    handleViewerReady,
    toolModuleRuntime,
  } = useModelToolActions(app);
  const [modelDisplayNames, setModelDisplayNames] = useState<ModelDisplayNames>(app.getModelDisplayNames());
  // Estado propio, no compartido con "/" (Layout.tsx tiene el suyo) - las
  // visibilidades por elemento no viajan entre rutas todavía; es
  // aceptable en esta fase ("sin lógica de negocio aún"), ver el reporte
  // de la tarea.
  const [hiddenByModel, setHiddenByModel] = useState<Record<string, Set<number>>>({});
  const { zones, toggleZone } = useLayoutState();

  const hasModels = Object.keys(modelDisplayNames).length > 0;

  useEffect(() => {
    return app.subscribeToModelDisplayNames(setModelDisplayNames);
  }, [app]);

  const handleToggleElementVisibility = (modelId: string, localId: number) => {
    setHiddenByModel((prev) => {
      const current = new Set(prev[modelId] ?? []);
      const nextVisible = current.has(localId);
      if (current.has(localId)) current.delete(localId);
      else current.add(localId);

      app.setElementVisibility(modelId, localId, nextVisible).catch((error) => {
        console.error("❌ Error cambiando visibilidad del elemento:", error);
      });

      return { ...prev, [modelId]: current };
    });
  };

  const handleToggleTreePanel = () => toggleZone("left");
  const handleTogglePropertiesPanel = () => toggleZone("right");
  const handleToggleFindingsPanel = () => toggleZone("bottom");
  const handleStartReview = () => navigate("/revision");

  // Mismos atajos que "/" (Layout.tsx) - Ctrl/Cmd+1/2/3 para
  // tree/data/hallazgos. Duplicado a propósito, no extraído a un hook
  // compartido: son ~15 líneas atadas a los toggles LOCALES de cada
  // layout (zones de su propio LayoutStateProvider), extraerlas pediría
  // pasar 3 funciones por los límites de un hook para ahorrar menos de
  // lo que costaría la indirección.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === "1") {
        event.preventDefault();
        handleToggleTreePanel();
      } else if (event.key === "2") {
        event.preventDefault();
        if (hasModels) handleTogglePropertiesPanel();
      } else if (event.key === "3") {
        event.preventDefault();
        if (hasModels) handleToggleFindingsPanel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasModels]);

  const moduleRuntime: ModuleRuntimeMap = useMemo(
    () => ({
      ...toolModuleRuntime,
      "start-review": { onClick: handleStartReview },
      "panel-tree": { onClick: handleToggleTreePanel, isActive: zones.left },
      "panel-data": { onClick: handleTogglePropertiesPanel, isActive: zones.right },
      "panel-issues": { onClick: handleToggleFindingsPanel, isActive: zones.bottom },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toolModuleRuntime, zones.left, zones.right, zones.bottom]
  );

  // El modelo tiene que venir de "/" - esta ruta no sube archivos (no hay
  // FileUploadModal acá). Si no hay ningún modelo cargado (sesión nueva,
  // o el usuario llegó directo a /revision por URL), se redirige a "/" en
  // vez de mostrar un estado vacío sin salida - la carga de modelos ya
  // tiene un flujo real allá, no hace falta duplicarlo ni inventar uno
  // nuevo acá.
  if (!hasModels) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="layout">
      <Toolbar
        searchBar={<SearchBar searchManager={searchManager} externalQuery={externalQuery} />}
        moduleRuntime={moduleRuntime}
        hasModel={hasModels}
        backTo={{ label: "← Volver", path: "/" }}
      />

      <main ref={viewportRef} className="viewport">
        <DockLeft hiddenByModel={hiddenByModel} onToggleElementVisibility={handleToggleElementVisibility} hasModel={hasModels} />
        <Viewport onViewerReady={handleViewerReady} isSectionBoxActive={isSectionBoxActive} isMeasuring={isMeasuring} hasModels={hasModels} />
        <DockRight />
        <RevisionFindingsDock />
      </main>

      <StatusBar />
    </div>
  );
}
