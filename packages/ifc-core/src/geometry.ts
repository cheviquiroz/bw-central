export interface ModelBoundingBox {
  modelId: string;
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface ProximityWarning {
  modelId: string;
  distanceFromGroupMeters: number;
}

export const DEFAULT_DISTANCE_THRESHOLD_METERS = 100;

/**
 * Distancia mínima entre dos cajas delimitadoras (bounding boxes) alineadas
 * a los ejes. Es 0 si las cajas se tocan o se superponen, sin importar
 * cuánto - no depende de sus centros, así que un modelo enorme (topografía)
 * y uno chico (un ascensor) que están pegados dan distancia 0 entre sí,
 * mientras que dos edificios reales lejos entre sí dan su distancia real,
 * sin importar el tamaño de cada caja.
 */
function boxDistance(a: ModelBoundingBox, b: ModelBoundingBox): number {
  const dx = Math.max(a.min.x - b.max.x, b.min.x - a.max.x, 0);
  const dy = Math.max(a.min.y - b.max.y, b.min.y - a.max.y, 0);
  const dz = Math.max(a.min.z - b.max.z, b.min.z - a.max.z, 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Detecta qué modelos, dentro de un conjunto federado, están alejados del
 * resto - SIN decidir cuál está "bien ubicado" y cuál "mal". Agrupa los
 * modelos en conjuntos según cercanía transitiva de sus bounding boxes
 * reales (dos modelos quedan en el mismo grupo si la distancia entre sus
 * cajas es <= thresholdMeters, directa o indirectamente vía otros
 * modelos). El grupo con más modelos se considera el grupo principal;
 * cualquier modelo fuera de ese grupo se reporta con su distancia real
 * hasta el modelo más cercano del grupo principal.
 *
 * Funciona correctamente sin importar el ORDEN de carga: si el primer
 * modelo cargado está mal ubicado y los siguientes están bien ubicados y
 * cerca entre sí, el primero es el que se reporta como alejado.
 */
export function detectDistantModels(
  boxes: ModelBoundingBox[],
  thresholdMeters: number = DEFAULT_DISTANCE_THRESHOLD_METERS
): ProximityWarning[] {
  if (boxes.length < 2) return [];

  let clusters: ModelBoundingBox[][] = boxes.map((b) => [b]);

  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const connected = clusters[i].some((a) =>
          clusters[j].some((b) => boxDistance(a, b) <= thresholdMeters)
        );
        if (connected) {
          clusters[i] = clusters[i].concat(clusters[j]);
          clusters.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  if (clusters.length <= 1) return [];

  clusters.sort((a, b) => b.length - a.length);
  const [majorityCluster, ...otherClusters] = clusters;

  const warnings: ProximityWarning[] = [];
  for (const cluster of otherClusters) {
    for (const box of cluster) {
      const minDistance = Math.min(...majorityCluster.map((b) => boxDistance(b, box)));
      warnings.push({ modelId: box.modelId, distanceFromGroupMeters: minDistance });
    }
  }

  return warnings;
}
