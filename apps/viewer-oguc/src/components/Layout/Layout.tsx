// src/components/Layout/Layout.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Layout.css";
import Viewport from "../../ui/Viewport/Viewport";
import { DockLeft } from "../../ui/Dock/DockLeft";
import { FloatingPanel } from "../../ui/Dock/FloatingPanel";
import { ModelTree } from "../../ui/Dock/ModelTree";
import { BcfPanel } from "../../ui/BcfPanel/BcfPanel";
import PropertiesPanel from "../PropertiesPanel/PropertiesPanel";
import { IconPanelTree, IconPanelData, IconPanelIssues, IconFileManager, IconSchedules, IconReviewInfo, IconReviewGeometry } from "../../ui/icons/toolbar";
import { FileManager } from "../../ui/Panels/FileManager";
import { ReviewGeometry } from "../../ui/Panels/ReviewGeometry";
import { Schedules } from "../../ui/Panels/Schedules";
import { ReviewInfoPanel } from "../../ui/Panels/ReviewInfoPanel";
import { StatusBar } from "../../ui/StatusBar/StatusBar";
import { SearchBar } from "../../ui/Search/SearchBar";
import { Toolbar } from "../../ui/Toolbar/Toolbar";
import { FileUploadModal } from "../../ui/FileUploadModal/FileUploadModal";
import { useApp } from "../../ui/AppContext";
import { LayoutStateProvider, useLayoutState } from "../../ui/LayoutStateContext";
import { useModelToolActions } from "./useModelToolActions";
import { useReviewInfoState } from "./useReviewInfoState";
import { setModelBytes } from "../../core/ModelBytesRegistry";
import type { ModelDisplayNames } from "../../engine/createApplication";
import { BcfManager } from "../../viewer/bcf/BcfManager";
import type { BcfFilterStatus, BcfManagerState, BcfPriority, BcfTopic } from "../../viewer/bcf/types/bcf";
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
    captureViewpoint,
  } = useModelToolActions(app);
  const [bcfSyncRequest, setBcfSyncRequest] = useState<{ topic: BcfTopic; viewpointIndex: number; nonce: number } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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
  const { setZoneVisible, toggleShowShortcuts, panels, togglePanel } = useLayoutState();

  // Etapa 4b-7 - element-info se migró de DockRight (zones.right) a un
  // FloatingPanel (panels["element-info"]), así que nada en "/" vuelve a
  // llamar setZoneVisible("right", ...)/toggleZone("right") nunca más -
  // zones.right se quedaría trabado en su default (true, ver
  // DEFAULT_LAYOUT_ZONES) para siempre. El único consumidor que le queda
  // a esa flag en esta ruta es OrientationCube (corre el cubo hacia la
  // izquierda cuando zones.right es true, asumiendo que hay un DockRight
  // real ocupando ese espacio - ver orientation-cube.css/OrientationCube.tsx,
  // sin cambios, siguen leyendo el context normal) - sin este fix el cubo
  // quedaría permanentemente corrido para un dock que "/" ya nunca monta,
  // encontrado leyendo ese archivo mientras se armaba esta migración, no
  // reportado por el usuario. /revision tiene su propio LayoutStateProvider
  // separado (RevisionLayoutInner) - esto no lo afecta, DockRight ahí sigue
  // real y zones.right sigue siendo su fuente de verdad real.
  useEffect(() => {
    setZoneVisible("right", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Etapa 4b-1 - este mismo botón/atajo (Ctrl+1, ya existente) pasa a
  // controlar el panel flotante piloto (panels["model-tree"]) en vez de
  // zones.left: es la fuente de verdad ÚNICA que decide si se ve el
  // árbol de modelos, no dos toggles independientes que habría que
  // mantener sincronizados. zones.left se queda sin usar por este botón
  // a propósito (sigue existiendo en el contexto, sin tocar, por si algo
  // más la necesita) - ver el gate de <DockLeft> más abajo, que ahora
  // también depende de panels["model-tree"].open, no de zones.left.
  const handleToggleTreePanel = () => {
    togglePanel("model-tree");
  };

  // Etapa 4b-7 - mismo criterio que handleToggleTreePanel/
  // handleToggleIssuesPanel ya siguieron para model-tree/bcf: el toggle
  // real pasa a ser panels["element-info"], no zones.right (DockRight
  // dejó de montarse en "/" - sigue existiendo tal cual en /revision, que
  // no se tocó).
  const handleTogglePropertiesPanel = () => {
    togglePanel("element-info");
  };

  // Etapa 4b-3: BCF se mudó de DockBottom (zones.bottom) a un
  // FloatingPanel (panels["bcf"]) - mismo criterio que
  // handleToggleTreePanel ya siguió para model-tree en 4b-1: el toggle
  // real pasa a ser la única fuente de verdad, no dos estados
  // sincronizados a mano. zones.bottom se queda sin usar por este botón
  // a propósito (nada más lo necesita hoy).
  const handleToggleIssuesPanel = () => {
    togglePanel("bcf");
  };

  const handleStartReview = () => {
    navigate("/revision");
  };

  // Etapa 4b-4 - 4 paneles nuevos, ninguno migrado todavía (son shells
  // "Contenido pendiente", ver el panel-layer más abajo) - mismo patrón
  // togglePanel(id) que model-tree/bcf ya usan, no un mecanismo nuevo.
  const handleToggleFileManagerPanel = () => {
    togglePanel("file-manager");
  };

  const handleToggleReviewInfoPanel = () => {
    togglePanel("review-info");
  };

  const handleToggleReviewGeometryPanel = () => {
    togglePanel("review-geometry");
  };

  const handleToggleSchedulesPanel = () => {
    togglePanel("schedules");
  };

  const hasModels = Object.keys(modelDisplayNames).length > 0;

  // Etapa 4b-6 - Pre-Check/findings de review-info vive acá (Layout.tsx
  // nunca se desmonta), no dentro de ReviewInfoPanel - ver el comentario
  // en useReviewInfoState.ts sobre por qué (FloatingPanel desmonta sus
  // children al cerrarse).
  const reviewInfoState = useReviewInfoState(hasModels, modelDisplayNames);

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

  // Returns false (per CreateTopicDialog's own contract) if the viewer
  // hasn't finished initializing yet - captureViewpoint (from
  // useModelToolActions) returns null in that case rather than throwing,
  // and the dialog stays open with an error so the user's typed input
  // isn't lost (this task's own edge-case requirement, Part 7.6).
  const handleCreateTopicSubmit = (title: string, description: string, priority: BcfPriority): boolean => {
    const viewpoint = captureViewpoint();
    if (!viewpoint) return false;
    bcfManager.addTopic(title, description, priority, viewpoint);
    setCreateDialogOpen(false);
    return true;
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
      "bcf-create": { onClick: () => setCreateDialogOpen(true) },
      "start-review": { onClick: handleStartReview },
      // isActive lee panels["model-tree"].open, no zones.left - ver el
      // comentario en handleToggleTreePanel de por qué ese pasó a ser la
      // única fuente de verdad para este botón.
      "panel-tree": { onClick: handleToggleTreePanel, isActive: panels["model-tree"].open },
      // isActive lee panels["element-info"].open, no zones.right (Etapa
      // 4b-7) - mismo motivo que "panel-tree" arriba.
      "panel-data": { onClick: handleTogglePropertiesPanel, isActive: panels["element-info"].open },
      // isActive lee panels["bcf"].open, no zones.bottom - mismo motivo
      // que "panel-tree" arriba.
      "panel-issues": { onClick: handleToggleIssuesPanel, isActive: panels["bcf"].open },
      "panel-file-manager": { onClick: handleToggleFileManagerPanel, isActive: panels["file-manager"].open },
      "panel-review-info": { onClick: handleToggleReviewInfoPanel, isActive: panels["review-info"].open },
      "panel-review-geometry": { onClick: handleToggleReviewGeometryPanel, isActive: panels["review-geometry"].open },
      "panel-schedules": { onClick: handleToggleSchedulesPanel, isActive: panels["schedules"].open },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toolModuleRuntime, panels]
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

      {/* 1. TOOLBAR - solo con modelo cargado. Antes se mostraba siempre
          (a propósito, ver el commit de Etapa 4a Fase 1: su z-index:55
          se eligió específicamente para quedar por encima del overlay
          del FileUploadModal y que sus botones siguieran usables durante
          el empty state) - ese diseño se revierte acá a pedido explícito.
          Sin pérdida funcional real: casi todos los módulos del toolbar
          ya requieren modelo (requiresModel en registry/modules.ts) y
          quedaban disabled de todas formas sin uno cargado. */}
      {hasModels && (
        <Toolbar
          searchBar={<SearchBar searchManager={searchManager} externalQuery={externalQuery} />}
          moduleRuntime={moduleRuntime}
          hasModel={hasModels}
        />
      )}

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
        {/* Etapa 4b-7: DockRight ya NO se monta en "/" - element-info se
            migró a un FloatingPanel (ver más abajo). DockRight.tsx en sí
            NO se eliminó (sigue siendo real en /revision, RevisionLayout.tsx
            lo sigue montando sin cambios). */}

        {/* Etapa 4b-1..4b-7 - infraestructura de paneles flotantes.
            model-tree (4b-1, reusa ModelTree), bcf (4b-3, reusa BcfPanel -
            DockBottom.tsx se eliminó en ese commit), file-manager/
            schedules/review-geometry (4b-5, UI + mock data, ver
            src/ui/Panels/), review-info (4b-6, ReviewInfoPanel + Pre-Check
            gate, estado en useReviewInfoState.ts - ver ese archivo sobre
            por qué NO vive dentro del panel), element-info (4b-7, reusa
            PropertiesPanel - DockRight ya no se monta en "/", ver el
            comentario arriba). file-manager/schedules/model-tree sin gate
            de hasModels (siempre montados); element-info/bcf/review-info/
            review-geometry SÍ lo tienen (requiresModel:true en el
            registry, ver registry/modules.ts). */}
        {/* Sin este gate, el panel BCF flotante solo se guarda por
            panels["bcf"].open (default false - LayoutStateContext.tsx),
            pero ese valor persiste en localStorage
            (bwise-panels-state-v1): si alguna vez quedó true en una
            sesión anterior, BCF completo renderizaba sobre el empty
            state antes de cargar cualquier modelo - mismo bug de fondo
            ya corregido para DockRight/DockBottom en Etapa 4a. */}
        <div className="panel-layer">
          <FloatingPanel id="model-tree" title="Árbol de Modelos" icon={<IconPanelTree />}>
            <ModelTree hiddenByModel={hiddenByModel} onToggleElementVisibility={handleToggleElementVisibility} />
          </FloatingPanel>

          {hasModels && (
            <FloatingPanel id="element-info" title="Info del Elemento" icon={<IconPanelData />}>
              <PropertiesPanel />
            </FloatingPanel>
          )}

          {hasModels && (
            <FloatingPanel id="bcf" title="Gestor de BCF" icon={<IconPanelIssues />}>
              <BcfPanel
                state={bcfState}
                onFilterChange={handleBcfFilterChange}
                onTopicSelect={handleBcfTopicSelect}
                onTopicActivate={handleBcfTopicActivate}
                moduleRuntime={moduleRuntime}
                hasModel={hasModels}
                createDialogOpen={createDialogOpen}
                onCreateDialogClose={() => setCreateDialogOpen(false)}
                onCreateTopicSubmit={handleCreateTopicSubmit}
              />
            </FloatingPanel>
          )}

          <FloatingPanel id="file-manager" title="Gestor de Archivos" icon={<IconFileManager />}>
            <FileManager />
          </FloatingPanel>

          <FloatingPanel id="schedules" title="Itemizados" icon={<IconSchedules />}>
            <Schedules />
          </FloatingPanel>

          {hasModels && (
            <FloatingPanel id="review-info" title="Info de Revisión" icon={<IconReviewInfo />}>
              <ReviewInfoPanel
                searchManager={searchManager}
                hasModels={hasModels}
                modelDisplayNames={modelDisplayNames}
                {...reviewInfoState}
              />
            </FloatingPanel>
          )}

          {hasModels && (
            <FloatingPanel id="review-geometry" title="Geometría de Revisión" icon={<IconReviewGeometry />}>
              <ReviewGeometry />
            </FloatingPanel>
          )}
        </div>
      </main>

      {/* 5. STATUSBAR */}
      <StatusBar />
    </div>
  );
}
