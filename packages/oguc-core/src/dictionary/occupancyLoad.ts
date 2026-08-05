// Art. 4.2.4 OGUC (vigente, abril 2024) - Tabla de Carga de Ocupación,
// transcribed verbatim by the domain expert. This is the ONLY place these
// numbers live in this package - no engine file may contain a bare
// m2/persona value. Every entry below carries the exact category/row
// wording from the article so results stay traceable back to it.
//
// This package does not decide what a "recinto habitable" is or judge
// compliance - it looks numbers up and reports what it found, including
// when nothing was found.

export type ArticuloRef =
  | "4.2.4"
  | "4.2.5"
  | "4.2.6"
  | "4.2.8"
  | "4.2.9"
  | "4.2.10"
  | "4.2.11"
  | "4.2.12"
  | "4.2.13"
  | "4.2.14"
  | "4.2.15";

/** One row of the Art. 4.2.4 table, keyed by a dot-id used only inside this package (not part of the regulation itself - `label` is the actual regulation text). */
export interface OccupancyFactorEntry {
  destino: string;
  categoria: string;
  label: string;
  articulo: "4.2.4";
  m2PorPersona: number;
  /**
   * True only for the three "Vivienda" rows: their m2/persona tier
   * depends on the TOTAL área útil of the dwelling unit, not on any
   * single room/space within it. ifc-headless has no concept of
   * "dwelling unit" grouping spaces together, so this package cannot
   * resolve which tier applies from a single IfcSpace - see
   * calculateOccupancyLoad's "requires-manual-tier" status.
   */
  requiresUnitLevelArea?: boolean;
}

