// src/ui/Viewport/Viewport.tsx
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as OBF from "@thatopen/components-front";
import "./Viewport.css";
import {
  initIfcViewer,
  disposeIfcViewer,
  type IfcViewerHandles,
} from "../../core/IfcBootstrap";
import { SelectionManager } from "../../viewer/SelectionManager";
import { SpatialTreeManager } from "../../viewer/SpatialTreeManager";
import { ProximityManager } from "../../viewer/ProximityManager";
import { EntitySelector, type SelectionBoxState } from "../../viewer/EntitySelector";
import { MeasurementManager, type Measurement, type MeasurementType } from "../../viewer/MeasurementManager";
import { SnapDetector, type SnapType } from "../../viewer/SnapDetector";
import { BcfPinRenderer, PIN_VIEW_DISTANCE } from "../../viewer/bcf/BcfPinRenderer";
import type { BcfTopic } from "../../viewer/bcf/types/bcf";
import { OrientationCube } from "../OrientationCube/OrientationCube";
import { MeasurementToolbar } from "../MeasurementTool/MeasurementToolbar";
import { useApp } from "../AppContext";

interface ViewportProps {
  onViewerReady?: (handles: IfcViewerHandles) => void;
  isSectionBoxActive?: boolean;
  isMeasuring?: boolean;
  bcfTopics?: BcfTopic[];
  bcfActiveTopic?: BcfTopic | null;
  // Comando de un solo uso (nonce, no el topic solo) - ver el comentario en
  // Layout.tsx sobre por qué no alcanza con comparar el topic activo.
  bcfSyncRequest?: { topic: BcfTopic; nonce: number } | null;
  /** OrientationCube no tiene razón de existir sin geometría que orientar. */
  hasModels?: boolean;
}

type CameraControls = NonNullable<IfcViewerHandles["world"]["camera"]["controls"]>;

