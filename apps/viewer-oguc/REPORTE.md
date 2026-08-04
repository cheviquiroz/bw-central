# REPORTE.md — Auditoría técnica de BWise Viewer

Fecha: 2026-07-23
Rama auditada: `feature/engine-foundation` (up to date con origin, working tree limpio)
Alcance: solo exploración y lectura. No se hicieron cambios.

---

## Resumen ejecutivo

BWise Viewer es un visor IFC construido sobre React 19 + Three.js + `@thatopen/components` (That Open Engine) + `web-ifc`. El proyecto es pequeño (2.392 líneas en 33 archivos TS/TSX) pero tiene una arquitectura deliberadamente sobre-especificada para su tamaño: una capa `engine/` con dominio hexagonal (domain / ports / adapters / application), gate de aislamiento de dominio vía `dependency-cruiser` + `tsconfig` dedicado, ADRs en `docs/adr/`, y un harness de smoke test headless. Esta capa de dominio (federación de modelos, detección de duplicados por hash de contenido, clustering de modelos distantes) está bien escrita, comentada donde importa (invariantes no obvias, no "qué hace el código") y cubierta por 11 tests que pasan.

El problema no está en la calidad del código que existe, sino en la brecha entre lo que el repo *dice* que está terminado y lo que realmente hay. `docs/Roadmap.md` marca como completados (✓) Sprint 3 "Búsqueda de elementos", y Sprint 5 "Transparencia" y "Color" — ninguna de las tres existe en el código: no hay input de búsqueda, ni color picker, ni control de opacidad/transparencia en ningún componente. Lo único de Sprint 5 real es Mostrar/Ocultar (`setModelVisibility` vía `OBC.Hider`) y Aislar (`ViewerActionsAdapter.toggleIsolate`). Section Box tampoco existe ni como botón. Esto es relevante porque si alguien planifica v1.0 confiando en el roadmap, va a descubrir el gap tarde.

Fuera de la capa `engine/`, hay tres archivos muertos que deberían eliminarse (`core/Viewer.ts` — demo de cubo giratorio con `alert()`, `core/World.ts` — vacío, `viewer/ViewerState.ts` — pub/sub reemplazado por `createApplication` y sin importadores). El resto del stack — carga real de IFC, árbol espacial real vía `getSpatialStructure()`, selección real vía `Highlighter` + raycasting, Properties Panel con datos reales de `getItemsData()` — es funcional de verdad, no mockeado ni hardcodeado. No hay gestor de estado externo (Zustand/Redux); el patrón es Context + pub/sub manual dentro de `createApplication()`, consistente y sin sobre-ingeniería visible ahí.

---

## Tabla: Features (implementada / demo / vacío)

| Feature | Estado | Evidencia |
|---|---|---|
| Carga de IFC (`.ifc` real, multi-archivo) | ✅ Implementada | `ModelUploader.tsx` → `application.importNewModel` → `registerModel.ts` → `IfcLoaderAdapter.load` con progreso real por fracción |
| Deduplicación por contenido (hash SHA-256) | ✅ Implementada | `registerModel.ts:30-58`, `registerModelInFederation.ts` |
| Árbol jerárquico IFC (Proyecto→Sitio→Edificio→Piso→Elemento) | ✅ Implementada, datos reales | `SpatialTreeManager.ts` usa `model.getSpatialStructure()` + `getItemsData()`, no hardcodeado |
| Selección 3D (click, multi-select con Shift) | ✅ Implementada | `SelectionManager.ts` vía `OBF.Highlighter` + raycasting real |
| Sincronización árbol ↔ selección 3D (bidireccional) | ✅ Implementada | `ModelTree.tsx` (`findPathToLocalId`, auto-expand) + `requestSelectByLocalId` |
| Properties Panel (Atributos / Psets / Tipo) | ✅ Implementada, datos reales | `PropertiesPanel.tsx` consume `getItemsData()` con relaciones `IsDefinedBy`, no hay datos demo/REGISTRY |
| Mostrar/Ocultar modelo | ✅ Implementada | `ThatOpenModelLoaderAdapter.setModelVisibility` vía `OBC.Hider` (con comentario explicando por qué no usa `object.visible`) |
| Eliminar modelo (unload) | ✅ Implementada | `unloadModel` en `createApplication.ts`, limpia árbol/selección/nombre/federación |
| Aislar selección | ✅ Implementada | `ViewerActionsAdapter.toggleIsolate` vía `OBC.Hider.isolate` |
| Detección de modelos federados mal ubicados (proximidad) | ✅ Implementada | `ProximityManager.ts` + `detectDistantModels.ts` (con test unitario) |
| Encuadre de cámara (fit to loaded models) | ✅ Implementada | `fitCameraToAllLoadedModels()` en `IfcBootstrap.ts`, automático y manual (botón) |
| **Transparencia / X-Ray** | ❌ Vacío | Ninguna referencia en código; marcado ✓ en `docs/Roadmap.md` Sprint 5 — **discrepancia** |
| **Color de elementos** | ❌ Vacío | Ninguna referencia en código; marcado ✓ en Roadmap Sprint 5 — **discrepancia** |
| **Búsqueda de elementos** | ❌ Vacío | Ninguna referencia en código; marcado ✓ en Roadmap Sprint 3 — **discrepancia** |
| **Section Box** | ❌ Vacío | No mencionado ni en código ni como pendiente explícito en Roadmap |
| `core/Viewer.ts` (viewer standalone Three.js) | 🪦 Muerto | Sin importadores; contiene `alert("Viewer nuevo")` y un demo cubo |
| `core/World.ts` | 🪦 Muerto | Archivo vacío |
| `viewer/ViewerState.ts` | 🪦 Muerto | Sin importadores fuera de sí mismo; superseded por `createApplication` |