export const OCCUPANCY_LOAD_TABLE: OccupancyFactorEntry[] = [
  { destino: "vivienda.hasta_60m2", categoria: "Vivienda (superficie útil)", label: "Unidades de hasta 60 m2", articulo: "4.2.4", m2PorPersona: 15.0, requiresUnitLevelArea: true },
  { destino: "vivienda.60_a_140m2", categoria: "Vivienda (superficie útil)", label: "Unidades de más de 60 m2 hasta 140 m2", articulo: "4.2.4", m2PorPersona: 20.0, requiresUnitLevelArea: true },
  { destino: "vivienda.mas_140m2", categoria: "Vivienda (superficie útil)", label: "Unidades de más de 140 m2", articulo: "4.2.4", m2PorPersona: 30.0, requiresUnitLevelArea: true },

  { destino: "oficinas", categoria: "Oficinas (superficie útil)", label: "Oficinas (superficie útil)", articulo: "4.2.4", m2PorPersona: 10.0 },

  { destino: "comercio.salasVenta.niveles_neg1_1_2", categoria: "Comercio (locales en general)", label: "Salas de venta niveles -1, 1 y 2", articulo: "4.2.4", m2PorPersona: 3.0 },
  { destino: "comercio.salasVenta.otrosPisos", categoria: "Comercio (locales en general)", label: "Salas de venta en otros pisos", articulo: "4.2.4", m2PorPersona: 5.0 },
  { destino: "comercio.supermercados.areaPublico", categoria: "Comercio (locales en general)", label: "Supermercados (área de público)", articulo: "4.2.4", m2PorPersona: 3.0 },
  { destino: "comercio.supermercados.trastienda", categoria: "Comercio (locales en general)", label: "Supermercados (trastienda)", articulo: "4.2.4", m2PorPersona: 15.0 },
  { destino: "comercio.mercadosFerias.areaPublico", categoria: "Comercio (locales en general)", label: "Mercados y Ferias (área de público)", articulo: "4.2.4", m2PorPersona: 1.0 },
  { destino: "comercio.mercadosFerias.puestosVenta", categoria: "Comercio (locales en general)", label: "Mercados y Ferias (puestos de venta)", articulo: "4.2.4", m2PorPersona: 4.0 },

  { destino: "comercioMalls.localesAccesoExterior", categoria: "Comercio (Malls)", label: "Locales comerciales, en niveles con acceso exterior", articulo: "4.2.4", m2PorPersona: 10.0 },
  { destino: "comercioMalls.pasillosAccesoExterior", categoria: "Comercio (Malls)", label: "Pasillos entre locales, en niveles con acceso exterior", articulo: "4.2.4", m2PorPersona: 5.0 },
  { destino: "comercioMalls.localesOtrosNiveles", categoria: "Comercio (Malls)", label: "Locales comerciales, otros niveles", articulo: "4.2.4", m2PorPersona: 14.0 },
  { destino: "comercioMalls.pasillosOtrosNiveles", categoria: "Comercio (Malls)", label: "Pasillos entre locales, otros niveles", articulo: "4.2.4", m2PorPersona: 7.0 },
  { destino: "comercioMalls.patiosComida", categoria: "Comercio (Malls)", label: "Patios de comida y otras áreas comunes con mesas", articulo: "4.2.4", m2PorPersona: 1.0 },

  { destino: "educacion.salonesAuditorios", categoria: "Educación", label: "Salones, auditorios", articulo: "4.2.4", m2PorPersona: 0.5 },
  { destino: "educacion.salasUsoMultipleCasino", categoria: "Educación", label: "Salas de uso múltiple, casino", articulo: "4.2.4", m2PorPersona: 1.0 },
  { destino: "educacion.salasClase", categoria: "Educación", label: "Salas de clase", articulo: "4.2.4", m2PorPersona: 1.5 },
  { destino: "educacion.camarinesGimnasios", categoria: "Educación", label: "Camarines, gimnasios", articulo: "4.2.4", m2PorPersona: 4.0 },
  { destino: "educacion.talleresLaboratoriosBibliotecas", categoria: "Educación", label: "Talleres, Laboratorios, Bibliotecas", articulo: "4.2.4", m2PorPersona: 5.0 },
  { destino: "educacion.oficinasAdministrativas", categoria: "Educación", label: "Oficinas administrativas", articulo: "4.2.4", m2PorPersona: 7.0 },
  { destino: "educacion.cocina", categoria: "Educación", label: "Cocina", articulo: "4.2.4", m2PorPersona: 15.0 },

  { destino: "salud.hospitalesClinicas.serviciosAmbulatoriosDiagnostico", categoria: "Salud (Hospitales y Clínicas)", label: "Areas de servicios ambulatorios y diagnóstico", articulo: "4.2.4", m2PorPersona: 6.0 },
  { destino: "salud.hospitalesClinicas.sectorHabitaciones", categoria: "Salud (Hospitales y Clínicas)", label: "Sector de habitaciones (superficie total)", articulo: "4.2.4", m2PorPersona: 8.0 },
  { destino: "salud.hospitalesClinicas.oficinasAdministrativas", categoria: "Salud (Hospitales y Clínicas)", label: "Oficinas administrativas", articulo: "4.2.4", m2PorPersona: 10.0 },
  { destino: "salud.hospitalesClinicas.tratamientoPacientesInternos", categoria: "Salud (Hospitales y Clínicas)", label: "Areas de tratamiento a pacientes internos", articulo: "4.2.4", m2PorPersona: 20.0 },

  { destino: "salud.consultorios.salasEspera", categoria: "Salud (Consultorios, Policlínicos)", label: "Salas de espera", articulo: "4.2.4", m2PorPersona: 0.8 },
  { destino: "salud.consultorios.consultas", categoria: "Salud (Consultorios, Policlínicos)", label: "Consultas", articulo: "4.2.4", m2PorPersona: 3.0 },

  { destino: "otros.espectaculosPie", categoria: "Otros", label: "Recintos de espectáculos (área para espectadores de pié)", articulo: "4.2.4", m2PorPersona: 0.25 },
  { destino: "otros.capillasDiscotecas", categoria: "Otros", label: "Capillas, Discotecas", articulo: "4.2.4", m2PorPersona: 0.5 },
  { destino: "otros.salonesReuniones", categoria: "Otros", label: "Salones de reuniones", articulo: "4.2.4", m2PorPersona: 0.8 },
  { destino: "otros.publicoBaresCafeteriasPubs", categoria: "Otros", label: "Area para público en bares, cafeterías, pubs", articulo: "4.2.4", m2PorPersona: 1.0 },
  { destino: "otros.restaurantesSalonesJuego", categoria: "Otros", label: "Restaurantes (comedores), salones de juego", articulo: "4.2.4", m2PorPersona: 1.5 },
  { destino: "otros.salasExposicion", categoria: "Otros", label: "Salas de exposición", articulo: "4.2.4", m2PorPersona: 3.0 },
  { destino: "otros.hogaresNinos", categoria: "Otros", label: "Hogares de niños", articulo: "4.2.4", m2PorPersona: 3.0 },
  { destino: "otros.gimnasiosAcademiasDanza", categoria: "Otros", label: "Gimnasios, Academias de danza", articulo: "4.2.4", m2PorPersona: 4.0 },
  { destino: "otros.hogaresAncianos", categoria: "Otros", label: "Hogares de ancianos", articulo: "4.2.4", m2PorPersona: 6.0 },
  { destino: "otros.estacionamientos", categoria: "Otros", label: "Estacionamientos de uso común o públicos (superficie total)", articulo: "4.2.4", m2PorPersona: 16.0 },
  { destino: "otros.hoteles", categoria: "Otros", label: "Hoteles (superficie total)", articulo: "4.2.4", m2PorPersona: 18.0 },
  { destino: "otros.bodegasArchivos", categoria: "Otros", label: "Bodegas, Archivos", articulo: "4.2.4", m2PorPersona: 40.0 },
];

/**
 * Rules stated in Art. 4.2.4's body text rather than the table itself -
 * still the regulation, encoded as explicit, evaluable data rather than
 * left as a comment, per the task's own instruction.
 */
export interface FixedSeatsRule {
  kind: "fixedSeats";
  articulo: "4.2.4";
  detail: string;
}

export interface LengthPerPersonRule {
  kind: "lengthPerPerson";
  articulo: "4.2.4";
  metersPorPersona: number;
  detail: string;
}

export const FIXED_SEATS_RULE: FixedSeatsRule = {
  kind: "fixedSeats",
  articulo: "4.2.4",
  detail: "Locales con asientos fijos: la carga de ocupación es el número de asientos, no área/factor.",
};

export const CONTINUOUS_BENCH_ROW_RULE: LengthPerPersonRule = {
  kind: "lengthPerPerson",
  articulo: "4.2.4",
  metersPorPersona: 0.45,
  detail: "Aposentadurías corridas: 0,45 m por persona.",
};

/** Art. 4.2.10: above this many people, stair count/layout requires an Estudio de Evacuación - this package cannot determine it, only flag the threshold. See dictionary/stairs.ts. */
export const ESTUDIO_EVACUACION_THRESHOLD_PERSONS = 1000;
