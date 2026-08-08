# Handoff — Etapa 4, próxima sesión

Este documento es el punto de entrada para la próxima sesión. Todo lo que afirma acá ya fue verificado (commits reales, tests corridos, deploy probado en vivo) durante esta sesión — no es un resumen especulativo. Para el detalle completo, ver los tres documentos que este handoff consolida:

- `ETAPA_3_COMPLETE.md` — qué se hizo, decisiones de arquitectura, testing, known issues.
- `ROADMAP_ETAPA_4_AND_BEYOND.md` — plan priorizado Etapa 4 a 7, con notas de qué ya existe vs. qué es realmente nuevo.
- `SESSION_SUMMARY.md` — referencia rápida de la sesión que acaba de terminar.

## Estado actual (verificado)

- **Rama:** `main`, sincronizada con `origin/main` (último commit al momento de este handoff: `98bc296`, docs de Etapa 3).
- **Deploy:** https://taupe-nasturtium-e97d1f.netlify.app — verificado en vivo esta sesión, incluyendo el flujo completo de "Crear incidencia" (crear → exportar → re-importar) contra el deployment de producción, no solo local.
- **Tests:** 20 pasando (`corepack pnpm --filter bwise-viewer-oguc test`), 5 archivos de test. `tsc -b` y `oxlint` limpios en cada commit de Etapa 3.
- **Etapa 3: completa.** Los 4 puntos (viewpoints Z-up/Y-up, Detail Panel + multi-viewpoints, export simétrico, creación de incidencias) están implementados, testeados con fixtures reales, y verificados en un browser real - no solo tipo-chequeados.

## Por dónde empezar en la próxima sesión

1. **Antes de estimar Etapa 4 en detalle:** el roadmap (`ROADMAP_ETAPA_4_AND_BEYOND.md`) señala explícitamente que la referencia UX dada para Etapa 4 (`https://viewer.crais.io`) **no fue visitada ni verificada** en esta sesión - es lo primero que hay que hacer antes de tomar cualquier decisión de diseño basada en ella, en vez de asumir de antemano qué patrones tiene.
2. **No asumir que Etapa 5/6 parten de cero** - el roadmap ya marca dos casos concretos donde eso sería falso:
   - Section box (Etapa 6): ya existe una versión simple de un solo plano (`ViewerActionsAdapter.toggleClipPlane`/`toggleClipperVisibility`, con su botón en `Toolbar3DFloating`) - confirmar qué tan lejos está de lo pedido (multi-plano, rotación) antes de estimar como feature nueva.
   - Comentarios en topics (Etapa 7): `BcfDetailPanel` ya muestra el conteo real (`Comentarios (N)`), solo falta el render de la lista - es completar algo empezado, no una feature nueva.
3. **Element reference (Etapa 5)** requiere tocar tres puntos, no uno: el tipo `BcfTopic` (agregar el campo, que hoy no existe), `BcfImporter` (leerlo), y `BcfExporter` (escribirlo) - `bcf-core` ya soporta `components.selection` a nivel de viewpoint, pero el adaptador de esta app lo descarta hoy en ambas direcciones.

## Convenciones ya establecidas que hay que seguir (no reinventar)

- **CoordinateTransform** (`src/utils/CoordinateTransform.ts`): toda coordenada BCF↔Three.js pasa por acá. Nunca duplicar la matemática de transformación en otro archivo.
- **Registry de módulos** (`src/ui/registry/modules.ts`): cualquier botón nuevo de toolbar/panel (ej. algo de Etapa 4/5) debería ser una entrada acá, no un `<button>` suelto - así lo hizo "Crear incidencia" en Punto 7, reutilizando el mismo patrón que Importar/Exportar BCF.
- **Portales para diálogos/modales:** cualquier modal nuevo debe usar `createPortal(..., document.body)` si va a vivir anidado dentro de un panel con `backdrop-filter` (como `BcfPanel`/`DockBottom`) - un bug real de esta clase ya apareció y se corrigió en Punto 7 (`CreateTopicDialog.tsx`); `backdrop-filter` crea un containing block nuevo para `position:fixed`, igual que `transform`.
- **Verificación real, no solo tipo-chequeo:** cada feature de Etapa 3 se verificó con fixtures BCF reales (`packages/bcf-core/src/__tests__/fixtures/`) y con Playwright contra un browser real, incluyendo — para Punto 7 — contra el deployment de producción. Mantener ese estándar para Etapa 4 en adelante.

## Comandos útiles para arrancar

```bash
cd /Users/chevi/Documents/bw-central
git log --oneline -5                                    # confirmar que seguimos en 98bc296 o más nuevo
corepack pnpm --filter bwise-viewer-oguc test            # 20 tests, deberían seguir pasando
corepack pnpm run check:architecture                     # dependency-cruiser, debería seguir limpio
```

## Links

- Live: https://taupe-nasturtium-e97d1f.netlify.app
- Repo: https://github.com/cheviquiroz/bw-central
- Este handoff en GitHub: https://github.com/cheviquiroz/bw-central/blob/main/apps/viewer-oguc/HANDOFF_ETAPA_4_NEXT_SESSION.md
