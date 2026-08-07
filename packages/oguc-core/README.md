# oguc-core — Motor de Cumplimiento OGUC

Package de dominio puro (sin React, sin DOM, sin `@thatopen/*`) que
evalúa datos de un modelo IFC contra un subconjunto de la Ordenanza
General de Urbanismo y Construcciones (OGUC) de Chile, y genera hallazgos
de cumplimiento (*findings*) consumibles por `apps/viewer-oguc`.

No parsea archivos IFC — recibe un `IfcHeadlessDocument` ya construido por
`@bw-central/ifc-headless` (su única dependencia de workspace) y trabaja
sobre esa estructura de datos.

## Qué hace

A partir de un `IfcHeadlessDocument`:

- **`runPreCheck(doc)`** — valida la calidad de los datos del modelo antes
  de habilitar una revisión (¿tiene `IfcSpace`? ¿tiene áreas/alturas
  declaradas en 0? ¿hay boundaries autoritativos o inferidos
  geométricamente? etc.). Devuelve hallazgos en tres niveles:
  `blocking` / `warnings` / `info`.
- **`generateFindings`** (en `apps/viewer-oguc`, no en este package —
  ver más abajo) — corre las reglas de cumplimiento propiamente tales y
  arma el arreglo de `Finding[]` que se muestra en la tabla de hallazgos
  de `/revision`.

## Reglas implementadas actualmente

- **Art. 4.2.4 — Clasificación de carga de ocupación**
  (`calculateOccupancyLoad`): intenta hacer *match* del nombre/tipo de
  cada `IfcSpace` con una categoría de destino OGUC (tabla en
  `dictionary/occupancyLoad.ts`) y calcula la carga de ocupación a partir
  del área declarada. Un espacio sin match, sin área utilizable o cuya
  unidad no se puede resolver queda marcado como hallazgo.
- **Art. 4.2.10 — Validación de escaleras**
  (`determineStairRequirement` + `evaluateStairCompliance`): determina si
  el edificio requiere escaleras de evacuación según su cantidad de pisos
  y, si las requiere, evalúa si la cantidad/ancho de escaleras declaradas
  alcanza según la carga de ocupación total, contra la tabla en
  `rules/art4210StairsTable.ts`.

No hay más reglas que estas dos implementadas hoy. El resto del código
del package (`evaluateEvacuationRoutes`, `accessibleAlternatives`,
`stairValidation`, etc.) son evaluaciones auxiliares/parciales sobre datos
de evacuación y accesibilidad, usadas por las dos reglas de arriba o por
sus tests — no constituyen reglas de cumplimiento completas por sí
mismas todavía.

## Estructuras de datos principales

- **`Finding`** (`src/types/finding.ts`): un hallazgo individual —
  `ruleId` (`"occupancy" | "stairs"`), `severity`
  (`"error" | "warning" | "info"`), `elementId`/`modelId` (para ubicar el
  elemento en el visor 3D), `state` (`"pending" | "accepted" | "rejected"`),
  nota de usuario opcional. El `id` se deriva de forma determinista
  (`ruleId:modelId:elementId`), no al azar, para que sea estable entre
  ejecuciones del mismo modelo.
- **`BwrevFile`** (`src/types/bwrev.ts`): el formato de archivo `.bwrev`
  — versión, timestamps de creación/modificación, modelos revisados (con
  hash SHA-256), resultado de Pre-Check, `Finding[]`, estado de la
  revisión. Incluye `isValidBwrevFile`, un validador estructural que
  nunca lanza excepción.
- **`PreCheckResult`** (`src/precheck.ts`): resultado de `runPreCheck` —
  `{ blocking, warnings, info }`, cada uno un arreglo de `PreCheckIssue`.

## Cómo ejecutar tests

```bash
cd packages/oguc-core
pnpm test           # Vitest, corre todos los *.spec.ts en src/__tests__
pnpm type-check      # tsc --noEmit
```

