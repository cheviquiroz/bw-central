# Roadmap — Etapa 4 y más allá

Nota sobre alcance: este documento es un plan prospectivo, no un registro de trabajo ya hecho — a diferencia de `ETAPA_3_COMPLETE.md`, nada acá fue verificado contra código real todavía (no puede serlo, es trabajo futuro). Las estimaciones de días son las provistas al armar este roadmap, no medidas.

## Etapa 4: UI/UX Polish

### Objetivo

Mejorar percepción visual y usabilidad sin cambiar funcionalidad core.

**Sobre la referencia a CRAIS (https://viewer.crais.io):** esta URL fue provista como referencia de patrones UX/layout, pero no fue visitada ni verificada como parte de este roadmap — no se le atribuye ningún patrón o característica específica sin haberla confirmado primero. Antes de diseñar Etapa 4 en detalle, el primer paso real debería ser efectivamente revisar esa referencia (o cualquier otra) y documentar qué patrones concretos se van a adoptar, en vez de asumir de antemano qué tiene.

### Features

**Toolbar global refactor**
- Agregar labels visibles a cada módulo (no solo iconos)
- Organización clara: File | View | Tools | Help
- Search integrado en toolbar (no necesita un panel aparte)
- Keyboard shortcut hints (⌘K, etc.)
- Est. 2-3 días

**Layout improvements**
- Reduce visual density (less crowded)
- Better spacing/padding in panels
- Consistent sizing (dock widths, panel heights)
- Responsive: test <768px (mobile) + full desktop
- Est. 1-2 días

**Panel polish**
- FindingsTable: better sorting/filtering UX
- IssueTable: status badges more prominent
- Detail Panel: better typography hierarchy
- Empty states: clearer messaging
- Est. 1 día

**Total est.: 4-6 días**

### Not in scope (Etapa 4)

- New features (those are Etapa 5+)
- Section Box
- Element selection

---

## Etapa 5: Element reference in topics (Punto 7 Phase 2)

### Objective

Enable users to reference specific 3D elements/components when creating BCF topics.

### Features

**Element selection UI**
- Multi-select in 3D viewport (click-to-select) — nota: la investigación de Punto 7 (`src/viewer/bcf/investigation/BCF_CREATE_TECHNICAL_DESIGN.md`) ya encontró que el drag-box select multi-elemento existe (`EntitySelector.ts`), pero no se confirmó si click+ctrl/shift para ir *agregando* a una selección existe — verificar eso primero, no asumir que falta construirlo desde cero.
- Highlight selected elements
- Clear selection (ESC or button)
- Show selected element list in create-topic dialog
- Est. 2-3 días

**Store element references**
- Popular `BcfTopic.components[]` con referencias `ifcGuid` — campo que hoy **no existe** en el tipo `BcfTopic` de esta app (confirmado en la investigación de Punto 7); `bcf-core` sí soporta `components.selection` a nivel de viewpoint, pero el adaptador de esta app lo descarta en ambas direcciones hoy. Este trabajo es then: (1) agregar el campo al tipo, (2) leerlo en `BcfImporter`, (3) escribirlo en `BcfExporter` — tres puntos de cambio, no uno.
- Export/import element references correctly
- Est. 1 día

**Total est.: 3-4 días**

---

## Etapa 6: Section Box (Sustrato D)

### Objective

Implement 3D section box tool (multi-plane cutting, rotation, visual feedback).

Nota: esta app ya tiene un section-box simple de un solo plano (`toggleClipPlane`/`toggleClipperVisibility` en `ViewerActionsAdapter.ts`, con su botón en `Toolbar3DFloating`) — este roadmap lo describe como una feature nueva ("Core tool"), pero conviene primero confirmar qué tan lejos está esa versión existente de lo que se pide acá (multi-plano, rotación) antes de estimar como si se partiera de cero.

### Features

**Core tool**
- Define section box via 3 orthogonal planes (X, Y, Z)
- Planes can be offset independently
- Visual representation: wireframe box in 3D
- Toggle visibility
- Est. 3-4 días

**Advanced**
- Rotation of section planes
- Clipping visualization (show/hide what's cut)
- Save/load section box states
- Export section box in BCF (if BCF standard supports) — nota: el `BcfViewpoint.clippingPlane` ya existe y ya se transforma correctamente en import/export (Punto 1a/1c) para un plano simple; extenderlo a una caja de 3 planos necesitaría decidir cómo mapear 3 planos a la estructura BCF, que solo define una lista de planos individuales, no una "caja" como concepto propio.
- Est. 3-4 días

**Total est.: 6-8 días**

---

## Etapa 7: Nice-to-have features

### Snapshots auto-generation
- When exporting topic, auto-render viewport screenshot as PNG
- Embed in BCF as markup.snapshots
- Requires: bcf-core parser ready first
- Est. 2 días

### Comments on topics
- Add comment UI in Detail Panel — nota: `BcfDetailPanel` ya muestra el conteo real de comentarios (`Comentarios (N)`) pero no los renderiza; esto es completar algo ya empezado, no una feature nueva desde cero.
- Store comments in BcfTopic.comments[]
- Persist in BCF export/import
- Est. 2 días

### 2D drawings (SVG/PDF)
- Reference or embed 2D drawings in BCF
- Markup/annotation on 2D views
- Est. 5-7 días (complex)

### Real-time collaboration
- Multiple users editing same BCF
- Websocket sync
- Conflict resolution
- Est. 10+ días (very complex)

---

## Prioritization matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Etapa 4 (UI/UX) | High | Medium | 1 (next) |
| Element ref (E5) | High | Medium | 2 |
| Section Box (E6) | Medium | High | 3 |
| Snapshots (E7) | Medium | Low | 4 |
| Comments (E7) | Low | Low | 5 |
| 2D drawings | Low | High | 6 |
| Collab | Low | Very High | 7 |

---

## Known constraints & blockers

- `bcf-core` parser para `markup.snapshots`: no listo (dependencia externa, en otro paquete del monorepo).
- Colaboración requiere backend: fuera de alcance para esta fase (esta app hoy es 100% client-side, sin servidor propio).
- 2D drawings necesitan diseño/UX: diferir hasta que haya requisitos más claros.
- Section box multi-plano (Etapa 6): antes de estimar, confirmar el punto de partida real (ver nota arriba) — la estimación de 6-8 días asume empezar de cero, lo cual puede no ser cierto.

---

## Success metrics

Al terminar Etapa 6:
- BWise Viewer feature-complete para coordinación BIM de un solo usuario.
- Puede manejar flujos reales: ver → anotar → crear incidencias → exportar.
- UI comparable a CRAIS/BIMcollab en usabilidad (no necesariamente en pulido visual) — pendiente de una comparación real una vez se revise la referencia (ver nota en Etapa 4).
- 40+ tests pasando (actualmente 20, se espera que crezca).
- Cero bugs críticos, known issues claramente documentados.
