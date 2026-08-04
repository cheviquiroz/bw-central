/**
 * ESTÁNDAR BIM PARA PROYECTOS PÚBLICOS - VERSIÓN FINAL CORREGIDA
 *
 * FASES IDS: DC, DA, DB, DD (4 fases)
 * DISTRIBUCIÓN EXACTA: Según Tabla 06 Estándar BIM (con solapamientos y cortes correctos)
 * ENTIDADES: Existen desde DC/DA en NDI-1, progresivas en DB/DD
 *
 * NOTA: idsPhases indica EXACTAMENTE en qué fases IDS aparece cada uso
 * NOTA: entities[] es METADATA SOLAMENTE (no se conecta a generateChileanSpec,
 * ver src/generation/spec-generator.ts - las entidades reales exigidas vienen
 * de la Matriz PlanBIM en planbim-v3.ts, según sistema estructural + fase)
 */

export type IDSPhase = 'dc' | 'da' | 'db' | 'dd';

/**
 * TODOS LOS USOS BIM (25) - DISTRIBUCIÓN EXACTA CON idsPhases CORRECTOS
 */
export const BIM_USES_COMPLETE = {
  // ═══════════════════════════════════════════════════════════════
  // PLANIFICACIÓN (Usos 1-5)
  // ═══════════════════════════════════════════════════════════════

  USE_01_LEVANTAMIENTO: {
    id: 'uso_01_levantamiento',
    number: 1,
    label: 'Levantamiento de condiciones existentes',
    description: 'Recopilación de información del estado actual',
    tdiRequired: ['TDI_B', 'TDI_C'],
    idsPhases: ['dc'] as IDSPhase[],
    ndiByPhase: { dc: 'NDI-1', da: null, db: null, dd: null },
    entities: []
  },

  USE_02_ESTIMACION: {
    id: 'uso_02_estimacion',
    number: 2,
    label: 'Estimación de cantidades y costos',
    description: 'Mediciones, presupuestos',
    tdiRequired: ['TDI_B', 'TDI_F'],
    idsPhases: ['dc'] as IDSPhase[],
    ndiByPhase: { dc: 'NDI-1', da: null, db: null, dd: null },
    entities: []
  },

  USE_03_PLANIFICACION_FASES: {
    id: 'uso_03_planificacion_fases',
    number: 3,
    label: 'Planificación de fases',
    description: 'Modelos 4D (3D + tiempo) para secuencia',
    tdiRequired: ['TDI_B', 'TDI_L'],
    idsPhases: ['dc', 'da', 'db', 'dd'] as IDSPhase[],
    ndiByPhase: { dc: 'NDI-1', da: 'NDI-1', db: 'NDI-2', dd: 'NDI-2' },
    entities: ['IfcColumn', 'IfcBeam', 'IfcSlab', 'IfcWall', 'IfcFooting']
  },

  USE_04_PROGRAMA_ESPACIAL: {
    id: 'uso_04_programa_espacial',
    number: 4,
    label: 'Análisis del cumplimiento del programa espacial (zonificación)',
    description: 'Evaluación de eficiencia vs requerimientos',
    tdiRequired: ['TDI_B', 'TDI_J', 'TDI_K'],
    idsPhases: ['dc', 'da'] as IDSPhase[],
    ndiByPhase: { dc: 'NDI-1', da: 'NDI-1', db: null, dd: null },
    entities: ['IfcColumn', 'IfcBeam', 'IfcSlab', 'IfcWall']
  },

  USE_05_ANALISIS_UBICACION: {
    id: 'uso_05_analisis_ubicacion',
    number: 5,
    label: 'Análisis de ubicación',
    description: 'Evaluación de propiedades del área',
    tdiRequired: ['TDI_C', 'TDI_I'],
    idsPhases: ['dc', 'da'] as IDSPhase[],
    ndiByPhase: { dc: 'NDI-1', da: 'NDI-1', db: null, dd: null },
    entities: []
  },

  // ═══════════════════════════════════════════════════════════════
  // DISEÑO (Usos 6-15)
  // ═══════════════════════════════════════════════════════════════

  USE_06_COORDINACION_3D: {
    id: 'uso_06_coordinacion_3d',
    number: 6,
    label: 'Coordinación 3D',
    description: 'Detección de interferencias entre disciplinas',
    tdiRequired: ['TDI_A', 'TDI_B', 'TDI_C'],
    idsPhases: ['da', 'db', 'dd'] as IDSPhase[],
    ndiByPhase: { dc: null, da: 'NDI-1', db: 'NDI-2', dd: 'NDI-3' },
    entities: ['IfcColumn', 'IfcBeam', 'IfcSlab', 'IfcWall', 'IfcFooting', 'IfcStair', 'IfcMember']
  },

  USE_07_DISEÑO_ESPECIALIDADES: {
    id: 'uso_07_diseño_especialidades',
    number: 7,
    label: 'Diseño de especialidades',
    description: 'Modelos BIM por disciplina',
    tdiRequired: ['TDI_A', 'TDI_B', 'TDI_D', 'TDI_E'],
    idsPhases: ['db', 'dd'] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: 'NDI-2', dd: 'NDI-3' },
    entities: ['IfcColumn', 'IfcBeam', 'IfcSlab', 'IfcWall', 'IfcFooting']
  },

  USE_08_REVISION_DISEÑO: {
    id: 'uso_08_revision_diseño',
    number: 8,
    label: 'Revisión del diseño',
    description: 'Revisión de respuestas a requerimientos',
    tdiRequired: ['TDI_A', 'TDI_B', 'TDI_E'],
    idsPhases: ['db', 'dd'] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: 'NDI-2', dd: 'NDI-3' },
    entities: ['IfcColumn', 'IfcBeam', 'IfcSlab', 'IfcWall']
  },

  USE_09_ANALISIS_ESTRUCTURAL: {
    id: 'uso_09_analisis_estructural',
    number: 9,
    label: 'Análisis estructural',
    description: 'Comportamiento de sistemas estructurales',
    tdiRequired: ['TDI_B', 'TDI_E', 'TDI_K'],
    idsPhases: ['db', 'dd'] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: 'NDI-2', dd: 'NDI-3' },
    entities: ['IfcColumn', 'IfcBeam', 'IfcSlab', 'IfcFooting', 'IfcMember']
  },

  USE_10_ANALISIS_LUMINICO: {
    id: 'uso_10_analisis_luminico',
    number: 10,
    label: 'Análisis lumínico',
    description: 'Iluminación natural y artificial',
    tdiRequired: ['TDI_B', 'TDI_E', 'TDI_G'],
    idsPhases: ['db', 'dd'] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: 'NDI-2', dd: 'NDI-3' },
    entities: ['IfcWindow', 'IfcWall']
  },

  USE_11_ANALISIS_ENERGETICO: {
    id: 'uso_11_analisis_energetico',
    number: 11,
    label: 'Análisis energético',
    description: 'Criterios energéticos y consumo',
    tdiRequired: ['TDI_B', 'TDI_E', 'TDI_G'],
    idsPhases: ['db', 'dd'] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: 'NDI-2', dd: 'NDI-3' },
    entities: ['IfcWall', 'IfcWindow', 'IfcSlab']
  },

  USE_12_ANALISIS_MECANICO: {
    id: 'uso_12_analisis_mecanico',
    number: 12,
    label: 'Análisis mecánico',
    description: 'Sistemas mecánicos (HVAC, etc.)',
    tdiRequired: ['TDI_B', 'TDI_E'],
    idsPhases: ['db', 'dd'] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: 'NDI-2', dd: 'NDI-3' },
    entities: []
  },

  USE_13_OTROS_ANALISIS: {
    id: 'uso_13_otros_analisis',
    number: 13,
    label: 'Otros análisis de ingeniería',
    description: 'Acústico, sísmico, etc.',
    tdiRequired: ['TDI_B', 'TDI_E'],
    idsPhases: ['db', 'dd'] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: 'NDI-2', dd: 'NDI-3' },
    entities: []
  },

  USE_14_SUSTENTABILIDAD: {
    id: 'uso_14_sustentabilidad',
    number: 14,
    label: 'Evaluación de sustentabilidad',
    description: 'Criterios de sustentabilidad',
    tdiRequired: ['TDI_B', 'TDI_E', 'TDI_H'],
    idsPhases: ['db', 'dd'] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: 'NDI-2', dd: 'NDI-3' },
    entities: ['IfcWall', 'IfcWindow', 'IfcSlab']
  },

  USE_15_VALIDACION_NORMATIVA: {
    id: 'uso_15_validacion_normativa',
    number: 15,
    label: 'Validación normativa',
    description: 'Cumplimiento OGUC, NCh, etc.',
    tdiRequired: ['TDI_K', 'TDI_E'],
    idsPhases: ['db', 'dd'] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: 'NDI-2', dd: 'NDI-3' },
    entities: ['IfcColumn', 'IfcBeam', 'IfcSlab', 'IfcWall', 'IfcFooting', 'IfcStair']
  },

  // ═══════════════════════════════════════════════════════════════
  // CONSTRUCCIÓN (Usos 16-19) - NO APLICA A IDS BUILDER
  // ═══════════════════════════════════════════════════════════════

  USE_16_PLANIFICACION_OBRA: {
    id: 'uso_16_planificacion_obra',
    number: 16,
    label: 'Planificación de obra',
    description: 'Planificación gráfica de actividades',
    tdiRequired: ['TDI_B', 'TDI_L', 'TDI_M', 'TDI_F'],
    idsPhases: [] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: null, dd: null },
    entities: []
  },

  USE_17_DISEÑO_SISTEMAS_CONSTRUCTIVOS: {
    id: 'uso_17_diseño_sistemas_constructivos',
    number: 17,
    label: 'Diseño de sistemas constructivos',
    description: 'Sistemas complementarios (andamios, etc.)',
    tdiRequired: ['TDI_B', 'TDI_D', 'TDI_L'],
    idsPhases: [] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: null, dd: null },
    entities: []
  },

  USE_18_FABRICACION_DIGITAL: {
    id: 'uso_18_fabricacion_digital',
    number: 18,
    label: 'Fabricación Digital',
    description: 'Información para fabricación de componentes',
    tdiRequired: ['TDI_B', 'TDI_D', 'TDI_M'],
    idsPhases: [] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: null, dd: null },
    entities: []
  },

  USE_19_CONTROL_OBRA: {
    id: 'uso_19_control_obra',
    number: 19,
    label: 'Control de obra',
    description: 'Monitoreo y optimización de construcción',
    tdiRequired: ['TDI_B', 'TDI_M', 'TDI_K'],
    idsPhases: [] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: null, dd: null },
    entities: []
  },

  // ═══════════════════════════════════════════════════════════════
  // OPERACIÓN (Usos 20-25) - NO APLICA A IDS BUILDER
  // ═══════════════════════════════════════════════════════════════

  USE_20_MODELACION_AS_BUILT: {
    id: 'uso_20_modelacion_as_built',
    number: 20,
    label: 'Modelación as-Built',
    description: 'Modelo exacto de condiciones físicas construidas',
    tdiRequired: ['TDI_B', 'TDI_D', 'TDI_M', 'TDI_O'],
    idsPhases: [] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: null, dd: null },
    entities: []
  },

  USE_21_GESTION_ACTIVOS: {
    id: 'uso_21_gestion_activos',
    number: 21,
    label: 'Gestión de activos',
    description: 'Sistema vinculado a as-built para operación',
    tdiRequired: ['TDI_B', 'TDI_D', 'TDI_N', 'TDI_O'],
    idsPhases: [] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: null, dd: null },
    entities: []
  },

  USE_22_ANALISIS_SISTEMAS: {
    id: 'uso_22_analisis_sistemas',
    number: 22,
    label: 'Análisis de sistemas',
    description: 'Desempeño de sistemas en operación',
    tdiRequired: ['TDI_B', 'TDI_E', 'TDI_G'],
    idsPhases: [] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: null, dd: null },
    entities: []
  },

  USE_23_MANTENIMIENTO_PREVENTIVO: {
    id: 'uso_23_mantenimiento_preventivo',
    number: 23,
    label: 'Mantenimiento preventivo',
    description: 'Mantención de estructura y equipamiento',
    tdiRequired: ['TDI_B', 'TDI_D', 'TDI_O'],
    idsPhases: [] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: null, dd: null },
    entities: []
  },

  USE_24_GESTION_ESPACIOS: {
    id: 'uso_24_gestion_espacios',
    number: 24,
    label: 'Gestión y seguimiento de espacios',
    description: 'Administración de espacios',
    tdiRequired: ['TDI_A', 'TDI_B', 'TDI_J'],
    idsPhases: [] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: null, dd: null },
    entities: []
  },

  USE_25_GESTION_EMERGENCIAS: {
    id: 'uso_25_gestion_emergencias',
    number: 25,
    label: 'Planificación y gestión de emergencias',
    description: 'Información crítica para emergencias',
    tdiRequired: ['TDI_B', 'TDI_C', 'TDI_K', 'TDI_N'],
    idsPhases: [] as IDSPhase[],
    ndiByPhase: { dc: null, da: null, db: null, dd: null },
    entities: []
  }
} as const;