---

## Tabla: Tech stack

| Paquete | Versión | Notas |
|---|---|---|
| react / react-dom | ^19.2.7 | Solo componentes funcionales, hooks estándar (`useState`, `useEffect`, `useRef`, `useMemo`), sin clases |
| three | ^0.185.1 | Motor de render subyacente de That Open; no se usa Three.js "a mano" salvo en `core/Viewer.ts` (muerto) |
| @thatopen/components | ^3.4.6 | Motor principal: `Worlds`, `SimpleScene/Camera/Renderer`, `IfcLoader`, `FragmentsManager`, `Hider`, `Grids`, `Raycasters` |
| @thatopen/components-front | ^3.4.3 | `Highlighter` para selección |
| web-ifc | ^0.0.77 | No se importa directo en código de la app; se referencia como WASM remoto (`https://unpkg.com/web-ifc@0.0.77/`) consumido por `OBC.IfcLoader` |
| typescript | ~6.0.2 | `strict` no está explícito en `tsconfig.app.json`, pero sí `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`; `verbatimModuleSyntax: true` |
| vite | ^8.1.1 | Bundler; plugin React estándar; alias forzado de `three` para evitar instancias duplicadas |
| vitest | ^4.1.10 | Entorno `happy-dom`; 2 archivos de test, 11 tests, todos pasan |
| dependency-cruiser | ^18.1.0 | Gate arquitectónico: dominio no puede importar three/@thatopen/react/adapters/application |
| oxlint | ^1.71.0 | Linter activo, 4 warnings actuales (ver Deuda técnica) |
| Estado global | Context + pub/sub manual | No hay Zustand/Redux/MobX; `createApplication()` es un singleton por `AppProvider` con listeners tipados |
| CSS | CSS plano (no Modules, no Tailwind) | 4 archivos `.css`, estilos también inline extensivamente en JSX (`PropertiesPanel.tsx`, `ModelTree.tsx`) |

---

## Tabla: TODOs + prioridad

No se encontraron marcadores `TODO`, `FIXME`, `XXX` ni `HACK` en `src/`. La deuda técnica real detectada por lectura de código:

