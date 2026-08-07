# BWise Viewer OGUC

Aplicación web (React + Vite + Three.js/@thatopen) que sirve de visor 3D
para modelos IFC y de interfaz para el flujo de revisión de cumplimiento
OGUC de BWise.

## Overview

El visor tiene dos rutas:

- **`/`** — exploración: cargar uno o más modelos IFC, navegar el modelo en
  3D, inspeccionar el árbol espacial, ver propiedades de elementos,
  buscar, medir, gestionar issues BCF.
- **`/revision`** — revisión de cumplimiento OGUC sobre el/los modelo(s)
  ya cargados en `/`: un Pre-Check de calidad de datos, seguido de una
  tabla de hallazgos generados por `@bw-central/oguc-core`, sincronizada
  con el visor 3D.

## Funcionalidades implementadas actualmente

**Visor 3D (`/`)**
- Carga y visualización de modelos IFC (uno o varios, federados).
- Navegación 3D: órbita, pan, zoom, encuadrar todo ("Fit All").
- Árbol espacial del modelo, con visibilidad por elemento.
- Panel de propiedades (atributos, property sets, cantidades) del elemento
  seleccionado.
- Búsqueda de elementos por nombre/tipo/propiedad.
- Medición de distancias/áreas en el modelo 3D.
- Section box (plano de corte).
- Cubo de orientación (view cube) para saltar a vistas ortogonales/isométricas.
- Gestión de issues BCF: importar/exportar `.bcf`, tabla de incidencias,
  salto de cámara al viewpoint de cada issue.

**Flujo de revisión (`/revision`)**
- Pre-Check: valida el modelo antes de habilitar la revisión (hallazgos
  bloqueantes, advertencias con reconocimiento obligatorio, información).
- Tabla de hallazgos (*findings*) con estado por hallazgo: `pending` /
  `accepted` / `rejected`.
- Salto de cámara y resaltado del elemento 3D al hacer clic en un
  hallazgo, con reintento defensivo (si el elemento no se encuentra, cae
  a "encuadrar todo" en vez de fallar).
- Notas de texto libre por hallazgo.
- Guardado y carga de revisiones en archivo `.bwrev` (JSON plano,
  client-side).
- Detección de modelo distinto al cargar un `.bwrev` (comparación por
  hash SHA-256), con confirmación explícita antes de cargar igual.
- Exportación de reportes PDF y Excel a partir de los hallazgos actuales.

## Cómo correrlo localmente

Desde la raíz del monorepo:

```bash
pnpm install
pnpm dev:viewer-oguc
```

O directamente desde este directorio:

```bash
pnpm dev            # servidor de desarrollo (Vite)
pnpm build           # build de producción
pnpm test            # tests unitarios (Vitest)
pnpm lint            # oxlint
```

## Flujo de uso típico

1. Cargar un modelo IFC en `/` (arrastrar y soltar, o el botón "+" del
   árbol espacial).
2. Ir a `/revision` (botón "Revisar OGUC" en la barra de herramientas —
   deshabilitado hasta que haya un modelo cargado).
3. Pasar el Pre-Check: revisar bloqueantes/advertencias/información,
   reconocer las advertencias y hacer clic en "Continuar".
4. Revisar los hallazgos en la tabla inferior: filtrar, ordenar, hacer
   clic para inspeccionar cada uno en el 3D, cambiar su estado, agregar
   notas.
5. Guardar la revisión (`.bwrev`) y/o exportar el reporte (PDF + Excel).

## Notas de arquitectura relevantes

- **Registro de módulos** (`src/ui/registry/modules.ts`): la barra de
  herramientas se arma a partir de un registro declarativo de módulos
  (id, ícono, atajo de teclado, si requiere un modelo cargado, etc.), no
  de una lista de botones hardcodeada. Agregar un botón nuevo a la
  barra es, en general, agregar una entrada al registro más un handler en
  el layout correspondiente.
- **Docks** (`src/ui/Dock/`): panel izquierdo (árbol), derecho
  (propiedades) e inferior (BCF en `/`, hallazgos en `/revision`) son
  paneles con visibilidad binaria (visible/oculto, sin estado intermedio
  "colapsado"), redimensionables donde corresponde, con su estado de
  layout persistido en `localStorage`.
- **`/revision` reutiliza los mismos componentes que `/`** (`DockLeft`,
  `Viewport`, `DockRight`, el registro de módulos, el mismo hook de
  herramientas 3D) — no hay una implementación paralela del visor para la
  ruta de revisión.
- **`ModelBytesRegistry`** (`src/core/ModelBytesRegistry.ts`): retiene los
  bytes crudos de cada IFC importado, en memoria, para que `/revision`
  pueda re-analizarlos con `@bw-central/ifc-headless` (el motor de reglas
  no puede leer el modelo directamente desde el visor 3D en vivo).

## Limitaciones actuales conocidas

- **La geometría 3D no persiste al navegar entre `/` y `/revision`.** Cada
  ruta monta su propio `Viewport` con su propio motor Three.js; los datos
  del modelo (árbol, propiedades, hallazgos) sí persisten porque vienen de
  `AppContext`/`ModelBytesRegistry`, pero el canvas de `/revision` puede
  no mostrar geometría hasta que esto se resuelva con una arquitectura de
  visor compartido entre rutas.
- **Los hallazgos de escaleras (Art. 4.2.10) son a nivel de edificio, no
  por tramo de piso** — ver limitaciones de `packages/oguc-core`.
- **No hay backend**: `.bwrev` es un archivo local, sin sincronización ni
  control de versiones más allá de lo que dé git si se versiona a mano.
- La visibilidad por elemento (`hiddenByModel`) no se comparte entre `/` y
  `/revision` — cada ruta mantiene su propio estado.

---

Last updated: 2026-08-06
