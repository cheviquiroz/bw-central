# BCF_CREATE_CURRENT_STATE.md — Parts 1, 2, 4

Investigation only, no code changes. All findings below are from direct code reads plus one temporary, since-deleted test (see `BCF_CREATE_IMPLEMENTATION_PLAN.md`'s validation section for its results) — nothing here is guessed.

---

## Part 1: Current BCF topic creation capability

**1. `BcfExporter.ts`** — path: `apps/viewer-oguc/src/viewer/bcf/BcfExporter.ts` (the only file by this name in the repo). **Finding: does not exist.** Grepped for `createTopic`/`newTopic`/`addTopic`/`CreateBcfTopic`: zero matches. `BcfExporter` only has one static method, `create(project: BcfProject): Promise<Blob>`, which **serializes an already-fully-built `BcfProject`** — it has no notion of constructing one from partial/user-entered fields. It's a pure "domain object → bytes" adapter, symmetric with `BcfImporter`'s "bytes → domain object," per this file's own header comment.

**2. `BcfManager` (topic storage/mutation)** — path: `apps/viewer-oguc/src/viewer/bcf/BcfManager.ts`. **Data structure:** a private `state.topics: BcfTopic[]` (plain array) inside a hand-rolled pub/sub class (`Set<listener>` + `notify()`), not React state/Context, not immutable in any enforced sense — `loadBcf()` replaces the whole array wholesale (`this.state = {...this.state, project, topics: project.topics, ...}`). **Mutation API, exhaustively listed (every method on the class):** `subscribe`, `loadBcf(file)`, `exportBcf()`, `setActiveTopic(topic)`, `setFilter(status)`, `getState()`. **No `addTopic`/`createTopic` method exists.** The only way `state.topics` ever changes is a full wholesale replacement via `loadBcf`.

**3. `BcfTopic` type** — path: `apps/viewer-oguc/src/viewer/bcf/types/bcf.ts`.

| Field | Required? | Type | Sensible default if omitted |
|---|---|---|---|
| `guid` | Required | `string` | `crypto.randomUUID()` (already used this exact way in `BcfImporter.ts`'s `BcfImporter.parse` for `project.guid`) |
| `title` | Required | `string` | none — must be user-entered |
| `description` | Required (not optional in the type, but can be `""`) | `string` | `""` |
| `createdAuthor` | Required | `string` | Could default to `"Unknown"` (matches `BcfImporter.adaptTopic`'s own fallback for missing import data) - but for a *created* topic, there's no currently-known "logged in user" concept anywhere in this app (no auth) - see gap noted in the Technical Design doc |
| `createdDate` | Required | `string` | `new Date().toISOString()` |
| `priority` | Required | `BcfPriority` (`"Low"\|"Medium"\|"High"`) | `"Medium"` (a reasonable, unsurprising default) |
| `status` | Required | `BcfStatus` (`"Open"\|"Pending Review"\|"Resolved"`) | `"Open"` (the only sensible default for a brand-new topic) |
| `assignee` | Optional | `string \| undefined` | omit |
| `topicType` | Optional | `string \| undefined` | omit, or a fixed value like `"Issue"` |
| `viewpoints` | Required, **must be non-empty** (per this app's own established invariant — see `BcfImporter.adaptTopic`'s comment: "consumers can safely read `viewpoints[0]` without a length check") | `BcfViewpoint[]` | at minimum one viewpoint, captured from the live camera (Part 3) |
| `comments` | Required | `BcfComment[]` | `[]` |
| `markup` | Optional | `{snapshots?, svg?}` | omit — nothing populates this anywhere in this pipeline (established in the Punto 1b investigation) |

**Can a valid `BcfTopic` be constructed with only required fields? Yes — tested, not just asserted.** A temporary test (`_temp_create_topic_investigation.spec.ts`, written, run, and deleted as part of this investigation — nothing committed) built exactly this minimal shape and confirmed both `BcfExporter.create()` accepts it without throwing, and `bcf-core`'s real `parseBcf()` re-imports the exported bytes cleanly, correct `title`/`status`/`priority`/one `viewpoint` all round-tripping intact. See `BCF_CREATE_IMPLEMENTATION_PLAN.md` for the exact structure and the logged re-imported JSON.

---

## Part 2: Element reference and selection

**1. BCF element reference format** — path: `packages/bcf-core/src/types.ts`. `BcfTopic` (this app's own type) **has no field for related elements at all** — grepped for `components`/`elements`/`references` on `BcfTopic`: none. But the underlying capability exists one layer down and is silently dropped: `bcf-core`'s `CoreBcfViewpoint` **does** have it —
```ts
// packages/bcf-core/src/types.ts
interface BcfComponent { ifcGuid: string; originatingSystem?: string; authoringToolId?: string; }
interface BcfComponents { selection: BcfComponent[]; coloring: BcfColorGroup[]; }
// CoreBcfViewpoint: components: BcfComponents
```
Format: **IFC GUID strings** (`ifcGuid`), not local numeric IDs — this is the real BCF-spec format (`<Component IfcGuid="...">`). Confirmed: `BcfImporter.ts` never reads `vp.components` (grepped, zero matches for `components` in that file) and `BcfExporter.ts` always writes it back empty (`components: { selection: [], coloring: [] }`, hardcoded). **This app's element-selection data is silently discarded on both import and export today**, a real, pre-existing, separate gap from topic creation itself.

**2. Current element selection in viewer** — path: `apps/viewer-oguc/src/viewer/SelectionManager.ts` (interaction/bridging logic), `apps/viewer-oguc/src/engine/createApplication.ts` (the actual state). **What ID is stored:** confirmed via direct code read — `SelectionManager.ts` builds `elements.push({ guid: elementGuid, localId: expressId, data: elementData })` — **both** a real IFC GUID and a model-local numeric ID (`expressId`) are already tracked side by side for every selected element. `ApplicationInstance.getSelection(): SelectionState` returns `Record<modelId, string[]>` (GUIDs, keyed per model) and `getSelectedElementsData(): SelectedElement[]` returns the richer `{guid, localId, data}` objects. **Consistent across federated models:** yes, by construction — the state is already keyed per `modelId`, exactly the shape needed to reference elements across more than one loaded model. **How to retrieve it:** `app.getSelectedElementsData()` (already a real, existing, callable method on the same `ApplicationInstance` every other feature in this app already uses).

**3. Decision: is element reference required for MVP?** **No — not required.** A valid `BcfTopic` (Part 1) has no element-reference field at all in this app's own type; the underlying BCF-spec capability (`components.selection`) exists in `bcf-core` but is already, today, silently dropped by this app's own adapters for *every* topic, imported or exported, whether created by a human in another tool or not. Adding element-reference support to a *new* creation feature would mean building capability this app doesn't have anywhere else yet (reading `components` on import, writing it on export) — a strictly larger scope than "let a user create a topic." **Recommendation: skip element reference for MVP**, consistent with how the rest of this app already treats that data (it's a real, acknowledged, pre-existing gap, not something creation-specific work should be blocked on).

---

## Part 4: UI location and interaction flow (readiness assessment)

**1. Current BCF UI** — path: `apps/viewer-oguc/src/ui/BcfPanel/BcfPanel.tsx`. The "Importar BCF" button lives in `.bcf-header-actions`, a row inside `.bcf-header`, driven declaratively by `BCF_PANEL_MODULES = getModulesForSurface("bcf-panel")` (the shared module registry, `apps/viewer-oguc/src/ui/registry/modules.ts`) — **not** hardcoded JSX, a data-driven list of `ToolbarButton`s. **No "create"/"add" affordance exists today** — confirmed, the registry has exactly two `surface: "bcf-panel"` entries (`bcf-import`, `bcf-export`), no third.

**2. `IssueTable`/`BcfDetailPanel`** — **No "create new topic" button exists anywhere.** `BcfDetailPanel.tsx` (built in Punto 1b) only ever renders when `activeTopic !== null` (`if (!activeTopic) return null;`) — it has no "empty" state UI at all today, so there's no existing "nothing selected, offer to create one" moment to hook into without adding one. `IssueTable`'s own empty state (`EmptyState` when `topics.length === 0`) already has literal copy promising exactly this feature — *"Importa un archivo BCF o **crea una nueva incidencia**"* — a promise with zero implementation behind it, flagged as a known gap back in the very first BCF investigation this session. This task is the first one actually positioned to close that specific gap.

**Where would "Create Topic" fit naturally?** The registry pattern (`BCF_PANEL_MODULES`) is the path of least resistance and highest consistency: a third entry, `{id: "bcf-create", label: "Crear incidencia", surface: "bcf-panel", ...}`, next to the existing `bcf-import`/`bcf-export` — same header row, same button styling, zero new layout code needed, following an already-established, three-times-proven pattern (import/export already work exactly this way).