export type BIMUseKey = keyof typeof BIM_USES_COMPLETE;

/**
 * TIPOS DE INFORMACIÓN (TDI) - 15 categorías
 */
export const TDI_DEFINITIONS = {
  TDI_A: {
    id: 'TDI_A',
    label: 'Información general del proyecto',
    description: 'Identificación: tipo edificio, nombre, dirección'
  },
  TDI_B: {
    id: 'TDI_B',
    label: 'Propiedades físicas y geométricas',
    description: 'Ancho, largo, alto, área, volumen, masa'
  },
  TDI_C: {
    id: 'TDI_C',
    label: 'Propiedades geográficas y de localización',
    description: 'Georreferencia, piso, espacios/zonas'
  },
  TDI_D: {
    id: 'TDI_D',
    label: 'Requerimientos para fabricante/constructor',
    description: 'Tipo elemento, materialidad, componentes'
  },
  TDI_E: {
    id: 'TDI_E',
    label: 'Especificaciones técnicas',
    description: 'Peso, ruido, performance equipos'
  },
  TDI_F: {
    id: 'TDI_F',
    label: 'Requerimientos y estimación de costos',
    description: 'Costo unitario, ensamblaje, transporte'
  },
  TDI_G: {
    id: 'TDI_G',
    label: 'Requerimientos energéticos',
    description: 'Humedad, valor U, consumo servicios'
  },
  TDI_H: {
    id: 'TDI_H',
    label: 'Estándar sostenible',
    description: 'Calidad iluminación, materiales sustentables'
  },
  TDI_I: {
    id: 'TDI_I',
    label: 'Condiciones del sitio y medioambientales',
    description: 'Condiciones sísmicas, uso suelo'
  },
  TDI_J: {
    id: 'TDI_J',
    label: 'Validación de cumplimiento de programa',
    description: 'Áreas, requisitos, volumetría'
  },
  TDI_K: {
    id: 'TDI_K',
    label: 'Cumplimiento normativo',
    description: 'OGUC/NCh: fuego, ventilación, accesos, carga ocupación'
  },
  TDI_L: {
    id: 'TDI_L',
    label: 'Requerimientos de fases, secuencia y calendarización',
    description: 'Fases, hitos, orden construcción'
  },
  TDI_M: {
    id: 'TDI_M',
    label: 'Logística y secuencia de construcción',
    description: 'ID material, instalación, número serie'
  },
  TDI_N: {
    id: 'TDI_N',
    label: 'Entrega para la operación',
    description: 'Empresas, contactos, disciplinas'
  },
  TDI_O: {
    id: 'TDI_O',
    label: 'Gestión de activos',
    description: 'Productos, repuestos, garantías'
  }
} as const;

