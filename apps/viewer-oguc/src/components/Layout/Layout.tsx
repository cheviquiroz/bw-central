// src/components/Layout/Layout.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Layout.css";
import Viewport from "../../ui/Viewport/Viewport";
import { DockLeft } from "../../ui/Dock/DockLeft";
import { DockRight } from "../../ui/Dock/DockRight";
import { DockBottom } from "../../ui/Dock/DockBottom";
import { StatusBar } from "../../ui/StatusBar/StatusBar";
import { SearchBar } from "../../ui/Search/SearchBar";
import { Toolbar } from "../../ui/Toolbar/Toolbar";
import { FileUploadModal } from "../../ui/FileUploadModal/FileUploadModal";
import { useApp } from "../../ui/AppContext";
import { LayoutStateProvider, useLayoutState } from "../../ui/LayoutStateContext";
import { useModelToolActions } from "./useModelToolActions";
import { setModelBytes } from "../../core/ModelBytesRegistry";
import type { ModelDisplayNames } from "../../engine/createApplication";
import { BcfManager } from "../../viewer/bcf/BcfManager";
import type { BcfFilterStatus, BcfManagerState, BcfTopic } from "../../viewer/bcf/types/bcf";
import type { ModuleRuntimeMap } from "../../ui/registry/modules";

// LayoutStateProvider wraps the whole component (Toolbar included), not
// just <main>: the Fase 2 workspace toggles live in the Toolbar but need
// to read/write the same zones state that DockLeft/DockRight/DockBottom/
// OrientationCube use - a provider that only wrapped <main> would leave
// Toolbar outside its subtree. LayoutInner is the actual component body;
// useLayoutState() can only be called by a descendant of the provider,
// so the split is required, not stylistic.
export default function Layout() {
  return (
    <LayoutStateProvider>
      <LayoutInner />
    </LayoutStateProvider>
  );
}

function LayoutInner() {
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
  const [bcfSyncRequest, setBcfSyncRequest] = useState<{ topic: BcfTopic; viewpointIndex: number; nonce: number } | null>(null);
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
  const { zones, toggleZone, toggleShowShortcuts } = useLayoutState();

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

  const handleToggleTreePanel = () => {
    toggleZone("left");
  };

  const handleTogglePropertiesPanel = () => {
    toggleZone("right");
  };

  // Fase 3: Incidencias se mudó a su propia zona (DockBottom), ya no
  // comparte "right" con Properties vía tabs - toggleZone("bottom") es
  // ahora un toggle de visibilidad simple, igual que los otros dos.
  const handleToggleIssuesPanel = () => {
    toggleZone("bottom");
  };

  const handleStartReview = () => {
    navigate("/revision");
  };

  const hasModels = Object.keys(modelDisplayNames).length > 0;

  // Ctrl/Cmd+1/2/3 - sin colisión encontrada: esta app no tenía ningún
  // listener de teclado global antes de este cambio (grep de keydown en
  // src/ solo devuelve este efecto). preventDefault() es necesario en los
  // tres: el navegador interpreta Ctrl+1/2/3 como "ir a la pestaña N" en
  // varios navegadores/OS. panel-data/panel-issues requieren un modelo
  // cargado (ver registry/modules.ts) - sin este guard, el atajo de
  // teclado saltaría ese disabled del botón (que solo bloquea el click),
  // dejando una vía silenciosa para abrir un panel vacío sin sentido.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === "1") {
          event.preventDefault();
          handleToggleTreePanel();
        } else if (event.key === "2") {
          event.preventDefault();
          if (hasModels) handleTogglePropertiesPanel();
        } else if (event.key === "3") {
          event.preventDefault();
          if (hasModels) handleToggleIssuesPanel();
        }
        return;
      }

      // "?" via e.key (not e.code) - e.code identifies a physical key
      // position (e.g. "Slash"), which on a Spanish/Chilean keyboard
      // doesn't produce "?" at all (that layout needs Shift+/ on a
      // different physical key than a US layout). e.key already reports
      // the character the OS/layout actually produced, so no keyboard-
      // layout special-casing is needed here.
      if (event.key === "?") {
        const target = event.target as HTMLElement;
        if (["INPUT", "TEXTAREA"].includes(target.tagName)) return;
        event.preventDefault();
        toggleShowShortcuts();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasModels, toggleShowShortcuts]);

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
  //
  // viewpointIndex default 0 preserva el doble-click de siempre en
  // IssueTable (topic.viewpoints[0], la vista "principal") sin que ese
  // caller tenga que saber que ahora existe un índice - BcfDetailPanel es
  // el único caller que pasa un índice explícito distinto de 0.
  const handleBcfTopicActivate = (topic: BcfTopic, viewpointIndex = 0) => {
    bcfManager.setActiveTopic(topic);
    setBcfSyncRequest({ topic, viewpointIndex, nonce: Date.now() });
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
      ...toolModuleRuntime,
      "bcf-import": { onClick: handleImportBcf },
      "bcf-export": { onClick: handleExportBcf },
      "start-review": { onClick: handleStartReview },
      "panel-tree": { onClick: handleToggleTreePanel, isActive: zones.left },
      "panel-data": { onClick: handleTogglePropertiesPanel, isActive: zones.right },
      "panel-issues": { onClick: handleToggleIssuesPanel, isActive: zones.bottom },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toolModuleRuntime, zones.left, zones.right, zones.bottom]
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
        if (result.success) {
          // Retiene los bytes crudos para /revision (Pre-Check gate) -
          // ver ModelBytesRegistry.ts.
          setModelBytes(result.modelId, bytes);
        } else {
          failed.push({ name: file.name, error: result.error });
        }
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

      {/* 2. VISOR PRINCIPAL + DOCK IZQUIERDO + DOCK DERECHO + DOCK INFERIOR */}
      {/* Grid real de 2 filas x 3 columnas (izquierda | centro dominante |
          derecha, con una fila inferior full-width para Incidencias) - ver
          .viewport en Layout.css. Sin estilos inline pisando la clase:
          antes había un style={{display:"block", ...}} inline acá que
          hubiera ganado por encima de cualquier display:grid puesto en la
          clase (los estilos inline siempre ganan sobre CSS de archivo) -
          removido a propósito, el display real ahora vive solo en la clase. */}
      <main ref={viewportRef} className="viewport">
        <DockLeft hiddenByModel={hiddenByModel} onToggleElementVisibility={handleToggleElementVisibility} hasModel={hasModels} />
        <Viewport
          onViewerReady={handleViewerReady}
          isSectionBoxActive={isSectionBoxActive}
          isMeasuring={isMeasuring}
          bcfTopics={bcfState.topics}
          bcfActiveTopic={bcfState.activeTopic}
          bcfSyncRequest={bcfSyncRequest}
          hasModels={hasModels}
          moduleRuntime={moduleRuntime}
        />
        <DockRight />
        <DockBottom
          bcfState={bcfState}
          onBcfFilterChange={handleBcfFilterChange}
          onBcfTopicSelect={handleBcfTopicSelect}
          onBcfTopicActivate={handleBcfTopicActivate}
          moduleRuntime={moduleRuntime}
          hasModel={hasModels}
        />
      </main>

      {/* 5. STATUSBAR */}
      <StatusBar />
    </div>
  );
}
