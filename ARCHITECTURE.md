# Arquitectura — BWise OGUC

Este documento describe las decisiones de diseño vigentes, el flujo actual
del producto y el roadmap priorizado. Está pensado para alguien que va a
tocar el código, no como material de venta — si algo acá no coincide con
lo que ves en el repo, el repo tiene la razón; abre un issue o corrige
este documento.

## 1. Principios de diseño

- **Separación clara entre packages puros (lógica) y la app (UI).**
  `packages/*` son dominio: sin React, sin DOM, sin dependencia de
  `apps/*`. `apps/viewer-oguc` es la única capa que conoce Three.js,
  `@thatopen/*` y el navegador. Esta regla está enforced automáticamente
  por `pnpm check:architecture` (`dependency-cruiser`), no solo por
  convención — un import que la viole falla en CI/local antes de llegar a
  revisión de código.
- **`oguc-core` no debe conocer React ni el DOM.** Es dominio puro sobre
  la estructura de datos que expone `ifc-headless`. La integración con el
  visor 3D en vivo (saltar la cámara a un elemento, resaltarlo) vive en
  `apps/viewer-oguc`, no acá.
- **Parsing defensivo de IFC: nunca inventar datos.** Si un dato no está
  declarado en el archivo, o su unidad no se puede resolver, el resultado
  es "no disponible" — nunca un valor por defecto silencioso que se
  confunda con un dato real. Esto aplica tanto a `ifc-headless` (lectura)
  como a `oguc-core` (evaluación): un espacio sin área declarada no
  cuenta como "0 personas", cuenta como "no se pudo calcular".
- **IDs de hallazgos lo más deterministas posible.** `Finding.id` se
  deriva de `ruleId:modelId:elementId`, no de un UUID aleatorio, para que
  guardar/cargar un `.bwrev` y volver a generar los hallazgos sobre el
  mismo modelo produzca los mismos IDs — necesario para que el estado
  (`pending`/`accepted`/`rejected`) y las notas se puedan asociar
  correctamente al recargar.
- **Persistencia client-side (`.bwrev`).** No hay backend. Una revisión
  se guarda como un archivo JSON plano descargado por el navegador
  (`Blob` + `URL.createObjectURL`), y se retoma subiendo ese mismo
  archivo. Legible, diffable en git, sin infraestructura adicional — al
  costo de no tener sincronización ni multiusuario (ver Limitaciones y
  Roadmap).

## 2. Estructura del repositorio

```
bw-central/
├── apps/
│   └── viewer-oguc/
│       └── src/
│           ├── components/Layout/    # Layout de "/" (Toolbar+Docks+Viewport)
│           ├── routes/
│           │   ├── RevisionLayout.tsx    # Layout de "/revision"
│           │   └── revision/             # PreCheckGate, FindingsTable, bwrev.ts, reportes
│           ├── ui/
│           │   ├── Dock/                 # DockLeft/DockRight/DockBottomShell
│           │   ├── Toolbar/              # Barra de herramientas + registro de módulos
│           │   ├── registry/modules.ts   # Fuente única de verdad de la Toolbar
│           │   └── Toast/
│           ├── viewer/                   # SelectionManager, SearchManager, BcfManager, etc.
│           ├── engine/                   # createApplication (estado de dominio de la app)
│           └── core/                     # IfcBootstrap (Three.js/@thatopen), ModelBytesRegistry
├── packages/
│   ├── ifc-headless/    # Lee bytes IFC -> IfcHeadlessDocument (Node, sin DOM)
│   ├── ifc-core/        # Utilidades de dominio IFC compartidas (hashing, federación)
│   ├── oguc-core/       # Reglas OGUC sobre IfcHeadlessDocument -> hallazgos
│   ├── report-core/     # Modelo de documento genérico -> PDF/Excel
│   ├── bcf-core/        # Dominio BCF
│   └── ids-core/        # Dominio IDS
└── public/               # Fixtures IFC para pruebas manuales end-to-end
```

