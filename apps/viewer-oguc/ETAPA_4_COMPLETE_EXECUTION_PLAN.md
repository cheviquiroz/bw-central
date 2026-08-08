# Etapa 4 — Plan de ejecución

## Nota sobre el origen de este documento

Este plan **expande** `ROADMAP_ETAPA_4_AND_BEYOND.md`'s con más detalle accionable (rutas de archivo reales, componentes reales que ya existen y habría que tocar), pero **no está basado en una conversación previa sobre layout/toolbar/file-manager/CRAIS/timeline específico** — esa conversación nunca ocurrió en esta sesión. Lo único real que existe hoy es el outline de alto nivel ya en el roadmap. Cada sección de acá marca explícitamente qué es real (ya decidido/verificado) vs. qué queda pendiente de decisión — no se inventó ningún valor de spacing, patrón de CRAIS, ni feature de "file manager" (ese término no aparece en ningún documento ni código de esta sesión; ver sección final).

## Alcance (igual al ya definido en el roadmap, no ampliado)

Mejorar percepción visual y usabilidad **sin cambiar funcionalidad core**. Esto excluye explícitamente, per `ROADMAP_ETAPA_4_AND_BEYOND.md`: features nuevas, Section Box, selección de elementos.

## Componentes/archivos reales que Etapa 4 tocaría

Identificados por ser los archivos reales detrás de cada bullet del roadmap — no una lista inventada:

**Toolbar global refactor**
- `src/ui/Toolbar/Toolbar.tsx`, `src/ui/Toolbar/ToolbarButton.tsx` — hoy los botones son solo ícono (sin label visible), confirmado leyendo `ToolbarButton.tsx`.
- `src/ui/registry/modules.ts` — fuente única de verdad para qué módulos existen; agregar labels visibles es un cambio de render en `Toolbar.tsx`, no del registry (la estructura ya tiene `label` en cada módulo, solo no se muestra hoy).
- `src/ui/Search/SearchBar.tsx` — ya vive dentro del toolbar (no en un panel aparte) desde antes de esta sesión; "search integrado en toolbar" ya es el estado actual, no algo por construir — si la intención es otra cosa (ej. una paleta de comandos estilo ⌘K), eso es una feature distinta y debería tratarse como tal, no como "ya casi está".
- `src/ui/KeyboardShortcutsModal/KeyboardShortcutsModal.tsx` — los shortcut hints ya existen acá (Ctrl+1/2/3, `?`, doble-click de rueda), documentados y funcionales. "Keyboard shortcut hints" en el toolbar mismo (no solo en el modal) sería una superficie nueva, no una que ya exista.

**Layout improvements**
- `src/components/Layout/Layout.css` — el grid principal (3 columnas + fila inferior). "Reduce density"/"consistent sizing" necesita valores concretos (paddings, anchos) que hoy no están definidos en este plan — ver sección "Pendiente de decisión".
- `src/ui/LayoutStateContext.tsx` — ya tiene constantes reales de tamaño (`DEFAULT_SIDE_DOCK_WIDTH=272`, `MIN_SIDE_DOCK_WIDTH=200`, `CANVAS_MIN_WIDTH=480`) — cualquier cambio de "consistent sizing" parte de acá, no de valores nuevos inventados sin revisar estos primero.
- Responsive <768px: ya existe un heurístico de pantalla angosta (`NARROW_SCREEN_BREAKPOINT_PX=1280`, solo aplicado al cargar, no en vivo — ver el comentario de esa constante en `LayoutStateContext.tsx`) y una investigación previa de esta misma sesión (`git log` — tarea de "responsive layout collapse") que encontró que por debajo de ~1088px el layout se corta silenciosamente (DockRight queda fuera de pantalla, sin scroll). Cualquier trabajo de responsive en Etapa 4 debería partir de ese hallazgo ya hecho, no re-investigarlo de cero.

**Panel polish**
- `src/routes/revision/findings-table.css`, `src/ui/components/Table/table.css` — FindingsTable ya usa sort por click-en-header (Etapa 2); "better sorting/filtering UX" necesita decir qué específicamente mejora, no está definido acá.
- `src/ui/BcfPanel/bcf-panel.css` — status badges ya existen (`.issue-status-pill`), "more prominent" es subjetivo sin una referencia visual concreta.
- `src/ui/BcfPanel/bcf-panel.css` (`.bcf-detail-*`) — Detail Panel ya tiene jerarquía tipográfica básica (título 15px/700, labels 10.5px uppercase, valores 12px) desde Punto 1b/7 de Etapa 3.
- `src/ui/EmptyState.tsx` — componente compartido ya existe (Etapa 2), usado en FindingsTable/IssueTable/ModelTree. "Clearer messaging" es un cambio de copy en los call sites, no un componente nuevo.

## Pendiente de decisión (no inventado, marcado explícitamente)

Estos son los puntos donde este plan **no** tiene un valor concreto porque no existe todavía — necesitan la conversación real que este documento no reemplaza:

1. **Referencia CRAIS (`https://viewer.crais.io`)** — no visitada todavía en ninguna sesión. Antes de cualquier decisión de spacing/densidad/organización visual "inspirada en CRAIS", alguien tiene que efectivamente abrirla y documentar qué patrones concretos se van a adoptar.
2. **"File manager"** — este término no aparece en ningún documento (`ETAPA_3_COMPLETE.md`, `ROADMAP_ETAPA_4_AND_BEYOND.md`, `SESSION_SUMMARY.md`, `HANDOFF_ETAPA_4_NEXT_SESSION.md`) ni en el código de esta app. No hay evidencia de qué se quiere decir con esto — ¿el árbol de modelos (`DockLeft`/`ModelTree.tsx`, que ya existe)? ¿Una función nueva de administrar múltiples archivos IFC/BCF guardados? Necesita aclararse antes de poder planificarse, no se adivina acá.
3. **Valores exactos de spacing/padding** — "reduce density"/"better spacing" no tiene números sin (1) revisar CRAIS o (2) que alguien defina un sistema de spacing propio. Los tokens reales hoy (`src/styles/tokens.css`) no incluyen una escala de spacing, solo colores/tipografía.
4. **Timeline y bloqueadores específicos** — el único estimado real que existe es el ya dado en `ROADMAP_ETAPA_4_AND_BEYOND.md` (4-6 días, desglosado en 2-3 + 1-2 + 1 por sub-área). No hay bloqueadores identificados más allá de la dependencia obvia: los puntos 1-3 de esta lista deben resolverse antes de poder ejecutar con precisión, no son bloqueadores técnicos sino de definición.

## Orden de ejecución sugerido (deriva del roadmap, no nuevo)

1. Resolver los 4 puntos pendientes arriba (conversación real, no parte de este documento).
2. Toolbar global refactor (2-3 días) — el de mayor impacto visible per el roadmap.
3. Layout improvements (1-2 días) — depende de que el toolbar refactor no cambie las dimensiones que el layout ya asume.
4. Panel polish (1 día) — el más aislado, puede paralelizarse si hay más de una persona, pero no tiene prioridad sobre los dos anteriores.

## Qué este documento NO incluye (a propósito)

- Timeline día-por-día — el estimado real (4-6 días) ya vive en el roadmap y no se subdividió más porque no hay información nueva para hacerlo con precisión.
- Cualquier decisión de diseño visual específica (colores, spacing exacto, jerarquía de toolbar) — todas dependen de los puntos pendientes de decisión arriba.
- Una sección de "file manager" — genuinamente no hay contenido real que poner ahí (ver punto 2 arriba).
