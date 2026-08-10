// src/ui/OrientationCube/OrientationCube.tsx
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { IfcViewerHandles } from "../../core/IfcBootstrap";
import { useLayoutState, TOOLBAR_GAP } from "../LayoutStateContext";
import "./orientation-cube.css";

// Se deriva del tipo real en vez de importar "camera-controls" directo -
// ese paquete es una dependencia transitiva (vía @thatopen/components),
// no una dependencia directa de este proyecto.
type CameraControls = NonNullable<IfcViewerHandles["world"]["camera"]["controls"]>;

type ViewDirection =
  | "front" | "back" | "left" | "right" | "top" | "bottom"
  | "top-front-right" | "top-front-left" | "top-back-right" | "top-back-left"
  | "bottom-front-right" | "bottom-front-left" | "bottom-back-right" | "bottom-back-left";

const PI = Math.PI;
// Elevación isométrica clásica (~54.7356° desde el polo) - mismo ángulo que
// usan la mayoría de los view-cubes de CAD/BIM para las vistas de esquina.
const ISO_ELEVATION = Math.acos(1 / Math.sqrt(3));

// theta = ángulo azimutal (horizontal, alrededor de Y), phi = ángulo polar
// (vertical, medido desde +Y) - misma convención de camera-controls
// (internamente usa THREE.Spherical), verificada leyendo su código fuente
// antes de escribir esto, no asumida.
const VIEWS: Record<ViewDirection, { theta: number; phi: number }> = {
  front: { theta: 0, phi: PI / 2 },
  back: { theta: PI, phi: PI / 2 },
  right: { theta: PI / 2, phi: PI / 2 },
  left: { theta: -PI / 2, phi: PI / 2 },
  top: { theta: 0, phi: 0 },
  bottom: { theta: 0, phi: PI },
  "top-front-right": { theta: PI / 4, phi: ISO_ELEVATION },
  "top-front-left": { theta: -PI / 4, phi: ISO_ELEVATION },
  "top-back-right": { theta: (3 * PI) / 4, phi: ISO_ELEVATION },
  "top-back-left": { theta: (-3 * PI) / 4, phi: ISO_ELEVATION },
  "bottom-front-right": { theta: PI / 4, phi: PI - ISO_ELEVATION },
  "bottom-front-left": { theta: -PI / 4, phi: PI - ISO_ELEVATION },
  "bottom-back-right": { theta: (3 * PI) / 4, phi: PI - ISO_ELEVATION },
  "bottom-back-left": { theta: (-3 * PI) / 4, phi: PI - ISO_ELEVATION },
};

const HALF = 30; // mitad del lado del cubo (60px)
const ANIMATION_DURATION_MS = 400;
// Spacing propio del cubo (20px, a pedido explícito) - mismo valor que
// orientation-cube.css usa para top/right por defecto, repetido acá
// porque el cálculo de `right` cuando DockRight está abierto vive en JS
// (ver más abajo), no en CSS puro.
const CUBE_GAP = 20;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// camera-controls.azimuthAngle es ACUMULATIVO (cada vuelta completa suma
// 360°, no se resetea a [-180°,180°] - ver el comentario del propio JSDoc
// de la librería). Interpolar directo hacia un theta objetivo fijo (que sí
// vive en [-π,π], como los de VIEWS) sin este ajuste haría que la cámara
// gire "la vuelta larga" cada vez que el azimut acumulado ya pasó varias
// veces por 360°. Se normaliza la DIFERENCIA a (-π,π] y se suma sobre el
// valor acumulado actual, no sobre el theta crudo del target.
function shortestTargetAngle(current: number, target: number): number {
  const twoPi = 2 * PI;
  let delta = ((target - current + PI) % twoPi + twoPi) % twoPi - PI;
  return current + delta;
}

interface OrientationCubeProps {
  controls: CameraControls;
  /** Sin modelos cargados no hay geometría que orientar - el cubo no tiene razón de existir todavía. */
  hasModels: boolean;
}