## 3. Flujo actual de `/revision`

```
/  (exploración)
│  usuario carga un modelo IFC, ModelBytesRegistry retiene los bytes crudos
│
├─ clic en "Revisar OGUC" (deshabilitado si no hay modelo)
▼
/revision
│
├─ PreCheckGate
│    - re-lee los bytes retenidos con ifc-headless (readIfcFile)
│    - corre oguc-core.runPreCheck(doc)
│    - bloqueantes impiden continuar; advertencias requieren reconocerse
│      una por una antes de habilitar "Continuar"
│
▼ (Continuar)
Review Space
│    - se generan los Finding[] UNA vez, al pasar Pre-Check
│      (generateFindings.ts: Art. 4.2.4 + Art. 4.2.10, sobre el MISMO
│      IfcHeadlessDocument ya parseado para Pre-Check, sin re-parsear)
│    - Toolbar + DockLeft (árbol) + Viewport (3D) + DockRight (propiedades)
│      + FindingsDock (tabla de hallazgos), reutilizando los mismos
│      componentes que "/"
│    - clic en un hallazgo -> SearchManager.selectAndFocus(modelId,
│      elementId): selecciona, resalta y encuadra la cámara sobre el
│      elemento; si no se encuentra, cae a "encuadrar todo" (nunca falla)
│    - cambiar estado / agregar nota -> estado React en RevisionLayout
│
├─ "Guardar revisión" -> descarga .bwrev (JSON)
├─ "Cargar revisión" -> sube un .bwrev, restaura Finding[] con sus estados
│    (si el hash del modelo no coincide con el cargado, se pide
│    confirmación explícita antes de continuar)
└─ "Exportar reporte" -> arma un ReportDocument (report-core) a partir de
     los hallazgos actuales y descarga PDF + Excel
```

### Estados de un hallazgo

`pending` (default) → `accepted` | `rejected`. El cambio de estado es
libre en cualquier dirección — no hay una máquina de estados que lo
restrinja. El estado se persiste en el `Finding` mismo, tanto en memoria
como en el `.bwrev` guardado.

## 4. Cómo agregar una nueva regla de cumplimiento

Ver la sección equivalente en
[`packages/oguc-core/README.md`](packages/oguc-core/README.md) para el
detalle paso a paso del lado del motor. En resumen, el trabajo se reparte
en dos capas:

1. **`packages/oguc-core`**: la evaluación en sí (dato de entrada ya leído
   → veredicto), sin conocer `Finding` ni la UI.
2. **`apps/viewer-oguc/src/routes/revision/generateFindings.ts`**: mapea
   el veredicto del motor a `Finding[]` — acá se decide severidad, título
   y descripción en español, y se resuelve el `elementId`/`modelId` que
   el visor 3D necesita para saltar a ese elemento.

## 5. Limitaciones actuales importantes

- **Capa de clasificación OGUC todavía inmadura.** El *match* de destino
  es por texto (nombre/tipo del espacio contra una tabla de sinónimos) —
  no hay ayuda de clasificación más allá de eso. Es la limitación más
  relevante del producto hoy: gran parte del valor prometido (clasificar
  automáticamente y con confianza los espacios de un modelo real)
  todavía no está resuelto.
- **Pocas reglas implementadas.** Solo Art. 4.2.4 (ocupación) y Art.
  4.2.10 (escaleras, a nivel de edificio). El resto de la OGUC relevante
  para un proyecto (iluminación/ventilación, dimensiones mínimas de
  recintos, accesibilidad, etc.) no está evaluado todavía.
- **Geometría y estado no siempre se comparten de forma ideal entre
  rutas.** `/` y `/revision` montan cada uno su propio `Viewport` con su
  propio motor Three.js — los datos del modelo (árbol, propiedades,
  hallazgos) sobreviven la navegación porque vienen de
  `AppContext`/`ModelBytesRegistry`, pero la geometría 3D en sí puede no
  estar presente en `/revision` hasta que exista una arquitectura de
  visor compartido entre rutas (portal, o un único `Viewport` montado por
  encima del router).
