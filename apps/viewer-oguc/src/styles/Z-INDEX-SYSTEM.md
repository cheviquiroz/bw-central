# Z-Index System — viewer-oguc

## Propósito

Mantener claro el orden real de capas de la app, para que agregar algo
nuevo no requiera adivinar un número. Todos los valores de acá fueron
grepeados directo del código al escribir este documento (Etapa 4a Fase
3) - no son un diseño aspiracional, son lo que el código realmente hace
hoy. Si este documento y el código alguna vez no coinciden, el código
gana; actualizar este archivo en el mismo commit que cambie un z-index.

## Tabla completa (de atrás hacia adelante)

| z-index | Elemento(s) | Archivo | Portal? |
|---|---|---|---|
| 1 | `.viewport-container` (canvas 3D) | `Viewport.css` | no |
| 10 | `.dock-panel-resize-handle` / `.dock-right-resize-handle` / `.dock-bottom-resize-handle` | `dock.css` / `dock-right.css` / `dock-bottom.css` | no |
| 50 | `.file-upload-overlay` (fondo del modal de carga) | `file-upload-modal.css` | no |
| 55 | `.toolbar-capsule` (las 3 cápsulas del toolbar) | `toolbar.css` | no |
| 60 | `.measurement-toolbar` | `measurement-toolbar.css` | no |
| 90 / 200 | `.orientation-cube` (90 normal, 200 cuando `zones.right`) | `orientation-cube.css` + inline style | **sí** |
| 100 | `.dock-panel` (DockLeft) / `.dock-right` / `.dock-bottom` | `dock.css` / `dock-right.css` / `dock-bottom.css` | no |
| 110 | `.toolbar-3d-floating` | `toolbar-3d-floating.css` | **sí** |
| 120 | `.panel-layer` (paneles flotantes: model-tree, bcf) | `Layout.css` | no (sube el valor de la CAPA en vez de portar cada panel - ver Etapa 4b-3 en "Cambios históricos") |
| 150 | `.precheck-overlay` (solo `/revision`) | `Layout.css` | no (no lo necesita, ver más abajo) |
| 300 | `.tooltip` | `tooltip.css` | no |
| 500 | `.toast` | `toast.css` | no |
| 600 | `.review-actions` (extra actions del toolbar en `/revision`) | `review-actions.css` | no |
| 1000 | `.shortcuts-modal-backdrop`, `.create-topic-dialog-backdrop`, `.loading-overlay`, `.file-upload-box` (el cuadro interior del modal, no su fondo) | `keyboard-shortcuts-modal.css` / `create-topic-dialog.css` / `loading-overlay.css` / `file-upload-modal.css` | **sí** (los primeros 3) |

No existe ningún z-index "101" en el código - `.dock-bottom` usa el
mismo 100 que `.dock-panel`/`.dock-right`, no un valor ligeramente
superior. Los tres docks se solapan por orden de DOM si alguna vez
llegaran a competir por el mismo píxel (hoy no lo hacen: Fase 2 los
posiciona sin overlap real - ver `DockLeft.tsx`/`DockRight.tsx`).

## Por qué algunos elementos necesitan `createPortal`

Un número de z-index alto NO garantiza ganar, si el elemento vive
anidado dentro de un ancestro que ya creó su propio *stacking context*.
Desde Etapa 4a Fase 1, `.viewport-container` (el canvas) es
`position:fixed` con su propio `z-index:1` - eso lo convierte en un
stacking context real (position:fixed SIEMPRE crea uno, sin importar el
valor de z-index). Cualquier descendiente suyo con un z-index interno
alto queda **capado** a competir solo dentro de ese contexto (rank
efectivo ~1 desde afuera), sin importar qué número le pongas adentro.

Esto rompió, en su momento, tres componentes reales que viven dentro de
`Viewport.tsx` (hijo de `.viewport-container`) o de `.dock-panel` (otro
stacking context, `z-index:100`):

- `KeyboardShortcutsModal` (encontrado y arreglado en el commit de Fase 1)
- `Toolbar3DFloating` (encontrado y arreglado en el commit de Fase 1)
- `OrientationCube` (arreglado en el commit de Fase 2, junto con su
  z-index reactivo - sin el portal, el z-index dinámico 90→200 no tenía
  NINGÚN efecto visual)
- `LoadingOverlay` cuando lo usa `DockLeft.tsx` (encontrado y arreglado
  en el commit de Fase 3, verificando este mismo documento contra el
  código real) - su uso desde `PreCheckGate.tsx` no estaba roto (no vive
  dentro de ningún ancestro fixed+z-index), pero se portó siempre, no
  condicionalmente, para no mantener dos comportamientos distintos del
  mismo componente según quién lo llame.