export function OrientationCube({ controls, hasModels }: OrientationCubeProps) {
  const { zones, rightWidth } = useLayoutState();
  const [angles, setAngles] = useState({ theta: 0, phi: PI / 2 });
  const animationFrameRef = useRef<number | null>(null);

  // Sincronización real con la cámara: se lee azimuthAngle/polarAngle
  // directo de camera-controls (ya expone esos getters) en su propio
  // evento "update" - nada de sondear camera.quaternion con setInterval,
  // que sería impreciso (ambigüedad de orden de Euler) y desperdiciaría
  // ciclos incluso cuando la cámara está quieta.
  useEffect(() => {
    const updateAngles = () => {
      setAngles({ theta: controls.azimuthAngle, phi: controls.polarAngle });
    };
    updateAngles();
    controls.addEventListener("update", updateAngles);
    return () => controls.removeEventListener("update", updateAngles);
  }, [controls]);

  // Cancelar cualquier animación en vuelo si el componente se desmonta
  // (cambio de modelo/viewer) mientras el rAF sigue corriendo.
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Animación propia por rAF en vez de confiar en el damping interno de
  // camera-controls (enableTransition:true): ese damping es exponencial
  // (smoothTime≈250ms, tarda varias veces ese valor en asentar del todo),
  // no una curva ease-in-out de duración fija - acá se pidió explícitamente
  // 400ms ease-in-out, así que se interpola a mano y se aplica con
  // enableTransition:false en cada frame.
  const handleViewChange = (direction: ViewDirection) => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const target = VIEWS[direction];
    const startAzimuth = controls.azimuthAngle;
    const startPolar = controls.polarAngle;
    const targetAzimuth = shortestTargetAngle(startAzimuth, target.theta);
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION_MS, 1);
      const eased = easeInOutCubic(progress);

      controls.rotateTo(
        lerp(startAzimuth, targetAzimuth, eased),
        lerp(startPolar, target.phi, eased),
        false,
      );

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Después de todos los hooks (reglas de Hooks: no pueden ser
  // condicionales) - controls sigue existiendo aunque no haya modelos
  // (es de la cámara, no del modelo), así que los efectos de arriba no
  // necesitan este guard, solo el render final.
  if (!hasModels) return null;

  const thetaDeg = (angles.theta * 180) / PI;
  const phiDeg = (angles.phi * 180) / PI;

  const cubeStyle: CSSProperties = {
    transform: `rotateX(${phiDeg - 90}deg) rotateY(${-thetaDeg}deg)`,
  };

  // El cubo se corre al costado izquierdo de DockRight cuando está
  // abierto, en vez de quedar tapado detrás/encima de él. `right` se
  // deriva de rightWidth (LayoutStateContext) en este mismo render - NO
  // de querySelector('.dock-right').getBoundingClientRect() en un
  // efecto (ese patrón ya se probó, antes de Fase 4, y se abandonó por
  // desincronizarse - ver el comentario de orientation-cube.css). Usar
  // el mismo rightWidth que DockRight.tsx ya usa para su propio ancho
  // (style inline) hace que ambos deriven del mismo número en el mismo
  // ciclo de render - estructuralmente no pueden desincronizarse entre
  // sí, sin necesitar leer el DOM ya pintado.
  // CUBE_GAP (20px, a pedido explícito) + rightWidth + TOOLBAR_GAP =
  // separación propia del cubo hacia el dock/borde + el ancho real de
  // DockRight + el gap real que DockRight YA tiene hacia el borde de la
  // ventana (dock-right.css: right:var(--toolbar-gap), 12px, sin
  // cambios - ese es el gap del dock, no el del cubo). Son dos
  // constantes de spacing distintas a propósito: CUBE_GAP es "cuánto
  // aire quiere el cubo alrededor suyo", TOOLBAR_GAP sigue siendo "cuánto
  // aire quieren toolbar/docks" - coincidían en 12px antes de este
  // cambio, dejaron de coincidir ahora que el cubo pidió 20px.
  //
  // Portal a document.body: el cubo sigue siendo hijo de Viewport.tsx
  // (dentro de .viewport-container), que es position:fixed con su
  // propio z-index desde Fase 1 - eso crea un stacking context que
  // atraparía cualquier cambio de posición/z-index interno sin importar
  // el valor (mismo motivo que KeyboardShortcutsModal/Toolbar3DFloating/
  // LoadingOverlay ya necesitaron portal).
  const cubeRight = zones.right ? CUBE_GAP + rightWidth + TOOLBAR_GAP : CUBE_GAP;

  return createPortal(
    <div className="orientation-cube" style={{ right: `${cubeRight}px` }}>
      <div className="orientation-cube-inner" style={cubeStyle}>
        <Face label="FRONT" direction="front" onClick={handleViewChange} />
        <Face label="BACK" direction="back" onClick={handleViewChange} />
        <Face label="LEFT" direction="left" onClick={handleViewChange} />
        <Face label="RIGHT" direction="right" onClick={handleViewChange} />
        <Face label="TOP" direction="top" onClick={handleViewChange} />
        <Face label="BOTTOM" direction="bottom" onClick={handleViewChange} />

        <Vertex x={HALF} y={-HALF} z={HALF} direction="top-front-right" onClick={handleViewChange} />
        <Vertex x={-HALF} y={-HALF} z={HALF} direction="top-front-left" onClick={handleViewChange} />
        <Vertex x={HALF} y={-HALF} z={-HALF} direction="top-back-right" onClick={handleViewChange} />
        <Vertex x={-HALF} y={-HALF} z={-HALF} direction="top-back-left" onClick={handleViewChange} />
        <Vertex x={HALF} y={HALF} z={HALF} direction="bottom-front-right" onClick={handleViewChange} />
        <Vertex x={-HALF} y={HALF} z={HALF} direction="bottom-front-left" onClick={handleViewChange} />
        <Vertex x={HALF} y={HALF} z={-HALF} direction="bottom-back-right" onClick={handleViewChange} />
        <Vertex x={-HALF} y={HALF} z={-HALF} direction="bottom-back-left" onClick={handleViewChange} />
      </div>
    </div>,
    document.body,
  );
}

