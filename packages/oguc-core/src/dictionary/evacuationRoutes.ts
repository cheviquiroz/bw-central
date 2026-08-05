// Constants and rules from Art. 4.2.5, 4.2.6, 4.2.8, 4.2.9, 4.2.11-4.2.15
// OGUC, transcribed verbatim by the domain expert. Article 4.3.3/4.3.4
// (fire resistance) is out of scope for this task - see
// ELEMENTS_REQUIRING_FIRE_RESISTANCE_CHECK below for the one place that
// dependency is flagged without being implemented.

/** Art. 4.2.6: altura libre interior mínima de vías de evacuación (vertical, piso a proyección más cercana del cielo/vigas). */
export const MIN_HEIGHT_EVACUATION_ROUTE_M = 2.1;

/** Art. 4.2.6: en escaleras, se exceptúa la altura general - se exige un arco de este radio desde la nariz de las gradas. */
export const STAIR_HEADROOM_ARC_RADIUS_M = 1.8;

/** Art. 4.2.6: altura libre mínima de vanos de puertas (distinta de la altura general de vía de evacuación). */
export const MIN_HEIGHT_DOOR_M = 2.0;

/** Art. 4.2.8: estos elementos NO se consideran vías de evacuación (excepciones en 4.2.21, fuera de alcance aquí). Informativo: ifc-headless no distingue estos tipos de elemento hoy (solo Wall/Window/Door en boundingElements), así que este listado no puede aplicarse automáticamente contra su output todavía. */
export const ELEMENTS_NOT_CONSIDERED_EVACUATION_ROUTES = [
  "ascensores",
  "escaleras mecánicas",
  "rampas mecánicas",
  "pasillos móviles",
] as const;

/** Art. 4.2.9: la carga de ocupación de patios/plazoletas/atrios susceptibles de ocupación la determina el arquitecto del proyecto - no está en tabla. Este paquete la trata como un input declarado manualmente (ver ManualOccupancyOverride en engine/calculateOccupancyLoad.ts), nunca como algo que el motor calcule o adivine. */
export const EXTERNAL_AREA_OCCUPANCY_IS_DECLARED_INPUT = true;

/** Art. 4.2.11: pasamanos en tramos inclinados. */
export const HANDRAIL_HEIGHT_INCLINED_M = { min: 0.85, max: 1.05 };
/** Art. 4.2.11: pasamanos en descansos/vestíbulos. */
export const HANDRAIL_HEIGHT_LANDING_M = { min: 0.95, max: 1.05 };
/** Art. 4.2.11: huella (proyección horizontal) mínima de peldaños. */
export const STAIR_TREAD_MIN_M = 0.28;
/** Art. 4.2.11: contrahuella de peldaños, ni más ni menos que este rango. */
export const STAIR_RISER_RANGE_M = { min: 0.13, max: 0.18 };

/** Art. 4.2.12: ancho mínimo del vestíbulo/galería/pasillo donde termina una escalera interior de evacuación. */
export const STAIR_EXIT_VESTIBULE_MIN_WIDTH_M = 1.8;
/** Art. 4.2.12: distancia máxima desde la primera grada hasta el espacio exterior comunicado a vía pública. */
export const STAIR_EXIT_MAX_DISTANCE_M = 20;
/** Art. 4.2.12: excepción - hasta este valor si el espacio de acceso tiene bajo riesgo de incendio (materiales no combustibles, densidad de carga combustible <100 MJ/m2 según NCh 1916). */
export const STAIR_EXIT_MAX_DISTANCE_LOW_FIRE_RISK_M = 40;

/** Art. 4.2.13: distancia máxima desde puerta de departamento/oficina/local hasta escalera de evacuación en el mismo piso (pisos distintos al de salida), sujeto a excepción de fondo de saco en 4.2.17 (fuera de alcance aquí). */
export const SAME_FLOOR_MAX_DISTANCE_TO_STAIR_M = 40;
/** Art. 4.2.13: con rociadores automáticos avalados por Estudio de Seguridad. */
export const SAME_FLOOR_MAX_DISTANCE_TO_STAIR_SPRINKLERED_M = 60;

/** Art. 4.2.14: distancia máxima desde cualquier punto de área común hasta la escalera más cercana, en pisos de estacionamientos/bodegas/instalaciones de servicio. */
export const PARKING_MAX_DISTANCE_TO_STAIR_M = 60;
/** Art. 4.2.14: planta abierta en 50%+ de su perímetro. */
export const PARKING_MAX_DISTANCE_TO_STAIR_OPEN_PERIMETER_M = 90;
/** Art. 4.2.14: con rociadores automáticos avalados por Estudio de Seguridad, extensible hasta un tercio adicional sobre cualquiera de los dos valores anteriores. */
export const PARKING_SPRINKLERED_EXTRA_FRACTION = 1 / 3;

/** Art. 4.2.15: a partir de esta cantidad de pisos, un edificio con una sola escalera de evacuación debe terminar en terraza de evacuación. */
export const TERRACE_MIN_STOREYS = 10;
/** Art. 4.2.15: ancho libre mínimo de la terraza de evacuación. */
export const TERRACE_MIN_WIDTH_M = 3;
/** Art. 4.2.15: área mínima de la terraza, por persona, sobre la carga de ocupación del sector del edificio ubicado sobre la mitad del recorrido de evacuación de la escalera. */
export const TERRACE_MIN_AREA_M2_PER_PERSON = 0.2;

/** Art. 4.2.10: escaleras contiguas - puertas de acceso separadas por al menos esta distancia en cada piso. */
export const STAIR_DOOR_SEPARATION_MIN_M = 3;

/** Art. 4.2.10: escaleras contiguas también deben estar separadas por muros con resistencia mínima según 4.3.3 - fuera de alcance de esta tarea (resistencia al fuego), solo se deja constancia de la dependencia. */
export const STAIR_WALLS_REQUIRE_FIRE_RESISTANCE_CHECK = "4.3.3";