| Ítem | Prioridad | Ubicación |
|---|---|---|
| Eliminar `core/Viewer.ts` (código muerto, demo con `alert()`) | Alta (limpieza trivial) | [src/core/Viewer.ts](src/core/Viewer.ts) |
| Eliminar `core/World.ts` (archivo vacío) | Alta (limpieza trivial) | [src/core/World.ts](src/core/World.ts) |
| Eliminar `viewer/ViewerState.ts` (sin uso, duplica responsabilidad de `createApplication`) | Media | [src/viewer/ViewerState.ts](src/viewer/ViewerState.ts) |
| Corregir/actualizar `docs/Roadmap.md`: Transparencia, Color y Búsqueda están marcados ✓ pero no existen | Alta (bloquea planificación honesta de v1.0) | [docs/Roadmap.md](docs/Roadmap.md) |
| `useEffect` en `Viewport.tsx` con array de deps vacío pero usa `onViewerReady` y `app` (warning de oxlint, riesgo de closure obsoleto si esas props cambian) | Media | [src/ui/Viewport/Viewport.tsx:23-57](src/ui/Viewport/Viewport.tsx#L23-L57) |
| `useMemo` en `PropertiesPanel.tsx` con dependencia `selection` innecesaria y `currentGuids` recalculado cada render (warning de oxlint) | Baja | [src/components/PropertiesPanel/PropertiesPanel.tsx:24-72](src/components/PropertiesPanel/PropertiesPanel.tsx#L24-L72) |
| `AppContext.tsx` exporta un hook (`useApp`) junto al componente `AppProvider` en el mismo archivo (rompe Fast Refresh, warning de oxlint) | Baja | [src/ui/AppContext.tsx](src/ui/AppContext.tsx) |
| Existen dos ADRs de "lenguaje ubicuo" duplicados en rutas distintas (`docs/adr/0003-ubiquitous-language.md` y `docs/decisions/ADR-001-domain-language.md`) | Baja | `docs/adr/` vs `docs/decisions/` |

---

## Sección: Arquitectura en código

- **`IfcBootstrap.ts`** ([src/core/IfcBootstrap.ts](src/core/IfcBootstrap.ts)): único punto de inicialización del motor 3D. Crea `OBC.Components`, `World` (scene/camera/renderer), configura esquema de mouse estilo ArchiCAD (Shift para rotar, wheel manual con deceleración dinámica), inicializa `IfcLoader` apuntando a WASM remoto en unpkg, y `FragmentsManager`. Mantiene un `registry` interno como singleton módulo-level (no un objeto exportado directamente) — patrón simple pero acoplado a que solo haya un viewport activo a la vez. Se conecta a React vía `Viewport.tsx`, que lo llama en `useEffect` y limpia con `disposeIfcViewer` en el cleanup.
- **Capa `engine/`**: arquitectura hexagonal real, no cosmética. `domain/` (Federation, Model, Project, value objects) no importa React/Three/adapters — verificado en vivo: `npm run check:domain-isolation` pasa (`10 modules, 10 dependencies cruised, no violations`). `ports/FederationRepository.ts` es la interfaz; `adapters/InMemoryFederationRepository.ts` la implementa (comentario explícito: "Se reemplazará por persistencia real cuando el proyecto lo requiera"). `application/registerModel.ts` es el caso de uso que orquesta todo.
- **Puente técnico↔dominio**: `createApplication.ts` mantiene un `Map` (`technicalToDomainModelId`) para traducir entre el ID técnico que asigna That Open (`model.modelId`) y el `ModelId` de dominio (hash de contenido) — necesario porque son dos sistemas de identidad distintos y el comentario en el código lo deja explícito.

---

## Sección: Performance y deuda técnica

- No hay memory leaks obvios: los 8 `useEffect` detectados tienen cleanup (`Viewport.tsx`, `ModelTree.tsx`, `ModelUploader.tsx`, `PropertiesPanel.tsx` desuscriben correctamente). `IfcBootstrap.ts` limpia sus listeners de `keydown`/`keyup`/`wheel` en `disposeIfcViewer`.
- El "limpiador de marca de agua" en `IfcBootstrap.ts:153-172` hace polling cada 50ms sobre el DOM del contenedor (30 iteraciones, se autodetiene) para ocultar el watermark de That Open buscando texto en todos los `img/a/div`. Es un hack legítimo (no hay API oficial para desactivarlo) pero es frágil ante cambios de idioma/DOM de la librería y and cuestionable legal/licencia-wise si el watermark es parte de los términos de uso de That Open — vale la pena confirmarlo.
- oxlint reporta 4 warnings (ver tabla de TODOs), ninguno crítico.
- No hay imports sin usar detectables por lint (`noUnusedLocals`/`noUnusedParameters` están activos en `tsconfig.app.json`).

---

## Sección: Testing

- Framework: **Vitest** (`^4.1.10`), entorno `happy-dom`.
- 2 archivos de test, 11 tests, todos pasan (`npm run test` → 265ms).
  - `src/engine/engine.spec.ts`: cubre `registerModel` (Sprint 1) con loader y repositorio fake — prueba dominio sin WebGL/React.
  - `src/engine/domain/federation/detectDistantModels.spec.ts`: cubre el clustering de proximidad.
- `npm run test:smoke` (`tests/smoke-harness.ts`, vía `tsx`) es un smoke test headless adicional que verifica explícitamente que el Engine funciona sin renderer/React/That Open — ejecuta como script, no como suite de Vitest.
- **Cobertura real**: solo la capa `domain`/`application` del engine tiene tests. Cero tests de componentes React (Viewport, PropertiesPanel, ModelTree, ModelUploader, Layout) y cero tests de los managers en `viewer/` (SelectionManager, SpatialTreeManager, ProximityManager, IfcBootstrap). Es coherente con la filosofía "dominio aislado y testeable" del proyecto, pero significa que toda la integración con That Open Components/Three.js/DOM no tiene red de seguridad automatizada.

---

## Sección: IFC de prueba

- `public/ARC.ifc` — 271.608 bytes (~265 KB). Único archivo IFC de fixture en el repo. No hay carpeta `test/fixtures` ni `assets/models` adicional. Para un release 1.0, un solo archivo de prueba (arquitectónico, tamaño pequeño) es insuficiente para validar rendimiento con modelos grandes — el propio `docs/Roadmap.md` marca "Modelos grandes" como ✓ en Sprint 5.5, pero no hay evidencia (fixture ni test) de que eso se haya probado con un IFC de tamaño real (decenas/cientos de MB).

---

## Recomendaciones para v1.0

1. **Reconciliar `docs/Roadmap.md` con la realidad** antes de cualquier decisión de scope para v1.0: Transparencia, Color y Búsqueda están marcados como hechos y no existen. O se implementan, o se despriorizan explícitamente y se corrige el documento — lo que no debe pasar es tomar decisiones de "qué falta para v1.0" confiando en un roadmap desactualizado.
2. **Borrar el código muerto** (`core/Viewer.ts`, `core/World.ts`, `viewer/ViewerState.ts`) — es limpieza de bajo riesgo, cero importadores confirmados por grep, y reduce ruido para cualquiera que explore el repo después.
3. **Decidir el destino de Section Box**: no está ni implementado ni en el roadmap como pendiente explícito. Si es una feature esperada por usuarios de un "visor IFC profesional" (como dice `Vision.md`), debería entrar al backlog formal o al roadmap de v1.0, no quedar en limbo.
4. **Sumar al menos un fixture IFC grande** antes de cerrar Sprint 5.5 ("Modelos grandes" ✓) — sin eso, ese checkmark no está verificado, solo declarado.
5. **Test de integración mínimo del pipeline de carga real** (subir un IFC → aparece en árbol → es seleccionable) usando el `ARC.ifc` existente, aunque sea con Playwright o similar — hoy cero tests tocan React/DOM/That Open juntos.

---

## Riesgos técnicos

- **Roadmap-vs-código como fuente de verdad rota**: si el equipo o stakeholders usan `docs/Roadmap.md` para reportar avance, están reportando features que no existen. Este es el riesgo más alto encontrado en la auditoría, no por complejidad técnica sino por impacto en decisiones de negocio.
- **Dependencia de WASM remoto en runtime**: `IfcLoader` carga el WASM de `web-ifc` desde `https://unpkg.com/web-ifc@0.0.77/` en vez de servirlo localmente (`autoSetWasm: false` + `absolute: true`). Esto es un punto único de fallo externo: si unpkg está caído, lento, o la versión se retira, el visor no puede cargar ningún IFC. Para un producto de escritorio/profesional esto debería servirse desde `public/` o el bundle.
- **Singleton de `IfcBootstrap` vía módulo**: el `registry` interno asume un solo viewport activo en toda la app. No es un problema hoy (solo hay un `Viewport.tsx`), pero es una limitación arquitectónica implícita no documentada si en el futuro se quisiera comparación lado-a-lado o múltiples vistas.
- **Watermark-remover por polling de DOM**: frágil ante cambios de idioma/markup de That Open Components en futuras versiones; y depende de detectar texto en inglés/español — un upgrade de la librería podría romperlo silenciosamente (sin test que lo detecte).
- **Cobertura de test concentrada en el dominio**: la arquitectura hexagonal está bien defendida (tests + gate de dependency-cruiser), pero es la parte del código con menor riesgo real de romperse por refactors. La integración con Three.js/That Open —donde sí ocurren la mayoría de bugs reales en visores IFC (memory, raycasting, sincronización de estado)— no tiene cobertura automatizada.