`.precheck-overlay` (150) es el ejemplo de lo contrario: vive dentro de
`.viewport`, pero ni `.viewport` ni `.layout` (sus ancestros) declaran
`position` ni `z-index` propios, así que ninguno crea un stacking
context - su z-index:150 compite directo a nivel raíz, sin necesitar
portal.

## Reglas generales

1. **El canvas siempre es la capa más baja (z-index: 1).** Es el fondo;
   nada debería necesitar estar por debajo.
2. **Los 3 docks comparten el mismo nivel (z-index: 100)**, no hay
   jerarquía entre ellos - hoy no se solapan geométricamente (Fase 2),
   así que el orden de pintado entre ellos nunca importa en la
   práctica.
3. **El toolbar (55) vive entre el canvas y los docks** a propósito:
   siempre visible sobre el modelo, pero los docks lo tapan si se
   superponen (mismo criterio "los paneles ganan" que ya regía antes de
   Fase 1/2).
4. **Los modales reales (1000) están siempre por encima de todo lo
   demás** que no sea otro modal - son los únicos casos que bloquean
   interacción con el resto de la app.
5. **Si algo queda atrapado detrás pese a tener un z-index más alto que
   lo que lo tapa: es casi seguro un stacking context, no un número mal
   elegido.** `createPortal(..., document.body)` es el fix establecido
   en este proyecto (ver los 4 casos reales arriba) - subir el z-index
   más y más no resuelve un problema de anidamiento.
6. **El cubo de orientación es el único caso de z-index verdaderamente
   dinámico hoy** (90 ↔ 200, según `zones.right` - `LayoutStateContext`,
   no DOM scanning). No es una excepción arbitraria: es la única pieza
   de UI cuya posición fija realmente coincide, en el estado por
   default de la app (`DEFAULT_LAYOUT_ZONES`), con el área de un dock -
   ver `OrientationCube.tsx` para el razonamiento completo.

## Cuándo agregar algo nuevo

1. ¿Es contenido del canvas o compite con él? → cerca de 1, sin pasar
   de 50 (el overlay del File Upload Modal).
2. ¿Es una herramienta flotante sobre el canvas, como el toolbar 3D o
   el de medición? → 55-90, y confirmá si necesita portal (¿vive
   anidado dentro de `.viewport-container` o de un dock?).
3. ¿Es un panel acoplado (dock)? → 100, igual que los otros tres.
4. ¿Es un overlay de bloqueo específico de una ruta (como
   `.precheck-overlay`)? → 150, y confirmá si necesita `position:fixed`
   explícito (no asumas que heredás uno de un ancestro).
5. ¿Es un modal/diálogo real que debe ganarle a todo? → 1000, con
   `createPortal(..., document.body)` siempre, no condicionalmente.
6. ¿Nada de lo anterior gana pese a tener el número más alto? → buscá
   un ancestro `position:fixed`/`sticky`/con `filter`/`backdrop-filter`
   distinto de `none` entre el elemento y `document.body` - ese es casi
   siempre el motivo real.

## Cambios históricos

- **Etapa 4a Fase 1:** canvas a `position:fixed` con `z-index:1`;
  `.dock-right`/`.dock-bottom` ganaron `z-index:100` explícito (antes
  dependían de orden de DOM, dejaron de funcionar al aparecer el
  stacking context del canvas); `KeyboardShortcutsModal` y
  `Toolbar3DFloating` portados a `document.body`.
- **Etapa 4a Fase 2:** docks a `position:fixed`; `OrientationCube`
  portado, con z-index reactivo (90/200) según `zones.right`.
- **Etapa 4a Fase 3:** este documento; `LoadingOverlay` portado (mismo
  bug de stacking context, encontrado al escribir esta tabla contra el
  código real, no reportado por el usuario).
- **Etapa 4b-3:** BCF migrado de `DockBottom` (fijo) a un
  `FloatingPanel` (`.panel-layer`) - `.panel-layer` subió de
  `z-index:20` a `120`: al ser `position:absolute` con un z-index
  numérico real, ya creaba un stacking context desde Etapa 4b-1, y
  cualquier panel flotante quedaba topeado a rank 20 contra los docks
  fijos (100) cuando ambos ocupaban el mismo píxel - encontrado con un
  hit-test real (BCF recién abierto, en su posición default, coincidía
  con la de DockLeft; `elementFromPoint` devolvía el dock). Se subió el
  z-index de la CAPA entera, no se portó cada panel individualmente -
  los paneles flotantes son la capa que reemplaza a los docks, tiene
  sentido que ganen todos por diseño, no caso por caso.
