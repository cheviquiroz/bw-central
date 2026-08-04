// src/core/IfcBootstrap.ts
import * as THREE from "three";
import * as OBC from "@thatopen/components";

export interface IfcViewerHandles {
  components: OBC.Components;
  world: OBC.World;
  fragments: OBC.FragmentsManager;
}

interface BootstrapRegistry {
  loader: any | null;
  fragments: OBC.FragmentsManager | null;
  world: OBC.World | null;
  cleanupMouseScheme: (() => void) | null;
  cleanupWheelScheme: (() => void) | null;
  cleanupClipperScheme: (() => void) | null;
  cleanupOrbitPivotScheme: (() => void) | null;
}

const registry: BootstrapRegistry = {
  loader: null,
  fragments: null,
  world: null,
  cleanupMouseScheme: null,
  cleanupWheelScheme: null,
  cleanupClipperScheme: null,
  cleanupOrbitPivotScheme: null,
};

export async function initIfcViewer(
  container: HTMLElement,
): Promise<IfcViewerHandles> {
  const components = new OBC.Components();

  const worlds = components.get(OBC.Worlds);
  const world = worlds.create<
    OBC.SimpleScene,
    OBC.SimpleCamera,
    OBC.SimpleRenderer
  >();

  world.scene = new OBC.SimpleScene(components);
  world.scene.setup();
  world.scene.three.background = null;

  world.renderer = new OBC.SimpleRenderer(components, container);
  // Overlay "That Open Company" que el propio SimpleRenderer inyecta en el
  // DOM del canvas - decisión de producto: se quita.
  (world.renderer as any).showLogo = false;
  world.camera = new OBC.SimpleCamera(components);
  world.camera.controls.setLookAt(15, 10, 15, 0, 0, 0);

  // 🌟 CONFIGURACIÓN DE ZOOM: Traspasar elementos y romper límites
  const controls = world.camera.controls;
  controls.minDistance = 0.01;      // Permite acercarse al milímetro

  // 🌟 NEAR PLANE ATADO A minDistance: SimpleCamera crea la cámara con
  // near=1 fijo (ver @thatopen/components SimpleCamera.setupCamera()) - con
  // minDistance=0.01 la cámara puede llegar a 1cm del TARGET, pero el
  // near-plane (medido desde la CÁMARA, no el target) seguía en 1m: todo lo
  // que quedara a menos de 1m de la cámara se recortaba, causando el corte
  // prematuro reportado en zoom profundo.
  //
  // Un solo cálculo, no un listener en 'update': a diferencia de la idea
  // original (recalcular en cada evento 'update' de controls), minDistance
  // es una constante fija en esta app - nunca cambia en runtime. Reevaluar
  // la misma cuenta en cada frame de cámara (controls dispara 'update'
  // continuamente durante cualquier movimiento) sería trabajo desperdiciado,
  // ya que updateProjectionMatrix() no es gratis. Si minDistance llegara a
  // volverse configurable en runtime, esto necesitaría reengancharse a un
  // listener recién ahí.
  //
  // Con far=1000 sin tocar, near=0.001 da una relación near:far de
  // 1.000.000:1 - MUY alta para un depth buffer estándar (este proyecto NO
  // tiene logarithmicDepthBuffer activado en SimpleRenderer, confirmado
  // leyendo su constructor). Riesgo real de z-fighting en superficies
  // coplanares a distancia media/lejana - a verificar visualmente; si
  // aparece, la solución de fondo sería logarithmicDepthBuffer:true en el
  // renderer (fuera del alcance de este cambio puntual), no revertir esto.
  world.camera.three.near = Math.max(controls.minDistance * 0.1, 0.001);
  world.camera.three.updateProjectionMatrix();

  controls.infinityDolly = true;    // Permite al zoom cruzar paredes libremente
  controls.smoothTime = 0.0001;     // Sin inercia: movimiento seco, sin "trailing" al soltar
  // draggingSmoothTime gobierna el suavizado MIENTRAS se arrastra (no solo
  // al soltar, eso es smoothTime) - sin este ajuste quedaba en el default
  // de la librería (0.125s), y ese lag continuo durante el drag es lo que
  // se sentía como "acelera y tiene inercia" al panear.
  controls.draggingSmoothTime = 0.0001;
  controls.azimuthRotateSpeed = 0.5; // Orbit horizontal a mitad de velocidad
  controls.polarRotateSpeed = 0.5;   // Orbit vertical a mitad de velocidad
  controls.truckSpeed = 1.0;         // Paneo a mitad de velocidad (mismo criterio que el orbit)

  // --- Esquema de mouse estilo Solibri ---
  // Left = orbit en drag, click sin mover = selección (Highlighter, ver
  // SelectionManager.ts), hold 2s sin mover = selector de entidades por
  // área (EntitySelector.ts) - los tres conviven porque Highlighter y
  // EntitySelector tienen su propio umbral de movimiento para distinguir
  // "click"/"hold" de "drag", y camera-controls no mueve la cámara si no
  // hubo desplazamiento real del mouse. Right = libre, sin asignar todavía.
  // Middle = pan. Shift sin usar.
  const ACTION = (controls.constructor as any).ACTION;

  controls.mouseButtons.left = ACTION.ROTATE;     // Orbit en drag; click/hold van por fuera de camera-controls
  controls.mouseButtons.right = ACTION.NONE;      // Libre
  controls.mouseButtons.wheel = ACTION.NONE;      // Manejado manualmente abajo
  controls.mouseButtons.middle = ACTION.TRUCK;    // Pan

  // El navegador abre su propio menú contextual en right-click por
  // default - lo dejamos prevenido para no ensuciar la escena 3D, aunque
  // hoy right-click no dispare ninguna acción propia.
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };
  container.addEventListener("contextmenu", handleContextMenu);

  registry.cleanupMouseScheme = () => {
    container.removeEventListener("contextmenu", handleContextMenu);
  };

  // --- Soporte de gestos de trackpad (Mac) e input manual con cinemática dinámica ---
  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();

    const threeCamera = world.camera.three; 
    const position = new (threeCamera.position.constructor as any)();
    const target = new (threeCamera.position.constructor as any)();
    
    controls.getPosition(position);
    controls.getTarget(target);

    // 1. Calculamos la distancia real tridimensional al target actual
    const dx = position.x - target.x;
    const dy = position.y - target.y;
    const dz = position.z - target.z;
    const currentDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // 🌟 DESACELERACIÓN DINÁMICA: A menor distancia, reducimos el paso geométrico
    // Piso bajado de 0.1 a 0.01: con el piso viejo, por debajo de ~1m de
    // distancia el paso quedaba fijo en ~10-12cm por muesca de rueda (dolly()
    // usa unidades de mundo, no un porcentaje) - alcanzaba para pasarse de
    // largo un detalle a distancia de inspección. El nuevo piso sigue
    // achicando el paso hasta los ~10cm de distancia (a partir de ahí el
    // paso queda fijo en ~1cm por muesca). El techo (5) queda igual, no
    // afecta el zoom lejos del modelo.
    const distanceFactor = Math.max(0.01, Math.min(currentDistance * 0.1, 5));

    // Alt: zoom fino, para acercarse con precisión sin pasarse de largo.
    // No se usa Shift (ya dispara orbit + su propia rama de dolly acá
    // abajo) ni Ctrl (ya tiene su propio factor reducido, probablemente
    // para compensar el gesto de pinch-zoom de trackpad) - Alt es el único
    // modificador libre en todo este esquema de mouse/wheel.
    const FINE_ZOOM_FACTOR = 0.2;
    const zoomPrecisionFactor = event.altKey ? FINE_ZOOM_FACTOR : 1;

    const dollyFactor = 0.01 * distanceFactor * zoomPrecisionFactor;
    const truckFactor = 0.002 * distanceFactor;

    // Función auxiliar optimizada para recalcular el target de manera adaptativa
    const updateTargetAhead = (targetDistance: number) => {
      const direction = new (threeCamera.position.constructor as any)();
      threeCamera.getWorldDirection(direction);
      
      controls.setTarget(
        position.x + direction.x * targetDistance,
        position.y + direction.y * targetDistance,
        position.z + direction.z * targetDistance,
        false
      );
    };

    if (event.ctrlKey) {
      controls.dolly(-event.deltaY * (dollyFactor * 0.5), true);
      updateTargetAhead(Math.max(2, currentDistance)); 
    } else if (event.shiftKey) {
      const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      controls.dolly(-delta * dollyFactor, true);
      updateTargetAhead(Math.max(2, currentDistance));
    } else if (event.deltaX !== 0) {
      controls.truck(-event.deltaX * truckFactor, event.deltaY * truckFactor, true);
    } else {
      controls.dolly(-event.deltaY * dollyFactor, true);
      const nextTargetDistance = Math.max(2, currentDistance - (event.deltaY * dollyFactor));
      updateTargetAhead(nextTargetDistance);
    }
  };

  container.addEventListener("wheel", handleWheel, { passive: false });

  registry.cleanupWheelScheme = () => {
    container.removeEventListener("wheel", handleWheel);
  };

  components.init();

  // --- Orbit around cursor (estilo Solibri) ---
  // Seleccionar un elemento NO mueve la cámara - el pivote de orbit se
  // recalcula al EMPEZAR cada mousedown de left-click (el mismo botón
  // mapeado a ACTION.ROTATE más arriba), usando el punto de geometría bajo
  // el cursor en ese instante. Se dispara también en clicks/holds que no
  // terminan en drag, pero eso es inofensivo: sin desplazamiento real del
  // mouse no hay orbit que pivotear.
  //
  // setOrbitPoint() (no setTarget) porque compensa con un focalOffset para
  // mover el pivote sin rotar ni trasladar la cámara - setTarget() sí
  // reorienta la cámara hacia el nuevo punto (ver setLookAt interno).
  //
  // No hace falta coordinar esto con updateTargetAhead()/handleWheel más
  // abajo: ese código pisa el target en cada scroll para sus propios
  // cálculos de zoom, pero como acá el pivote se recalcula de cero en cada
  // nuevo gesto de orbit, cualquier target que haya dejado el wheel queda
  // reemplazado igual. Si no hay geometría bajo el cursor, simplemente no
  // se llama a setOrbitPoint() - el pivote existente (sea el que dejó un
  // orbit anterior o el wheel) queda como está, sin saltar a ningún lado.
  const orbitRaycaster = components.get(OBC.Raycasters).get(world);

  const handleOrbitStart = (event: MouseEvent) => {
    if (event.button !== 0) return; // left-click

    orbitRaycaster.castRay().then((intersection) => {
      if (!intersection) return;
      controls.setOrbitPoint(intersection.point.x, intersection.point.y, intersection.point.z);
    }).catch((error) => {
      console.error("❌ Error calculando el pivote del orbit:", error);
    });
  };

  container.addEventListener("mousedown", handleOrbitStart);

  registry.cleanupOrbitPivotScheme = () => {
    container.removeEventListener("mousedown", handleOrbitStart);
  };

  // --- Section Box (Clipper) ---
  // Desactivado por defecto: mientras está activo, un doble click sobre
  // geometría crea un plano de corte.
  const clipper = components.get(OBC.Clipper);
  clipper.enabled = false;

  // "opacity" es el valor de reposo (material compartido por todos los
  // planos); el valor "resaltado" mientras se arrastra se aplica aparte,
  // más abajo, en cada plano creado.
  clipper.setup({ opacity: 0.1 });

  // autoScalePlanes=true (default) reescala el plano según distancia de
  // cámara en cada frame - bueno para que el gizmo se vea legible a
  // cualquier zoom, malo para que el TAMAÑO del rectángulo sea consistente
  // entre distintas orientaciones/distancias. Se desactiva para que el
  // tamaño calibrado más abajo (según el bbox del modelo) quede fijo en el
  // mundo, no relativo a dónde está parada la cámara en cada momento.
  clipper.autoScalePlanes = false;

  const MAX_CLIP_PLANES = 6;

  // Clipper no engancha ningún listener de DOM por sí solo: solo expone
  // create(world), que hace un raycast desde la posición actual del mouse.
  // Sin este listener, activar clipper.enabled no tiene ningún efecto visible.
  const handleClipperDblClick = () => {
    if (!clipper.enabled) return;

    // Multi-plano deliberado: hasta MAX_CLIP_PLANES conviven a la vez (uno
    // por cara, por ejemplo). clipper.list es la lista real que mantiene la
    // librería - no se duplica ese estado acá, así que "Hide Plane"
    // (clipper.visible, ya global) y este límite quedan automáticamente
    // consistentes con cualquier cantidad de planos.
    if (clipper.list.size >= MAX_CLIP_PLANES) return;

    clipper.create(world).then((plane) => {
      if (!plane) return;

      // El material es compartido entre TODOS los planos (Clipper pasa la
      // misma instancia a cada uno) - con multi-plano esto significa que
      // arrastrar cualquiera de ellos tiñe a todos por igual, no solo al
      // que se está moviendo. Aceptado: es una limitación de la librería,
      // no vale la pena clonar materiales por plano para este efecto
      // cosmético. No hace falta remover estos listeners a mano:
      // SimplePlane.dispose() (llamado por clipper.deleteAll()/.delete())
      // ya limpia onDraggingStarted/onDraggingEnded por su cuenta.
      const material = plane.planeMaterial as THREE.MeshBasicMaterial;
      plane.onDraggingStarted.add(() => {
        material.opacity = 0.2;
      });
      plane.onDraggingEnded.add(() => {
        material.opacity = 0.1;
      });

      // Tamaño y orientación consistentes: se mide el bbox del modelo
      // proyectado sobre los ejes REALES del rectángulo (no unos
      // recalculados a mano). SimplePlane orienta su helper con
      // Object3D.lookAt(normal) - para un Object3D genérico (no cámara),
      // Three.js arma esa base con eye/target invertidos respecto a la
      // convención de cámara, y tiene su propio fallback para el caso
      // degenerado (normal casi paralela a Y, el típico corte en planta)
      // que no es trivial de reproducir a mano sin arriesgarse a que quede
      // desalineado - por eso se lee la base ya calculada en vez de
      // rederivarla.
      const modelBox = getLoadedModelsBoundingBox();
      if (modelBox) {
        plane.helper.updateMatrixWorld(true);

        // Ese mismo caso degenerado (normal ~paralela a Y) además deja una
        // rotación IN-PLANE arbitraria - el rectángulo mide bien pero
        // queda girado respecto a los ejes del edificio. Se corrige acá,
        // ANTES de medir, y solo para planos horizontales (los verticales
        // ya salían bien - lookAt no entra en el caso degenerado ahí).
        //
        // Clave: se rota SOLO alrededor del eje Z local del helper (que es
        // -normal), nunca el eje Z en sí. Ese eje es el que usa
        // TransformControls para la dirección de arrastre de la única
        // flecha visible (showX/showY están en false en SimplePlane) - si
        // se tocara, el gizmo tiraría para un lado distinto al corte real.
        // TransformControls.attach() (Three.js real, no wrapper de la
        // librería) solo guarda una referencia al objeto y lee su
        // matrixWorld en cada frame, así que el gizmo se actualiza solo
        // apenas se corrige el quaternion acá, sin tocar nada del lado de
        // TransformControls.
        const worldUp = new THREE.Vector3(0, 1, 0);
        const currentZ = new THREE.Vector3(0, 0, 1).transformDirection(plane.helper.matrixWorld).normalize();

        if (Math.abs(currentZ.dot(worldUp)) > 0.99) {
          const worldX = new THREE.Vector3(1, 0, 0);
          // Proyecta X del mundo sobre el plano perpendicular al eje Z
          // actual (le resta la componente paralela a Z) - con currentZ
          // casi paralelo a Y, worldX ya es casi perpendicular, así que
          // esto es principalmente una normalización, no una distorsión.
          const newX = worldX.clone()
            .sub(currentZ.clone().multiplyScalar(worldX.dot(currentZ)))
            .normalize();
          const newY = new THREE.Vector3().crossVectors(currentZ, newX).normalize();

          const rotationMatrix = new THREE.Matrix4().makeBasis(newX, newY, currentZ);
          plane.helper.quaternion.setFromRotationMatrix(rotationMatrix);
          plane.helper.updateMatrixWorld(true);
        }

        const basisU = new THREE.Vector3(1, 0, 0).transformDirection(plane.helper.matrixWorld);
        const basisV = new THREE.Vector3(0, 1, 0).transformDirection(plane.helper.matrixWorld);

        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;
        for (let i = 0; i < 8; i++) {
          const corner = new THREE.Vector3(
            i & 1 ? modelBox.max.x : modelBox.min.x,
            i & 2 ? modelBox.max.y : modelBox.min.y,
            i & 4 ? modelBox.max.z : modelBox.min.z,
          );
          const u = corner.dot(basisU);
          const v = corner.dot(basisV);
          minU = Math.min(minU, u); maxU = Math.max(maxU, u);
          minV = Math.min(minV, v); maxV = Math.max(maxV, v);
        }

        // No se usa plane.size (fuerza un cuadrado, mismo valor en ambos
        // ejes) - se escala la malla directo, cada eje con su propia
        // medida real, para que el rectángulo visual coincida con la
        // silueta del modelo desde esa cara, no solo con su lado más largo.
        const SECTION_PLANE_MARGIN_METERS = 10;
        const mesh = plane.meshes[0];
        mesh.scale.set(
          (maxU - minU) + SECTION_PLANE_MARGIN_METERS,
          (maxV - minV) + SECTION_PLANE_MARGIN_METERS,
          1,
        );
      }
    }).catch((error) => {
      console.error("❌ Error creando plano de corte:", error);
    });
  };

  container.addEventListener("dblclick", handleClipperDblClick);

  registry.cleanupClipperScheme = () => {
    container.removeEventListener("dblclick", handleClipperDblClick);
  };

  // 🛠️ LIMPIADOR ULTRA VELOZ DE MARCA DE AGUA HTML
  let checks = 0;
  const interval = setInterval(() => {
    if (container) {
      const badges = container.querySelectorAll('img, a, div');
      badges.forEach((el) => {
        const htmlContent = el.innerHTML.toLowerCase();
        const textContent = (el.textContent || "").toLowerCase();
        if (
          htmlContent.includes("that open") ||
          textContent.includes("that open") ||
          htmlContent.includes("thatopen")
        ) {
          (el as HTMLElement).style.setProperty('display', 'none', 'important');
        }
      });
    }
    checks++;
    if (checks > 30) clearInterval(interval);
  }, 50);

  // --- IfcLoader (web-ifc 0.0.77) ---
  const ifcLoader = components.get(OBC.IfcLoader);
  ifcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = false;

  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: {
      path: "https://unpkg.com/web-ifc@0.0.77/",
      absolute: true,
    },
  });

  registry.loader = ifcLoader;

  // --- FragmentsManager ---
  const workerUrl = await OBC.FragmentsManager.getWorker();
  const fragments = components.get(OBC.FragmentsManager);
  fragments.init(workerUrl);

  registry.fragments = fragments;
  registry.world = world;

  world.camera.controls.addEventListener("update", () =>
    fragments.core.update(),
  );

  fragments.list.onItemSet.add(({ value: model }) => {
    model.useCamera(world.camera.three);
    world.scene.three.add(model.object);
    fragments.core.update(true);
  });

  fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
    if (!("isLodMaterial" in material && material.isLodMaterial)) {
      material.polygonOffset = true;
      material.polygonOffsetUnits = 1;
      material.polygonOffsetFactor = Math.random();
    }

    // Fuerza DoubleSide en TODOS los materiales del modelo (incl. LOD) - por
    // defecto vienen en FrontSide (ver Material.new() en
    // @thatopen/fragments/dist/index.mjs:18460, controlado por un flag
    // "doubleSidedMaterials" del serializer que NO está expuesto en la API
    // pública de OBC.IfcLoader; este hook de materiales es el único punto
    // real donde se puede corregir sin tocar la librería). Con FrontSide, la
    // cara "de atrás" de un elemento (visible en zoom cercano, corte de
    // sección, o mirando desde adentro) se vuelve invisible según hacia
    // dónde apunte la normal original del IFC - no es un problema de
    // culling por distancia, es orientación de cara.
    if ("side" in material) {
      material.side = THREE.DoubleSide;
    }
  });

  return { components, world, fragments };
}