/**
 * HELPERS - Funciones de utilidad
 */

export function getTDIForUse(useKey: BIMUseKey): readonly string[] {
  return BIM_USES_COMPLETE[useKey].tdiRequired;
}

export function deriveTDIFromUses(selectedUseKeys: BIMUseKey[]): Set<string> {
  const allTDI = new Set<string>();
  selectedUseKeys.forEach(useKey => {
    getTDIForUse(useKey).forEach(tdi => allTDI.add(tdi));
  });
  return allTDI;
}

export function formatTDIList(tdiSet: Set<string>): string {
  return Array.from(tdiSet)
    .sort()
    .map(tdi => `${tdi} - ${TDI_DEFINITIONS[tdi as keyof typeof TDI_DEFINITIONS].label}`)
    .join('\n');
}

export const ALL_BIM_USES = Object.values(BIM_USES_COMPLETE).sort((a, b) => a.number - b.number);

/**
 * Obtener usos que aplican a una fase IDS específica
 */
export function getUsesByIDSPhase(phase: IDSPhase): typeof ALL_BIM_USES {
  return ALL_BIM_USES.filter(u => u.idsPhases.includes(phase));
}

/**
 * Obtener entidades que aplican a una fase IDS específica (METADATA SOLAMENTE)
 */
export function getEntitiesForPhase(phase: IDSPhase): Set<string> {
  const uses = getUsesByIDSPhase(phase);
  const entities = new Set<string>();
  uses.forEach(use => {
    use.entities.forEach(entity => entities.add(entity));
  });
  return entities;
}