- **No hay backend.** Sin sincronización entre dispositivos/usuarios, sin
  control de acceso, sin histórico más allá de los archivos `.bwrev` que
  el usuario decida guardar manualmente.

## 6. Roadmap priorizado

Prioridad real, en orden:

1. **Mejorar y cerrar el flujo actual de Review + `.bwrev` + reportes.**
   Terminar de endurecer lo que ya existe (Pre-Check, tabla de hallazgos,
   guardado/carga, reportes) antes de sumar superficie nueva.
2. **Construir la capa de clasificación asistida** — el núcleo de valor
   pendiente del producto. Reemplazar/complementar el *match* por texto
   actual con algo sustancialmente más confiable.
3. **Cuadro de superficies según criterios OGUC** — agregación de áreas
   por piso/destino/unidad, con trazabilidad a los recintos de origen
   (el modelo de datos de `report-core`, ya usado para los reportes de
   revisión, fue diseñado pensando en este consumidor).
4. **Planos 2D (PDF) sincronizados con el modelo 3D** — versión básica:
   calibración de un plano importado más un marcador de posición, no
   sincronización bidireccional completa todavía.
5. **Más reglas geométricas**: iluminación/ventilación, dimensiones
   mínimas de recintos, alturas — siguiendo el mismo patrón de
   `oguc-core` (evaluación pura + mapeo a `Finding` en la app).
6. **Accesibilidad** como set de reglas propio.
7. **Experiencia 2D+3D más avanzada**, con sincronización bidireccional
   real entre el plano y el modelo.
8. **Backend / multiusuario** — solo si hay demanda clara; no es
   prioridad mientras el flujo client-side actual siga siendo
   suficiente para el caso de uso.

## 7. Estrategia de testing

- Cada package (`oguc-core`, `ifc-headless`, `report-core`, etc.) tiene
  sus propios tests unitarios (Vitest), corridos con `pnpm test` desde su
  propio directorio.
- Las reglas de `oguc-core` y el lector de `ifc-headless` se prueban
  tanto contra **fixtures IFC reales** (`packages/oguc-core/fixtures/`,
  modelos reales exportados de Revit/ArchiCAD) como contra **datos
  sintéticos** armados a mano para forzar casos borde específicos (área
  en cero, unidad no resoluble, sin `IfcSpace`, etc.) — un fixture real
  no siempre cubre el caso borde que se quiere probar, y un dato
  sintético nunca reemplaza la validación contra un archivo real.
- `apps/viewer-oguc` combina tests unitarios (Vitest) con verificación
  manual/end-to-end real en navegador para flujos de UI e integración
  con el visor 3D (algo que un test unitario en `happy-dom` no puede
  validar de forma confiable, dado que involucra WebGL y Three.js).
- `pnpm check:architecture` (dependency-cruiser) corre como parte de la
  verificación de cualquier cambio que toque imports entre packages —
  no es opcional, es la forma en que la Sección 1 ("separación clara
  entre packages puros y la app") se hace cumplir en la práctica.

## 8. Notas para contribuir

- Antes de agregar una regla o feature nueva, revisar si el dato que
  necesita ya existe en `IfcHeadlessDocument`
  (`@bw-central/ifc-headless`). Si no existe, ese es el primer trabajo —
  no vale la pena construir sobre un dato inventado en una capa superior.
- No agregar dependencias nuevas a `packages/*` sin verificar primero si
  ya existe algo reutilizable en otro package del monorepo (ver, por
  ejemplo, cómo `report-core` ya resolvía la generación de reportes antes
  de que se integrara con `oguc-core`).
- Todo el código, comentarios y nombres de identificadores en inglés;
  todo el texto de cara al usuario (labels, mensajes, este set de
  documentos) en español de Chile.
- `pnpm check:architecture` y los tests de cada package tocado deben
  pasar antes de considerar un cambio terminado.

---

Last updated: 2026-08-06
