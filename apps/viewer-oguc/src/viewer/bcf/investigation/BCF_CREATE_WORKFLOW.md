# BCF_CREATE_WORKFLOW.md — Part 4, detailed

Investigation/design only, no code changes.

## Step-by-step user interaction

1. **User clicks "Crear incidencia"** — a new button in `BcfPanel.tsx`'s `.bcf-header-actions`, registered in `registry/modules.ts` (`id: "bcf-create"`, `surface: "bcf-panel"`) next to the existing "Importar BCF"/"Exportar BCF" buttons, per the established pattern (`BCF_CREATE_CURRENT_STATE.md` Part 4).
2. **System response:** a dialog opens (backdrop + centered box, following `FileUploadModal.tsx`/`KeyboardShortcutsModal.tsx`'s established pattern), pre-filled with sensible defaults: `priority: "Medium"`, `status: "Open"` (not user-editable at creation — every new topic starts `"Open"`, matching what "creating an issue" means), a checkbox "Capturar vista actual" defaulted **checked**.
3. **Form fields visible to the user:**
   - **Título** (text input, required — the only field that blocks submission if empty)
   - **Descripción** (textarea, optional)
   - **Prioridad** (`<select>`: Baja/Media/Alta, mapping to `Low`/`Medium`/`High` — same `<option>` pattern `FilterBar.tsx` already uses for a closed BCF enum)
   - **Responsable** (text input, optional — free text, matching how `assignee` already behaves for imported topics: no validation, no user directory to pick from, since this app has no such directory anywhere)
   - **Capturar vista actual** (checkbox, default checked) — when checked, the dialog captures the live camera (`BCF_CREATE_TECHNICAL_DESIGN.md` Part 3's pattern) as the new topic's one viewpoint; when unchecked, the topic still needs *some* `viewpoints[0]` (an established invariant, per `BCF_CREATE_CURRENT_STATE.md` Part 1) — falls back to the same `DEFAULT_VIEWPOINT` constant `BcfImporter.ts` already uses for exactly this "no real viewpoint available" case, reusing an existing constant rather than inventing a second default.
4. **User clicks "Crear".**
5. **System response, in order:**
   - Build a `BcfTopic` from the form values + (optionally) the captured viewpoint, per the shape validated in this investigation.
   - Add it to `BcfManager`'s topic list — **requires a new method on `BcfManager`** (none exists today, confirmed in `BCF_CREATE_CURRENT_STATE.md` Part 1), e.g. `addTopic(topic: BcfTopic): void` doing `this.state = {...this.state, topics: [...this.state.topics, topic]}; this.notify();` — following the exact same immutable-replace-then-notify pattern every other `BcfManager` method already uses (`setActiveTopic`, `setFilter`), not a new pattern.
   - Close the dialog.
6. **UI changes that follow automatically, with no new wiring needed:** `IssueTable` re-renders with the new topic (it's just a new `BcfManagerState` subscription firing, the same mechanism that already updates the table on import) — **this "just works" once `BcfManager.subscribe()`'s existing listeners fire**, since `IssueTable`/`BcfPanel` never assumed topics can only arrive via `loadBcf`.
7. **Should the Detail Panel auto-open for the new topic?** Reasonable: call the existing `onTopicSelect`/`setActiveTopic` path (already wired end-to-end, Punto 1b) with the newly-created topic right after adding it — the exact same mechanism a user clicking a row already triggers, no new mechanism needed.
8. **User can export immediately** — `BcfPanel.tsx`'s existing "Exportar BCF" button already calls `bcfManager.exportBcf()` → `BcfExporter.create(project)` on `state.project`. **One real gap here, worth naming precisely:** `BcfManager.state.project` is set only by `loadBcf()` (`project = await BcfImporter.parse(file)`) — if a user creates a topic **without ever having imported a BCF file first**, `state.project` is still `null`, and `exportBcf()` explicitly throws (`if (!this.state.project) throw new Error("No hay ningún proyecto BCF cargado.")`, confirmed in `BcfManager.ts`). **This means "create a topic from a blank slate, no import, then export" does not work today** without also handling the case where no project exists yet — either `addTopic` needs to lazily create an empty `BcfProject` the first time it's called with no project loaded, or creating topics needs to require an existing (even empty) imported/exported project first. Flagged here as a concrete design question the implementation phase needs to resolve, not decided in this investigation.

## Export integration

**Minimal viable: export ALL topics** (old + newly created together) — this requires **no change to `BcfExporter.ts` or the "Exportar BCF" button's behavior at all**. `BcfExporter.create(project)` already serializes every topic in `project.topics` uninterested in *how* each one got there (imported vs. newly created) — confirmed structurally in `BCF_CREATE_TECHNICAL_DESIGN.md` Part 5.4 ("a created topic ... is, by construction, the same `BcfTopic` shape"). Selective export (only new topics, or a user-chosen subset) is real, extra, unrequested scope — not proposed here.