export function disposeIfcViewer(handles: IfcViewerHandles) {
  handles.components.dispose();
  registry.loader = null;
  registry.fragments = null;
  registry.cleanupMouseScheme?.();
  registry.cleanupMouseScheme = null;
  registry.cleanupWheelScheme?.();
  registry.cleanupWheelScheme = null;
  registry.cleanupClipperScheme?.();
  registry.cleanupClipperScheme = null;
  registry.cleanupOrbitPivotScheme?.();
  registry.cleanupOrbitPivotScheme = null;
}

/**
 * Une los bounding boxes reales (transformados a espacio de escena) de
 * todos los modelos actualmente cargados. null si no hay ninguno.
 */
function getLoadedModelsBoundingBox(): THREE.Box3 | null {
  if (!registry.fragments) return null;

  const union = new THREE.Box3();
  let hasAny = false;

  for (const model of registry.fragments.list.values() as any) {
    const worldBox = (model as any).box.clone().applyMatrix4((model as any).object.matrixWorld);
    union.union(worldBox);
    hasAny = true;
  }

  return hasAny && !union.isEmpty() ? union : null;
}

/**
 * Posiciona la cámara en una vista diagonal 3/4 (ver INITIAL_VIEW_DIRECTION
 * para la elevación) enfocando el bbox dado. Lógica compartida entre
 * fitCameraToAllLoadedModels ("Encuadrar todo") y setInitialDiagonalView
 * (primera carga) - misma vista, mismo cálculo, para no duplicarlo.
 *
 * No usa fitToBox de camera-controls: esa función redondea el ángulo de
 * cámara ACTUAL al eje ortogonal más cercano (ver su propia implementación
 * en camera-controls - calcula theta/phi con roundToStep a PI_HALF antes
 * de encuadrar), así que nunca produce una vista diagonal, sin importar
 * qué dirección tenga la cámara al llamarla - era la causa real de la
 * "vista posterior" que quedaba antes de este cambio. Acá se posiciona la
 * cámara directo con setLookAt, sin pasar por ese redondeo.
 */