export default function Viewport({
  onViewerReady,
  isSectionBoxActive,
  isMeasuring,
  bcfTopics,
  bcfActiveTopic,
  bcfSyncRequest,
  hasModels,
}: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const app = useApp();
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState | null>(null);
  const [cameraControls, setCameraControls] = useState<CameraControls | null>(null);
  const viewerHandlesRef = useRef<IfcViewerHandles | null>(null);
  const measurementManagerRef = useRef<MeasurementManager | null>(null);
  const snapDetectorRef = useRef<SnapDetector | null>(null);
  const bcfPinRendererRef = useRef<BcfPinRenderer | null>(null);
  const [measureMode, setMeasureMode] = useState<MeasurementType>("distance");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [currentPointCount, setCurrentPointCount] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    let handles: IfcViewerHandles;
    let isMounted = true;
    let entitySelector: EntitySelector | null = null;

    initIfcViewer(containerRef.current).then((viewer) => {
      if (!isMounted) {
        disposeIfcViewer(viewer);
        return;
      }

      handles = viewer;
      viewerHandlesRef.current = viewer;

      new SelectionManager(viewer, app);
      new SpatialTreeManager(viewer, app);
      new ProximityManager(viewer, app);

      if (containerRef.current) {
        entitySelector = new EntitySelector(viewer, containerRef.current, (box) => {
          setSelectionBox(box);
        });
      }

      setCameraControls(viewer.world.camera.controls ?? null);

      const measurementManager = new MeasurementManager(viewer.world.scene.three);
      measurementManager.onMeasurementCompleted((measurement) => {
        setMeasurements((prev) => [...prev, measurement]);
      });
      measurementManager.onCurrentPointsCountChanged(setCurrentPointCount);
      measurementManagerRef.current = measurementManager;

      const dom = viewer.world.renderer?.three.domElement;
      if (dom) {
        snapDetectorRef.current = new SnapDetector(viewer.world.camera.three, dom);
      }

      bcfPinRendererRef.current = new BcfPinRenderer(viewer.world.scene.three);

      if (onViewerReady) {
        onViewerReady(viewer);
      }

      setTimeout(() => {
        if (viewer.world && viewer.world.renderer) {
          viewer.world.renderer.resize(undefined);
        }
      }, 150);
    }).catch((err) => {
      // Único punto donde se surface un fallo fatal de inicialización del
      // visor 3D - no es debug, es el manejo de error real de esta rama.
      console.error('initIfcViewer failed:', err);
    });

    // ResizeObserver sobre este mismo contenedor: hasta el commit que
    // resuelve el conflicto DockLeft/PropertiesPanel/BcfPanel por espacio,
    // este contenedor SIEMPRE medía 100% del <main> (los paneles flotaban
    // ENCIMA del canvas, sin afectar su caja real) - el único resize que
    // hacía falta era el de 150ms más arriba, una vez, al iniciar. Ahora
    // que DockLeft/DockRightWithTabs son columnas reales de un grid (ver
    // Layout.css), este contenedor SÍ cambia de tamaño de verdad cada vez
    // que un panel lateral se expande/colapsa por proximity-hover, se fija
    // con pin, o se cambia de tab - sin este observer, el renderer de
    // Three.js queda con el tamaño viejo (confirmado visualmente: el
    // modelo desaparecía del canvas después de cambiar de tab, porque el
    // renderer seguía dibujando al ancho de antes del resize del grid).
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        viewerHandlesRef.current?.world.renderer?.resize(undefined);
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      isMounted = false;
      resizeObserver?.disconnect();
      entitySelector?.dispose();
      measurementManagerRef.current?.dispose();
      measurementManagerRef.current = null;
      snapDetectorRef.current = null;
      bcfPinRendererRef.current?.dispose();
      bcfPinRendererRef.current = null;
      viewerHandlesRef.current = null;
      if (handles) {
        disposeIfcViewer(handles);
      }
    };
  }, []);

  // Modo medición: mientras está activo, un click en el visor coloca un
  // punto de medición en vez de seleccionar el elemento clickeado.
  //
  // highlighter.enabled = false NO alcanza por sí solo: el Highlighter
  // engancha sus propios mousedown/mouseup/pointermove directo sobre el
  // <canvas> (confirmado leyendo setupEvents() en el bundle real), y ese
  // flag únicamente bloquea las llamadas a highlightByID() - no desengancha
  // esos listeners. Como el listener de medición vive en el contenedor
  // (padre del canvas), sin más, AMBOS manejadores procesaban el mismo
  // click (confirmado con Playwright: la selección normal quedaba rota
  // después de medir, incluso en el click SIGUIENTE a desactivar la
  // herramienta). La fase de captura + stopPropagation en mousedown/mouseup
  // corta el evento ANTES de que baje hasta el canvas, así el Highlighter
  // nunca llega a procesarlo.
  useEffect(() => {
    const viewer = viewerHandlesRef.current;
    const manager = measurementManagerRef.current;
    const snapDetector = snapDetectorRef.current;
    const container = containerRef.current;
    if (!isMeasuring || !viewer || !manager || !container) return;

    const highlighter = viewer.components.get(OBF.Highlighter);
    highlighter.enabled = false;

    const dom = viewer.world.renderer?.three.domElement;

    // El propio MeasurementToolbar flota DENTRO de este mismo contenedor
    // (para poder posicionarse sobre el canvas) - sin esta exclusión, sus
    // propios botones (Distancia/Área/Limpiar) quedaban atrapados por el
    // mismo interceptor pensado para el canvas, y nunca llegaban a disparar
    // su onClick (bug real: "Área" no cambiaba de modo al clickearlo).
    const isOnMeasurementUI = (event: MouseEvent) =>
      event.target instanceof HTMLElement && event.target.closest(".measurement-toolbar") !== null;

    const stopPropagationCapture = (event: MouseEvent) => {
      if (isOnMeasurementUI(event)) return;
      event.stopPropagation();
    };

    const handleClick = (event: MouseEvent) => {
      if (isOnMeasurementUI(event)) return;
      event.stopPropagation();
      void (async () => {
        // Si hay un snap activo (vértice/arista/plano), se usa ESE punto
        // exacto en vez del raycast crudo del click - es la posición que el
        // usuario está viendo resaltada, no un punto "cerca" de ahí.
        const snap = manager.getSnapPoint();
        if (snap) {
          manager.addPoint(snap.position);
          return;
        }

        if (!dom) return;

        const mouse = new THREE.Vector2(event.clientX, event.clientY);
        let closestPoint: THREE.Vector3 | null = null;
        let closestDistance = Infinity;

        // Con modelos federados, un click puede caer sobre más de uno -
        // igual que un raycast normal, se queda con el hit más cercano a
        // la cámara, no con el primer modelo que responda.
        for (const model of viewer.fragments.list.values() as any) {
          try {
            const result = await model.raycast({ camera: viewer.world.camera.three, dom, mouse });
            if (result?.point && result.distance < closestDistance) {
              closestPoint = result.point;
              closestDistance = result.distance;
            }
          } catch (error) {
            console.error("❌ Error en el raycast de la herramienta de medición:", error);
          }
        }

        if (closestPoint) manager.addPoint(closestPoint);
      })();
    };

    // Snap detection: reutiliza el MISMO resultado de detectSnap tanto para
    // el resaltado (círculo/línea/cuadrado rojo) como para la línea de
    // preview en vivo hacia el cursor - no hace falta un raycast aparte
    // "sin snap" porque FACE ya actúa como snap de respaldo mientras el
    // cursor esté sobre cualquier superficie (POINT/LINE son los snaps
    // finos, con radio de tolerancia acotado).
    //
    // "Un solo pedido en vuelo a la vez" en vez de lanzar un
    // raycastWithSnapping por cada mousemove: cada llamada viaja a un
    // worker thread por modelo cargado, y mousemove puede disparar decenas
    // de veces por segundo - encolarlas sin control satura los workers.
    // Se guarda solo la ÚLTIMA posición pendiente mientras hay un pedido en
    // curso, y al resolver se dispara con esa (nunca con una posición
    // vieja).
    let cancelled = false;
    let inFlight = false;
    let pendingPos: { x: number; y: number } | null = null;

    const cursorByType: Record<SnapType, string> = {
      vertex: "crosshair",
      edge: "cell",
      plane: "copy",
    };

    const processPending = async () => {
      if (inFlight || !pendingPos || !snapDetector) return;
      const { x, y } = pendingPos;
      pendingPos = null;
      inFlight = true;
      try {
        const snap = await snapDetector.detectSnap(viewer.fragments.list.values() as any, x, y);
        if (cancelled) return;
        manager.updateSnap(snap);
        manager.updateHoverPosition(snap?.position ?? null);
        if (dom) dom.style.cursor = snap ? cursorByType[snap.type] : "default";
      } catch (error) {
        console.error("❌ Error detectando snap:", error);
      } finally {
        inFlight = false;
        if (pendingPos) void processPending();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isOnMeasurementUI(event)) return;
      pendingPos = { x: event.clientX, y: event.clientY };
      void processPending();
    };

    container.addEventListener("mousedown", stopPropagationCapture, true);
    container.addEventListener("mouseup", stopPropagationCapture, true);
    container.addEventListener("click", handleClick, true);
    container.addEventListener("mousemove", handleMouseMove);
    return () => {
      cancelled = true;
      container.removeEventListener("mousedown", stopPropagationCapture, true);
      container.removeEventListener("mouseup", stopPropagationCapture, true);
      container.removeEventListener("click", handleClick, true);
      container.removeEventListener("mousemove", handleMouseMove);
      if (dom) dom.style.cursor = "default";
      highlighter.enabled = true;
      manager.cancelCurrent();
      manager.updateSnap(null);
    };
  }, [isMeasuring]);

  // bcfPinRendererRef se llena async (dentro del .then() de initIfcViewer),
  // así que si topics llega ANTES de que el viewer termine de inicializar
  // este efecto no hace nada todavía - inofensivo en la práctica (el
  // visor inicializa en milisegundos, mucho antes de que el usuario llegue
  // a importar un BCF a mano), pero real: no hay una segunda pasada
  // automática apenas el renderer queda listo.
  useEffect(() => {
    bcfPinRendererRef.current?.renderPins(bcfTopics ?? [], bcfActiveTopic?.guid ?? null);
  }, [bcfTopics, bcfActiveTopic]);

  // Doble click en un issue del BcfPanel -> mover la cámara a su viewpoint.
  // setLookAt(posición, target, transición) en una sola llamada, no
  // setPosition()+setTarget() por separado (ambos son solo alias de
  // setLookAt internamente - dos llamadas en vez de una no gana nada, y
  // sin pasar enableTransition el salto queda seco en vez de suave). El
  // target se proyecta a PIN_VIEW_DISTANCE en la dirección de la cámara,
  // el mismo valor que usa BcfPinRenderer para ubicar el pin - así la
  // cámara termina apuntando exactamente al punto marcado, no a donde
  // estaba parado el revisor que sacó la captura original.
  useEffect(() => {
    if (!bcfSyncRequest || !cameraControls) return;

    const { position, direction } = bcfSyncRequest.topic.viewpoint.camera;
    cameraControls.setLookAt(
      position.x,
      position.y,
      position.z,
      position.x + direction.x * PIN_VIEW_DISTANCE,
      position.y + direction.y * PIN_VIEW_DISTANCE,
      position.z + direction.z * PIN_VIEW_DISTANCE,
      true,
    );
  }, [bcfSyncRequest, cameraControls]);

  return (
    <div
      ref={containerRef}
      className="viewport-container"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "hidden"
      }}
    >
      {cameraControls && <OrientationCube controls={cameraControls} hasModels={Boolean(hasModels)} />}

      {isMeasuring && (
        <MeasurementToolbar
          mode={measureMode}
          onModeChange={(mode) => {
            setMeasureMode(mode);
            measurementManagerRef.current?.setMode(mode);
          }}
          onClearAll={() => {
            measurementManagerRef.current?.clearAll();
            setMeasurements([]);
          }}
          onFinishArea={() => {
            measurementManagerRef.current?.completeCurrentMeasurement();
          }}
          measurements={measurements}
          currentPointCount={currentPointCount}
        />
      )}

      {isSectionBoxActive && (
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            left: "10px",
            zIndex: 10,
            padding: "6px 10px",
            fontSize: "11px",
            background: "rgba(30,30,30,0.85)",
            color: "#ccc",
            border: "1px solid #555",
            borderRadius: "4px",
            pointerEvents: "none",
          }}
        >
          Doble clic para crear el plano · Arrastrá la flecha para moverlo · Alt+rueda para zoom fino
        </div>
      )}

      {selectionBox && (
        <>
          {/* Vértice inicial: fijo en el punto donde se cumplieron los 2s,
              no se mueve mientras crece el rectángulo. */}
          <div
            style={{
              position: "fixed",
              left: selectionBox.startX - 3,
              top: selectionBox.startY - 3,
              width: "6px",
              height: "6px",
              zIndex: 16,
              borderRadius: "50%",
              background: "rgba(187, 0, 255, 0.9)",
              pointerEvents: "none",
            }}
          />
          {/* Rectángulo: crece desde el vértice hasta la posición actual
              del cursor, en cualquier dirección. */}
          <div
            style={{
              position: "fixed",
              left: Math.min(selectionBox.startX, selectionBox.currentX),
              top: Math.min(selectionBox.startY, selectionBox.currentY),
              width: Math.abs(selectionBox.currentX - selectionBox.startX),
              height: Math.abs(selectionBox.currentY - selectionBox.startY),
              zIndex: 15,
              border: "2px solid rgba(187, 0, 255, 0.8)",
              background: "rgba(187, 0, 255, 0.15)",
              pointerEvents: "none",
            }}
          />
        </>
      )}
    </div>
  );
}
