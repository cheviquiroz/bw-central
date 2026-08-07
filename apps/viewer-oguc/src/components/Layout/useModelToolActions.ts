// src/components/Layout/useModelToolActions.ts
//
// Shared between Layout.tsx ("/") and RevisionLayout.tsx ("/revision"):
// both routes mount their own <Viewport>, so both need their own
// ViewerActionsAdapter/SearchManager and the same explore/interrogate
// tool handlers (fit-all, section box, isolate, measure, axes) - this
// isn't optional state that could live in AppContext, since each Viewport
// instance owns its own Three.js world/camera. Extracted so the two
// layouts don't each hand-roll an identical copy of this wiring - "same
// buttons as /" (per the /revision brief) means literally the same
// handlers, not a re-implementation that happens to look the same.
import { useEffect, useMemo, useRef, useState } from "react";
import { ViewerActionsAdapter } from "../../engine/adapters/ViewerActionsAdapter";
import { SearchManager } from "../../viewer/SearchManager";
import { fitCameraToAllLoadedModels } from "../../core/IfcBootstrap";
import type { ApplicationInstance } from "../../engine/createApplication";
import type { ModuleRuntimeMap } from "../../ui/registry/modules";

export function useModelToolActions(app: ApplicationInstance) {
  const [actionsAdapter, setActionsAdapter] = useState<ViewerActionsAdapter | null>(null);
  const [searchManager, setSearchManager] = useState<SearchManager | null>(null);
  const [isSectionBoxActive, setIsSectionBoxActive] = useState(false);
  const [isIsolateActive, setIsIsolateActive] = useState(false);
  const [isHidePlaneActive, setIsHidePlaneActive] = useState(false);
  const [isAxesActive, setIsAxesActive] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [externalQuery, setExternalQuery] = useState<{ value: string; nonce: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const handleViewerReady = (viewerHandles: any) => {
    const adapter = new ViewerActionsAdapter(viewerHandles);
    setActionsAdapter(adapter);
    setSearchManager(new SearchManager(viewerHandles, app));
  };

  // Los 4 handlers de abajo ya no pasan un ref de botón al adapter para
  // que este le mute el classList directamente - ver el comentario en
  // ViewerActionsAdapter.ts sobre por qué eso era un bug real. El adapter
  // devuelve el nuevo estado, y ese valor se guarda acá en useState para
  // que Toolbar reciba isActive como prop de verdad.
  const handleIsolateClick = () => {
    if (actionsAdapter && viewportRef.current) {
      setIsIsolateActive(actionsAdapter.toggleIsolate(viewportRef.current));
    } else {
      console.warn("Por favor, selecciona un elemento en el modelo 3D primero.");
    }
  };

  const handleClipClick = () => {
    if (actionsAdapter) {
      setIsSectionBoxActive(actionsAdapter.toggleClipPlane());
    }
  };

  const handleHidePlaneClick = () => {
    if (actionsAdapter) {
      setIsHidePlaneActive(actionsAdapter.toggleClipperVisibility());
    }
  };

  const handleFitAllClick = () => {
    fitCameraToAllLoadedModels();
  };

  // Doble clic con el botón central del mouse (rueda) -> Fit All. button
  // === 1 es el botón central en el estándar MouseEvent (0=izquierdo,
  // 1=central, 2=derecho) - no hay un evento nativo "dblclick" para el
  // botón central (dblclick del DOM solo dispara para el izquierdo), así
  // que el doble clic se arma a mano comparando el timestamp contra el
  // click anterior, igual que cualquier detector de doble clic manual.
  // Vive en este hook (no en Viewport.tsx) porque fitCameraToAllLoadedModels
  // ya es el mismo handler que usa el botón "Encuadrar todo" de
  // Toolbar3DFloating - un solo punto de entrada a esa acción, no dos
  // implementaciones que podrían desincronizarse.
  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    const DOUBLE_CLICK_THRESHOLD_MS = 300;
    let lastWheelClickTime = 0;

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 1) return;
      const now = Date.now();
      if (now - lastWheelClickTime < DOUBLE_CLICK_THRESHOLD_MS) {
        event.preventDefault();
        fitCameraToAllLoadedModels();
        lastWheelClickTime = 0;
      } else {
        lastWheelClickTime = now;
      }
    };

    container.addEventListener("mousedown", handleMouseDown);
    return () => container.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const handleAxesClick = () => {
    if (actionsAdapter) {
      setIsAxesActive(actionsAdapter.toggleAxes());
    }
  };

  const handleMeasureClick = () => {
    setIsMeasuring((prev) => !prev);
  };

  // Click-to-filter: PropertiesPanel (Shift+click en una propiedad) publica
  // acá su query armada ("Material:Vidrio templado") vía
  // app.requestSearchQuery - ni Layout ni RevisionLayout conocen el detalle
  // de quién la pidió, solo la reenvían a SearchBar como comando de un
  // solo uso.
  useEffect(() => {
    return app.subscribeToSearchQueryRequests((query) => {
      setExternalQuery({ value: query, nonce: Date.now() });
    });
  }, [app]);

  const toolModuleRuntime: ModuleRuntimeMap = useMemo(
    () => ({
      "fit-all": { onClick: handleFitAllClick },
      axes: { onClick: handleAxesClick, isActive: isAxesActive },
      "section-box": { onClick: handleClipClick, isActive: isSectionBoxActive },
      "hide-plane": { onClick: handleHidePlaneClick, isActive: isHidePlaneActive },
      measure: { onClick: handleMeasureClick, isActive: isMeasuring },
      isolate: { onClick: handleIsolateClick, isActive: isIsolateActive },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAxesActive, isSectionBoxActive, isHidePlaneActive, isMeasuring, isIsolateActive, actionsAdapter]
  );

  return {
    viewportRef,
    searchManager,
    externalQuery,
    isSectionBoxActive,
    isMeasuring,
    handleViewerReady,
    toolModuleRuntime,
  };
}