Los tests corren tanto contra fixtures IFC reales (ver más abajo) como
contra datos sintéticos armados a mano para casos borde específicos.

## Cómo agregar una nueva regla (paso a paso realista)

1. **Confirmar qué datos expone `ifc-headless` para lo que se necesita
   evaluar.** Si el dato no está en `IfcHeadlessDocument`
   (`@bw-central/ifc-headless`), la regla no se puede implementar sin
   primero extender ese package — no inventar el dato acá.
2. Si la regla necesita una tabla/constante de la OGUC, transcribirla
   literal en `src/dictionary/` (ver `dictionary/occupancyLoad.ts` o
   `dictionary/stairs.ts` como referencia), con la cita del artículo en
   un comentario.
3. Implementar la función de evaluación en `src/engine/` — recibe datos
   ya leídos (del `IfcHeadlessDocument` o ya agregados por otra función
   de este mismo package), nunca hace I/O ni conoce nada de React/3D.
4. Exportar la función y sus tipos desde `src/index.ts`.
5. Escribir tests en `src/__tests__/`, idealmente contra al menos un
   fixture real (ver `packages/oguc-core/fixtures/`) además de casos
   sintéticos para los bordes (dato ausente, cero, mal formado).
6. Mapear el resultado a `Finding[]` en
   `apps/viewer-oguc/src/routes/revision/generateFindings.ts` — esa
   función vive en la app, no acá, porque necesita `modelId` (un
   concepto de federación que este package no conoce) y decide
   severidad/título/descripción en español para la UI.

## Limitaciones conocidas

- **La clasificación de destinos/ocupaciones es todavía básica.** El
  *match* de destino (`matchDestino`) es por coincidencia de texto sobre
  el nombre/tipo declarado del espacio — no hay una capa de clasificación
  asistida (por ejemplo, con ayuda de un modelo o reglas más sofisticadas
  de inferencia) todavía. Un espacio con un nombre no convencional
  (ej. en otro idioma, o un código interno de oficina de arquitectura)
  queda sin clasificar aunque un revisor humano lo hubiera identificado
  sin problema.
- **Las escaleras se evalúan a nivel de edificio, no por tramo de
  pisos.** `evaluateStairCompliance` da un único veredicto para todo el
  edificio (cantidad de pisos + carga de ocupación total + cantidad de
  escaleras detectadas) — no hay una función que evalúe "¿el tramo entre
  el piso 3 y el piso 4 tiene escaleras que cumplen?" de forma
  independiente. Esto es una limitación real del motor, no solo de la UI
  que lo consume.
- **No existe todavía la capa de clasificación asistida ni el cuadro de
  superficies** que son, hoy, el núcleo de valor pendiente del producto
  (ver `ARCHITECTURE.md` en la raíz del repo para el roadmap).
- **Depende completamente de la calidad del modelo IFC de entrada.** Si
  el modelo no declara `IfcSpace`, no tiene `IfcBuildingStorey`
  resueltos, o sus cantidades/unidades no son estándar, el motor no
  fabrica un resultado — reporta la ausencia de dato (ver `runPreCheck`)
  en vez de adivinar. Esto es una decisión de diseño deliberada (ver
  "Principios de diseño" en `ARCHITECTURE.md`), pero en la práctica
  significa que modelos de baja calidad producen revisiones con poca
  información útil.

## Fixtures de prueba existentes

En `packages/oguc-core/fixtures/`:

- `CASA-ARQ.ifc` — modelo residencial completo (export estilo Revit,
  espacios y escaleras reales).
- `CASA-MEP.ifc` — mismo proyecto, disciplina MEP.
- `EOFF-ARQ-IFC-I01.ifc` / `EOFF-SPC-IFC-I01.ifc` — modelo de oficinas.
- `OLAS-ARQ-05.ifc` — export estilo ArchiCAD, sin `IfcSpace`, con
  escaleras representadas como múltiples `IfcStair` sin `IfcStairFlight`
  (fixture útil para casos borde de detección de fragmentación).

---

Last updated: 2026-08-06
