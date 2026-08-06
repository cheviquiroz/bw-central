// src/ui/OrientationCube/OrientationCube.tsx
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { IfcViewerHandles } from "../../core/IfcBootstrap";
import { useLayoutState } from "../LayoutStateContext";
import "./orientation-cube.css";

const CUBE_PANEL_GAP = 40; // separación fija entre el cubo y el borde del panel derecho
// El dock derecho es un ancho fijo único (272px - ver dock-right-tabs.css)
// sin importar qué tab está activa. Este componente ya no necesita
// conocer un ancho publicado por el panel: Phase 4 de este mismo esfuerzo
// va a reposicionar el cubo relativo al propio viewport en vez de
// calcularlo a partir de anchos de hermanos - esta constante es un paso
// intermedio, no la solución final.
const RIGHT_DOCK_WIDTH = 272;

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
}

export function OrientationCube({ controls }: OrientationCubeProps) {
  const [angles, setAngles] = useState({ theta: 0, phi: PI / 2 });
  const animationFrameRef = useRef<number | null>(null);
  // Ya no lee anchos publicados por los paneles (panelWidth/bcfPanelWidth
  // no existen más - ver LayoutStateContext.tsx): con visibilidad binaria,
  // solo hace falta saber SI el dock derecho está visible, no cuánto mide
  // exactamente. Ver la nota de RIGHT_DOCK_MAX_WIDTH arriba sobre por qué
  // esto sigue siendo un cálculo a partir de estado de hermanos, no la
  // solución final que llega en la Fase 4 de este esfuerzo.
  const { zones } = useLayoutState();
  const cubeRightOffset = zones.right ? CUBE_PANEL_GAP + RIGHT_DOCK_WIDTH + 16 : CUBE_PANEL_GAP;

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

  const thetaDeg = (angles.theta * 180) / PI;
  const phiDeg = (angles.phi * 180) / PI;

  const cubeStyle: CSSProperties = {
    transform: `rotateX(${phiDeg - 90}deg) rotateY(${-thetaDeg}deg)`,
  };

  return (
    <div className="orientation-cube" style={{ right: `${cubeRightOffset}px` }}>
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
    </div>
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
