// AUTO-GENERADO desde Matriz PlanBIM V3.0 (buildingSMART / PlanBIM Chile).
// Fuente original: extract_planbim_matrix.py -> planbim_matrix_extracted.json
// (ver el proyecto ids-builder). Entidades: Columnas, Vigas, Losas,
// Fundaciones, Muros. Etapas: DC (Diseño Conceptual) y DB (Diseño Básico).
// No editar a mano: para actualizar, correr de nuevo el script de extracción
// sobre una versión más reciente del Excel, en el proyecto de origen.

export type MatrixCategory =
  | 'dimensiones'
  | 'materiales'
  | 'fuego'
  | 'resistencia'
  | 'clasificacion'
  | 'termico'
  | 'cargas'

export interface MatrixProperty {
  spanish: string
  english: string
  tdi: string
  ndi: string
  /** Nombre real del Pset en la Matriz (Qto_.../Pset_...), o null si es un atributo nativo IFC. */
  pset: string | null
  category: MatrixCategory
}

export interface MatrixStructure {
  [ifc: string]: {
    [etapa: string]: {
      [ndi: string]: MatrixProperty[]
    }
  }
}

export const planbimMatrix: MatrixStructure = {
  "IfcFooting": {
    "DC": {
      "NDI-1": [
        {
          "spanish": "Altura",
          "english": "Height",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_FootingBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Capacidad de carga",
          "english": "LoadBearing",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Pset_FootingCommon",
          "category": "cargas"
        },
        {
          "spanish": "Ancho",
          "english": "Width",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_FootingBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Area de sección transversal",
          "english": "CrossSectionArea",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_FootingBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Código de sistema de clasificación",
          "english": "Código de sistema de clasificación",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        },
        {
          "spanish": "Estado del elemento",
          "english": "Status",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Pset_FootingCommon",
          "category": "clasificacion"
        },
        {
          "spanish": "Longitud",
          "english": "Length",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_FootingBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Material",
          "english": "HasAssociations",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "materiales"
        },
        {
          "spanish": "Tipo predefinido",
          "english": "PredefinedType",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        },
        {
          "spanish": "Volumen",
          "english": "GrossVolume",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_FootingBaseQuantities",
          "category": "dimensiones"
        }
      ]
    },
    "DB": {
      "NDI-1": [
        {
          "spanish": "Nombre del tipo",
          "english": "Name",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        }
      ]
    }
  },
  "IfcWall": {
    "DC": {
      "NDI-1": [
        {
          "spanish": "Altura",
          "english": "Height",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_WallBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Resistencia al fuego",
          "english": "FireRating",
          "tdi": "TDI-K",
          "ndi": "NDI-1",
          "pset": "Pset_WallCommon",
          "category": "fuego"
        },
        {
          "spanish": "De uso en exterior",
          "english": "IsExternal",
          "tdi": "TDI-C",
          "ndi": "NDI-1",
          "pset": "Pset_WallCommon",
          "category": "clasificacion"
        },
        {
          "spanish": "Área de base",
          "english": "GrossFootprintArea",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_WallBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Capacidad de carga",
          "english": "LoadBearing",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Pset_WallCommon",
          "category": "cargas"
        },
        {
          "spanish": "Ancho",
          "english": "Width",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_WallBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Área lateral",
          "english": "GrossSideArea",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_WallBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Código de sistema de clasificación",
          "english": "Código de sistema de clasificación",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        },
        {
          "spanish": "Valor U",
          "english": "ThermalTransmittance",
          "tdi": "TDI-G",
          "ndi": "NDI-1",
          "pset": "Pset_WallCommon",
          "category": "termico"
        },
        {
          "spanish": "Estado del elemento",
          "english": "Status",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Pset_WallCommon",
          "category": "clasificacion"
        },
        {
          "spanish": "Longitud",
          "english": "Length",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_WallBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Material",
          "english": "HasAssociations",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "materiales"
        },
        {
          "spanish": "Tipo predefinido",
          "english": "PredefinedType",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        },
        {
          "spanish": "Volumen",
          "english": "GrossVolume",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_WallBaseQuantities",
          "category": "dimensiones"
        }
      ]
    },
    "DB": {
      "NDI-1": [
        {
          "spanish": "Nombre del tipo",
          "english": "Name",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        }
      ]
    }
  },
  "IfcSlab": {
    "DC": {
      "NDI-1": [
        {
          "spanish": "Resistencia al fuego",
          "english": "FireRating",
          "tdi": "TDI-K",
          "ndi": "NDI-1",
          "pset": "Pset_SlabCommon",
          "category": "fuego"
        },
        {
          "spanish": "De uso en exterior",
          "english": "IsExternal",
          "tdi": "TDI-C",
          "ndi": "NDI-1",
          "pset": "Pset_SlabCommon",
          "category": "clasificacion"
        },
        {
          "spanish": "Área",
          "english": "GrossArea",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_SlabBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Capacidad de carga",
          "english": "LoadBearing",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Pset_SlabCommon",
          "category": "cargas"
        },
        {
          "spanish": "Ancho",
          "english": "Width",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_SlabBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Código de sistema de clasificación",
          "english": "Código de sistema de clasificación",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        },
        {
          "spanish": "Valor U",
          "english": "ThermalTransmittance",
          "tdi": "TDI-G",
          "ndi": "NDI-1",
          "pset": "Pset_SlabCommon",
          "category": "termico"
        },
        {
          "spanish": "Espesor",
          "english": "Depth",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_SlabBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Espesor prefabricado",
          "english": "NominalThickness",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Pset_PrecastSlab",
          "category": "clasificacion"
        },
        {
          "spanish": "Estado del elemento",
          "english": "Status",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Pset_SlabCommon",
          "category": "clasificacion"
        },
        {
          "spanish": "Material",
          "english": "HasAssociations",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "materiales"
        },
        {
          "spanish": "Perímetro",
          "english": "Perimeter",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_SlabBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Tipo predefinido",
          "english": "PredefinedType",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        },
        {
          "spanish": "Volumen",
          "english": "GrossVolume",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_SlabBaseQuantities",
          "category": "dimensiones"
        }
      ]
    },
    "DB": {
      "NDI-2": [
        {
          "spanish": "Inclinación",
          "english": "PitchAngle",
          "tdi": "TDI-B",
          "ndi": "NDI-2",
          "pset": "Pset_SlabCommon",
          "category": "dimensiones"
        }
      ],
      "NDI-1": [
        {
          "spanish": "Nombre del tipo",
          "english": "Name",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        }
      ]
    }
  },
  "IfcColumn": {
    "DC": {
      "NDI-1": [
        {
          "spanish": "Resistencia al fuego",
          "english": "FireRating",
          "tdi": "TDI-K",
          "ndi": "NDI-1",
          "pset": "Pset_ColumnCommon",
          "category": "fuego"
        },
        {
          "spanish": "De uso en exterior",
          "english": "IsExternal",
          "tdi": "TDI-C",
          "ndi": "NDI-1",
          "pset": "Pset_ColumnCommon",
          "category": "clasificacion"
        },
        {
          "spanish": "Capacidad de carga",
          "english": "LoadBearing",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Pset_ColumnCommon",
          "category": "cargas"
        },
        {
          "spanish": "Area de sección transversal",
          "english": "CrossSectionArea",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_ColumnBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Área de superficie externa",
          "english": "OuterSurfaceArea",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_ColumnBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Código de sistema de clasificación",
          "english": "Código de sistema de clasificación",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        },
        {
          "spanish": "Valor U",
          "english": "ThermalTransmittance",
          "tdi": "TDI-G",
          "ndi": "NDI-1",
          "pset": "Pset_ColumnCommon",
          "category": "termico"
        },
        {
          "spanish": "Estado del elemento",
          "english": "Status",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Pset_ColumnCommon",
          "category": "clasificacion"
        },
        {
          "spanish": "Longitud",
          "english": "Length",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_ColumnBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Material",
          "english": "HasAssociations",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "materiales"
        },
        {
          "spanish": "Tipo predefinido",
          "english": "PredefinedType",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        },
        {
          "spanish": "Volumen",
          "english": "GrossVolume",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_ColumnBaseQuantities",
          "category": "dimensiones"
        }
      ]
    },
    "DB": {
      "NDI-2": [
        {
          "spanish": "Inclinación",
          "english": "Slope",
          "tdi": "TDI-B",
          "ndi": "NDI-2",
          "pset": "Pset_ColumnCommon",
          "category": "dimensiones"
        }
      ],
      "NDI-1": [
        {
          "spanish": "Nombre del tipo",
          "english": "Name",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        }
      ]
    }
  },
  "IfcBeam": {
    "DC": {
      "NDI-1": [
        {
          "spanish": "Resistencia al fuego",
          "english": "FireRating",
          "tdi": "TDI-K",
          "ndi": "NDI-1",
          "pset": "Pset_BeamCommon",
          "category": "fuego"
        },
        {
          "spanish": "De uso en exterior",
          "english": "IsExternal",
          "tdi": "TDI-C",
          "ndi": "NDI-1",
          "pset": "Pset_BeamCommon",
          "category": "clasificacion"
        },
        {
          "spanish": "Capacidad de carga",
          "english": "LoadBearing",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Pset_BeamCommon",
          "category": "cargas"
        },
        {
          "spanish": "Área",
          "english": "GrossSurfaceArea",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_BeamBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Area de sección transversal",
          "english": "CrossSectionArea",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_BeamBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Área de superficie externa",
          "english": "OuterSurfaceArea",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_BeamBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Código de sistema de clasificación",
          "english": "Código de sistema de clasificación",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        },
        {
          "spanish": "Valor U",
          "english": "ThermalTransmittance",
          "tdi": "TDI-G",
          "ndi": "NDI-1",
          "pset": "Pset_BeamCommon",
          "category": "termico"
        },
        {
          "spanish": "Estado del elemento",
          "english": "Status",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Pset_BeamCommon",
          "category": "clasificacion"
        },
        {
          "spanish": "Longitud",
          "english": "Length",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_BeamBaseQuantities",
          "category": "dimensiones"
        },
        {
          "spanish": "Material",
          "english": "HasAssociations",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "materiales"
        },
        {
          "spanish": "Tipo predefinido",
          "english": "PredefinedType",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        },
        {
          "spanish": "Volumen",
          "english": "GrossVolume",
          "tdi": "TDI-B",
          "ndi": "NDI-1",
          "pset": "Qto_BeamBaseQuantities",
          "category": "dimensiones"
        }
      ]
    },
    "DB": {
      "NDI-2": [
        {
          "spanish": "Inclinación",
          "english": "Slope",
          "tdi": "TDI-B",
          "ndi": "NDI-2",
          "pset": "Pset_BeamCommon",
          "category": "dimensiones"
        }
      ],
      "NDI-1": [
        {
          "spanish": "Nombre del tipo",
          "english": "Name",
          "tdi": "TDI-D",
          "ndi": "NDI-1",
          "pset": null,
          "category": "clasificacion"
        }
      ]
    }
  }
}

export function getPropertiesByEtapaAndNDI(ifc: string, etapa: string, ndi: string): MatrixProperty[] {
  if (planbimMatrix[ifc] && planbimMatrix[ifc][etapa] && planbimMatrix[ifc][etapa][ndi]) {
    return planbimMatrix[ifc][etapa][ndi]
  }
  return []
}

export function getEntitiesForEtapa(etapa: string): string[] {
  const entities = new Set<string>()
  for (const ifc in planbimMatrix) {
    if (planbimMatrix[ifc][etapa]) {
      entities.add(ifc)
    }
  }
  return Array.from(entities)
}

export function getPropertiesByEtapa(ifc: string, etapa: string): MatrixProperty[] {
  const allProps: MatrixProperty[] = []
  if (planbimMatrix[ifc] && planbimMatrix[ifc][etapa]) {
    const ndiMap = planbimMatrix[ifc][etapa]
    for (const ndi in ndiMap) {
      allProps.push(...ndiMap[ndi])
    }
  }
  return allProps
}

