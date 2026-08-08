# BCF_CREATE_IMPLEMENTATION_PLAN.md — Part 6

Investigation/design only, no code changes. Commit: none.

## 1. MVP (Phase 1)

- **Create button location:** `BcfPanel.tsx`'s header actions row (`.bcf-header-actions`), a new `registry/modules.ts` entry (`id: "bcf-create"`, `surface: "bcf-panel"`), next to the existing Importar/Exportar buttons — zero new layout code, an established pattern used twice already.
- **Form fields:** Título (required), Descripción (optional), Prioridad (optional, default `"Medium"`), Responsable (optional). Status is not user-editable — always starts `"Open"`.
- **Auto-capture viewpoint:** yes, default-checked checkbox, using the real `world.camera.three` accessor pattern already used elsewhere in this codebase (`BCF_CREATE_TECHNICAL_DESIGN.md` Part 3) — falls back to the existing `DEFAULT_VIEWPOINT` constant (`BcfImporter.ts`) if unchecked, not a new default.
- **Element reference:** **skip** — no field exists on `BcfTopic` for it today, and adding one would mean building import/export support for `bcf-core`'s `components.selection` that doesn't exist anywhere in this app currently (`BCF_CREATE_CURRENT_STATE.md` Part 2).
- **Export:** all topics together, via the existing "Exportar BCF" button — **no change to `BcfExporter.ts` needed**, it already treats every topic in `project.topics` uniformly regardless of origin.
- **Estimated complexity: low-to-medium.** Low for the data/state layer (one new `BcfManager` method following an exact existing pattern; `BcfExporter`/`BcfImporter` need zero changes, already validated by this investigation's temporary test). Medium for the UI layer only because this is the *first* form/dialog this app has needed to build from scratch (no generic `<Modal>`/`<Form>` component exists yet to reuse verbatim, though a clear structural precedent exists).

**Files to modify** (design-time list, not yet implemented):
- `BcfManager.ts` — add `addTopic(topic: BcfTopic): void`, and resolve the "no project loaded yet" gap identified in `BCF_CREATE_WORKFLOW.md` (lazily create an empty `BcfProject` on first `addTopic` if `state.project` is `null`).
- New: `src/ui/BcfPanel/CreateTopicDialog.tsx` (or similar) — the form/dialog itself, following `KeyboardShortcutsModal.tsx`'s backdrop+box+Escape+click-outside pattern.
- New (or inline in the dialog/a small helper module): the `captureCurrentViewpoint(viewerHandles)` function (`BCF_CREATE_TECHNICAL_DESIGN.md` Part 3.4) — needs access to the live `IfcViewerHandles`, which today only `Viewport.tsx`/`useModelToolActions.ts` hold; this dialog would need that reference threaded to it (a real, if small, new piece of prop/context plumbing not needed by any of Punto 1a-1c's work).
- `registry/modules.ts` — new `bcf-create` entry.
- `BcfPanel.tsx` — wire the new button's `onClick` to open the dialog; wire the dialog's submit to `BcfManager.addTopic` + `setActiveTopic`.
- **`BcfExporter.ts`, `BcfImporter.ts`: no changes** — already correct for this use case, confirmed by this investigation's temporary round-trip test, not assumed.

## 2. Nice-to-have (Phase 2+, explicitly deferred, not planned in detail here)

- Multi-select elements for reference (blocked on building `components.selection` import/export support that doesn't exist for *any* topic today, not specific to creation).
- Snapshot/image capture from the live 3D canvas.
- Comments on newly created topics (the field already exists and round-trips fine, `[]` by default — just no UI to add a first comment at creation time).
- Editing existing topics (this task is additive-only — creating new topics — not a general topic-editing feature).

## 3. Blockers to resolve before implementation

**None found that block the MVP as scoped above.** One **design decision**, not a technical blocker, needs resolving during implementation (not guessed at here, per this investigation's own instructions): what `addTopic` should do when no `BcfProject` has been loaded yet (`BCF_CREATE_WORKFLOW.md`'s Part on export integration) — lazily synthesize an empty project vs. requiring an import first. Both are straightforward to implement; picking one is a product call, not a research question this investigation can resolve on its own.

## 4. Testing strategy

Directly mirrors `BcfExporter.spec.ts`'s already-proven shape (Punto 1c), plus a real UI pass:
1. **Automated (extending the existing test file, or a new one following its exact pattern):** build a `BcfTopic` via whatever function `addTopic`/the dialog submit handler ends up using (not a hand-built literal, unlike this investigation's temporary test) → export via `BcfExporter.create()` → re-parse with `bcf-core` directly → assert title/description/priority/status/viewpoint all match what was entered.
2. **Live UI (Playwright, same methodology used for every prior BCF task this session):** click "Crear incidencia" → fill the form → submit → verify the new row appears in `IssueTable` → verify `BcfDetailPanel` opens showing the entered data → click "Exportar BCF" → capture the download → re-import that exact downloaded file into a fresh session → verify the created topic is present with correct title/description/priority/viewpoint (double-click it, confirm the camera lands where it was captured from, screenshotted).

## Validation checklist (Part 7 of the brief), answered against real evidence gathered this investigation

- [x] `BcfTopic` can be constructed with only required fields — **tested**, temporary test, deleted after (see below).
- [x] Minimal `BcfTopic` exports cleanly via `BcfExporter` — **tested**, same run.
- [x] Exported minimal topic re-imports without corruption — **tested**, same run, via `bcf-core`'s own `parseBcf` directly (ground truth, not this app's own adapter re-reading its own output).
- [x] Viewpoint can be captured from current camera — **code pattern identified** (`world.camera.three.position`/`.getWorldDirection()`/`.up`, all confirmed as real, already-used-elsewhere accessors), not yet implemented (out of this investigation's scope).
- [x] UI location identified — `BcfPanel.tsx`'s header actions row, registry-driven, matching Importar/Exportar's existing pattern.
- [x] MVP vs. Phase 2 clearly split — Section 1/2 above.
- [x] No blockers, only deferrals — Section 3.
- [x] Export-reimport round-trip will be tested in Phase 1 — Section 4.

### Evidence: the temporary validation test (run, confirmed, then deleted — nothing committed)

A file `_temp_create_topic_investigation.spec.ts` was written directly under `src/viewer/bcf/`, run once via `vitest run`, and removed immediately after — `git status` confirms the working tree is clean of it. It built exactly this `BcfTopic`:
```ts
{
  guid: crypto.randomUUID(),
  title: "Nueva incidencia de prueba",
  description: "",
  createdAuthor: "tester@bwisebim.cl",
  createdDate: new Date().toISOString(),
  priority: "Medium",
  status: "Open",
  viewpoints: [{ guid: crypto.randomUUID(), camera: {
    position: { x: 0, y: 5, z: 10 }, direction: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 },
  }}],
  comments: [],
}
```
`BcfExporter.create()` accepted it without error; `bcf-core`'s `parseBcf()` re-imported the exported bytes and confirmed `title`, `topicStatus: "Open"`, `priority: "Medium"`, and exactly one viewpoint all survived, with the camera position correctly transformed through the existing `CoordinateTransform` (input `{0,5,10}` in Three.js space came back as `{0,-10,5}` in BCF space — matching `threeJSToBcf`'s exact, already-verified formula, not a new or different transform).
