// src/components/Layout/Layout.tsx
import React, { useEffect, useMemo, useState } from "react";
import "./Layout.css";
import Viewport from "../../ui/Viewport/Viewport";
import { DockLeft } from "../../ui/Dock/DockLeft";
import { DockRightWithTabs } from "../../ui/Dock/DockRightWithTabs";
import { StatusBar } from "../../ui/StatusBar/StatusBar";
import { ViewerActionsAdapter } from "../../engine/adapters/ViewerActionsAdapter";
import { SearchManager } from "../../viewer/SearchManager";
import { SearchBar } from "../../ui/Search/SearchBar";
import { Toolbar } from "../../ui/Toolbar/Toolbar";
import { FileUploadModal } from "../../ui/FileUploadModal/FileUploadModal";
import { useApp } from "../../ui/AppContext";
import { PanelWidthProvider } from "../../ui/PanelWidthContext";
import { fitCameraToAllLoadedModels } from "../../core/IfcBootstrap";
import type { ModelDisplayNames } from "../../engine/createApplication";
import { BcfManager } from "../../viewer/bcf/BcfManager";
import type { BcfFilterStatus, BcfManagerState, BcfTopic } from "../../viewer/bcf/types/bcf";
import type { ModuleRuntimeMap } from "../../ui/registry/modules";