const FACE_TRANSFORMS: Record<string, string> = {
  front: `translateZ(${HALF}px)`,
  back: `rotateY(180deg) translateZ(${HALF}px)`,
  right: `rotateY(90deg) translateZ(${HALF}px)`,
  left: `rotateY(-90deg) translateZ(${HALF}px)`,
  top: `rotateX(90deg) translateZ(${HALF}px)`,
  bottom: `rotateX(-90deg) translateZ(${HALF}px)`,
};

function Face({
  label,
  direction,
  onClick,
}: {
  label: string;
  direction: ViewDirection;
  onClick: (direction: ViewDirection) => void;
}) {
  return (
    <div
      className="orientation-cube-face"
      style={{ transform: FACE_TRANSFORMS[direction] }}
      onClick={() => onClick(direction)}
      title={`Vista ${label.toLowerCase()}`}
    >
      {label}
    </div>
  );
}

function Vertex({
  x,
  y,
  z,
  direction,
  onClick,
}: {
  x: number;
  y: number;
  z: number;
  direction: ViewDirection;
  onClick: (direction: ViewDirection) => void;
}) {
  return (
    <div
      className="orientation-cube-vertex"
      style={{ "--vertex-translate": `translate3d(${x}px, ${y}px, ${z}px)` } as CSSProperties}
      onClick={() => onClick(direction)}
      title={`Vista isométrica (${direction})`}
    >
      <svg viewBox="0 0 20 20" style={{ width: "100%", height: "100%" }}>
        <defs>
          <radialGradient id={`glow-${direction}`} cx="50%" cy="50%">
            <stop offset="0%" stopColor="#6ba8e8" stopOpacity="1" />
            <stop offset="50%" stopColor="#4a90d9" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#2c5aa0" stopOpacity="0.3" />
          </radialGradient>
          <filter id={`glow-filter-${direction}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="10" cy="10" r="6" fill={`url(#glow-${direction})`} filter={`url(#glow-filter-${direction})`} />
      </svg>
    </div>
  );
}