function applyDiagonalView(box: THREE.Box3): void {
  if (!registry.world) return;

  const center = box.getCenter(new THREE.Vector3());
  const diagonal = box.getSize(new THREE.Vector3()).length();

  // Y controla la elevación sobre el horizonte (Y es el eje vertical en
  // este world, ver el resto de IfcBootstrap.ts); X y Z fijos en 1 dan la
  // diagonal 3/4. elevación = atan2(Y, sqrt(2)):
  //   1.0 ≈ 35° (isométrico clásico)   0.7  ≈ 26°
  //   0.55 ≈ 21°                       más bajo = vista más "desde el
  //                                    horizonte", menos "desde arriba".
  const INITIAL_VIEW_DIRECTION = new THREE.Vector3(1, 0.55, 1);
  const direction = INITIAL_VIEW_DIRECTION.clone().normalize();
  const distance = Math.max(diagonal * 0.9, 1);
  const cameraPosition = center.clone().addScaledVector(direction, distance);

  (registry.world.camera as any).controls.setLookAt(
    cameraPosition.x, cameraPosition.y, cameraPosition.z,
    center.x, center.y, center.z,
    true,
  );
}

/**
 * Encuadra la cámara para mostrar todos los modelos actualmente cargados,
 * en la misma vista diagonal 3/4 que la primera carga (recalculada sobre
 * el bbox conjunto actual, así que sigue funcionando bien con N modelos).
 */
export function fitCameraToAllLoadedModels(): void {
  const box = getLoadedModelsBoundingBox();
  if (!box) return;
  applyDiagonalView(box);
}

/**
 * Posiciona la cámara en la vista diagonal inicial. Pensada solo para el
 * primer encuadre (ver ProximityManager) - internamente es la misma vista
 * que "Encuadrar todo", solo se distingue por cuándo se llama.
 */
export function setInitialDiagonalView(): void {
  const box = getLoadedModelsBoundingBox();
  if (!box) return;
  applyDiagonalView(box);
}

export const IfcBootstrap = {
  get loader() {
    if (!registry.loader) {
      throw new Error("El visor 3D aún no se ha inicializado en la pantalla.");
    }
    return registry.loader;
  },
  get fragments() {
    if (!registry.fragments) {
      throw new Error("El gestor de fragmentos aún no se ha inicializado.");
    }
    return registry.fragments;
  }
};