export default function Layout() {
  const app = useApp();
  const [actionsAdapter, setActionsAdapter] = useState<ViewerActionsAdapter | null>(null);
  const [searchManager, setSearchManager] = useState<SearchManager | null>(null);
  const [isSectionBoxActive, setIsSectionBoxActive] = useState(false);
  const [isIsolateActive, setIsIsolateActive] = useState(false);
  const [isHidePlaneActive, setIsHidePlaneActive] = useState(false);
  const [isAxesActive, setIsAxesActive] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [externalQuery, setExternalQuery] = useState<{ value: string; nonce: number } | null>(null);
  const [bcfSyncRequest, setBcfSyncRequest] = useState<{ topic: BcfTopic; nonce: number } | null>(null);
  const [modelDisplayNames, setModelDisplayNames] = useState<ModelDisplayNames>(app.getModelDisplayNames());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);
  const [bcfManager] = useState(() => new BcfManager());
  const [bcfState, setBcfState] = useState<BcfManagerState>(bcfManager.getState());
  // Vive acá, no dentro de ModelTree.tsx (donde estaba antes) - ModelTree
  // solo está montado mientras DockLeft está expandido, así que un
  // useState local ahí se perdía cada vez que el usuario colapsaba el
  // dock. Layout.tsx nunca se desmonta.
  const [hiddenByModel, setHiddenByModel] = useState<Record<string, Set<number>>>({});
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const handleToggleElementVisibility = (modelId: string, localId: number) => {
    setHiddenByModel((prev) => {
      const current = new Set(prev[modelId] ?? []);
      const nextVisible = current.has(localId); // si ya estaba oculto, esto lo va a mostrar
      if (current.has(localId)) current.delete(localId);
      else current.add(localId);

      app.setElementVisibility(modelId, localId, nextVisible).catch((error) => {
        console.error("❌ Error cambiando visibilidad del elemento:", error);
      });

      return { ...prev, [modelId]: current };
    });
  };

  const handleViewerReady = (viewerHandles: any) => {
    const adapter = new ViewerActionsAdapter(viewerHandles);
    setActionsAdapter(adapter);
    setSearchManager(new SearchManager(viewerHandles, app));
  };

  // Los 4 handlers de abajo ya no pasan un ref de botón al adapter para
  // que este le mute el classList directamente (isolateButton.classList.
  // add/remove, etc. - ver el comentario en ViewerActionsAdapter.ts sobre
  // por qué eso era un bug real, no solo un estilo distinto): el adapter
  // ahora devuelve el nuevo estado, y ese valor se guarda acá en useState
  // para que Toolbar reciba isActive como prop de verdad, sobreviviendo
  // cualquier re-render ajeno.
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
  // app.requestSearchQuery - Layout no conoce el detalle de quién la pidió,
  // solo la reenvía a SearchBar como comando de un solo uso.
  useEffect(() => {
    return app.subscribeToSearchQueryRequests((query) => {
      setExternalQuery({ value: query, nonce: Date.now() });
    });
  }, [app]);

  // El modal de carga inicial se oculta solo (nada de un setState manual
  // en el handler) - se deriva de si ya hay algún modelo federado, la misma
  // fuente de verdad que ya usan DockLeft/StatusBar. Así queda correcto
  // incluso si un modelo llega a cargarse por otra vía (ej. el "Add" del
  // dock) antes de que el usuario suelte un archivo en el modal.
  useEffect(() => {
    return app.subscribeToModelDisplayNames(setModelDisplayNames);
  }, [app]);

  useEffect(() => {
    return bcfManager.subscribe(setBcfState);
  }, [bcfManager]);

  const hasModels = Object.keys(modelDisplayNames).length > 0;

  const handleImportBcf = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".bcf,.bcfzip";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await bcfManager.loadBcf(file);
      } catch (err) {
        console.error("Error importando BCF:", err);
        alert("No se pudo cargar el archivo BCF.");
      }
    };
    input.click();
  };

  const handleExportBcf = async () => {
    try {
      const blob = await bcfManager.exportBcf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "issues.bcf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exportando BCF:", err);
      alert(err instanceof Error ? err.message : "No se pudo exportar el BCF.");
    }
  };

  const handleBcfFilterChange = (status: BcfFilterStatus) => {
    bcfManager.setFilter(status);
  };

  const handleBcfTopicSelect = (topic: BcfTopic | null) => {
    bcfManager.setActiveTopic(topic);
  };

  // Comando de un solo uso, mismo patrón que externalQuery más arriba - el
  // nonce (no el topic en sí) es lo que dispara el efecto en Viewport.tsx,
  // así doble-clickear el MISMO topic dos veces seguidas sigue re-centrando
  // la cámara la segunda vez (si comparara solo el topic, React vería el
  // mismo valor y no dispararía el efecto de nuevo). cameraControls no vive
  // acá - Layout.tsx no tiene acceso a él (es estado local de Viewport.tsx,
  // igual que el resto de la lógica de interacción con la cámara/escena).
  const handleBcfTopicActivate = (topic: BcfTopic) => {
    bcfManager.setActiveTopic(topic);
    setBcfSyncRequest({ topic, nonce: Date.now() });
  };

  // importNewModel no rechaza la Promise ante un IFC inválido - devuelve
  // { success: false, error } (mismo Result que usa DockLeft.handleFileChange)
  // - un try/catch solo no alcanza para mostrar el mensaje de error real.
  // Puente entre el registry (estructura estática, ver src/ui/registry/
  // modules.ts) y el estado real de la aplicación, que sigue viviendo acá
  // igual que siempre - el registry nunca se vuelve una segunda fuente de
  // verdad. Agregar un módulo nuevo a la Toolbar ya no toca Toolbar.tsx:
  // solo hace falta una entrada acá (o, si no tiene isActive ni onClick
  // real, ni siquiera eso).
  const moduleRuntime: ModuleRuntimeMap = useMemo(
    () => ({
      "fit-all": { onClick: handleFitAllClick },
      axes: { onClick: handleAxesClick, isActive: isAxesActive },
      "section-box": { onClick: handleClipClick, isActive: isSectionBoxActive },
      "hide-plane": { onClick: handleHidePlaneClick, isActive: isHidePlaneActive },
      measure: { onClick: handleMeasureClick, isActive: isMeasuring },
      isolate: { onClick: handleIsolateClick, isActive: isIsolateActive },
      "bcf-import": { onClick: handleImportBcf },
      "bcf-export": { onClick: handleExportBcf },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAxesActive, isSectionBoxActive, isHidePlaneActive, isMeasuring, isIsolateActive, actionsAdapter]
  );

  const handleFilesSelected = async (files: File[]) => {
    setIsUploading(true);
    setUploadError(undefined);

    const failed: { name: string; error: string }[] = [];

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const result = await app.importNewModel(file.name, bytes);
        if (!result.success) failed.push({ name: file.name, error: result.error });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado al leer el archivo.";
        failed.push({ name: file.name, error: message });
        console.error(err);
      }
    }

    setIsUploading(false);
    if (failed.length > 0) {
      setUploadError(failed.map((f) => `${f.name}: ${f.error}`).join(" — "));
    }
  };

  return (
    <div className="layout">
      {!hasModels && (
        <FileUploadModal onFilesSelected={handleFilesSelected} isLoading={isUploading} error={uploadError} />
      )}

      {/* 1. TOOLBAR */}
      <Toolbar
        searchBar={<SearchBar searchManager={searchManager} externalQuery={externalQuery} />}
        moduleRuntime={moduleRuntime}
        hasModel={hasModels}
      />

      {/* 2. VISOR PRINCIPAL + DOCK IZQUIERDO + DOCK DERECHO CON TABS */}
      {/* Grid real de 3 columnas (izquierda | centro dominante | derecha) -
          ver .viewport en Layout.css. Sin estilos inline pisando la clase:
          antes había un style={{display:"block", ...}} inline acá que
          hubiera ganado por encima de cualquier display:grid puesto en la
          clase (los estilos inline siempre ganan sobre CSS de archivo) -
          removido a propósito, el display real ahora vive solo en la clase. */}
      {/* PanelWidthProvider envuelve solo el main: OrientationCube (dentro de
          Viewport) y DockRightWithTabs necesitan sincronizar el ancho del
          panel activo para que el cubo no quede tapado cuando expande - ver
          src/ui/PanelWidthContext.tsx. StatusBar no lo necesita. */}
      <PanelWidthProvider>
        <main ref={viewportRef} className="viewport">
          <DockLeft hiddenByModel={hiddenByModel} onToggleElementVisibility={handleToggleElementVisibility} />
          <Viewport
            onViewerReady={handleViewerReady}
            isSectionBoxActive={isSectionBoxActive}
            isMeasuring={isMeasuring}
            bcfTopics={bcfState.topics}
            bcfActiveTopic={bcfState.activeTopic}
            bcfSyncRequest={bcfSyncRequest}
          />
          <DockRightWithTabs
            bcfState={bcfState}
            onBcfFilterChange={handleBcfFilterChange}
            onBcfTopicSelect={handleBcfTopicSelect}
            onBcfTopicActivate={handleBcfTopicActivate}
            moduleRuntime={moduleRuntime}
            hasModel={hasModels}
          />
        </main>
      </PanelWidthProvider>

      {/* 5. STATUSBAR */}
      <StatusBar />
    </div>
  );
}
