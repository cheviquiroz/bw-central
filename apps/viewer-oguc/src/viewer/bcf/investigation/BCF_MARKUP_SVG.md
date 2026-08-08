# BCF_MARKUP_SVG.md — SVG handling, current state

Investigation only, no code changes.

## Is `markup.svg` parsed at all?

No — established definitively in `BCF_SNAPSHOT_PARSING.md`: `bcf-core` has no SVG-related parsing anywhere (grepped `reader.ts` for `svg`/`Svg`/`SVG`: zero matches beyond this investigation's own new doc files). This app's `BcfTopic.markup.svg?: string` field exists in the type but is never assigned by `adaptTopic()`. There is no code path, real or broken, that produces an SVG string from a `.bcf`/`.bcfzip` file today.

## What would `markup.svg` contain, per the BCF spec, if it were implemented?

Not verified against real data (no fixture with this feature was found — see `BCF_SNAPSHOT_CONSTRAINTS.md`), but per the BCF standard's own definition (2.1/3.0 schema, `Visualization Info` / markup extensions some authoring tools use): this would be 2D vector annotations — revision clouds, arrows, text callouts, freehand markup — drawn by the reviewer **on top of** their snapshot at authoring time, meant to be overlaid on that same 2D image, not on the live 3D view. This is conceptually distinct from `viewpoint.clippingPlane` (a real, already-parsed 3D construct) and from the pin/camera-jump mechanism entirely — it's a 2D-image annotation layer, not 3D geometry.

**Where should it render, if implemented?** Logically over the 2D snapshot image specifically (as an `<svg>` overlay positioned absolutely on top of an `<img>`, matching how virtually every BCF-viewer reference implementation handles it) — **not** over the live 3D viewport. The 3D viewport is showing the *current* live model from the *current* camera angle; a 2D annotation drawn by a reviewer against their own snapshot's specific pixel coordinates has no defined mapping onto a different (possibly since-changed) 3D view. Overlaying it on the 3D viewport would require it to only appear while camera position/FOV exactly match the original snapshot's — fragile, and not how any known reference viewer does it either.

## Security flag (per this task's own explicit ask)

If `markup.svg` is ever implemented, **it must not be injected as raw HTML/`dangerouslySetInnerHTML`.** An SVG string from an untrusted `.bcf` file (BCF files are commonly shared between multiple firms/reviewers on a project, not necessarily from a trusted source) can contain `<script>` tags or event-handler attributes (`onload=`, `onclick=`, etc.) that execute arbitrary JS in the viewer's origin if rendered unsanitized. This is a real, concrete OWASP-relevant risk for any future implementation, not a hypothetical — flagged explicitly per this investigation's instructions, and carried into `BCF_SNAPSHOT_RENDERING_PLAN.md`'s risk section. No sanitization library is a **direct** dependency of `apps/viewer-oguc` today (checked `package.json`) — correction after checking the lockfile more carefully: `dompurify` *is* present in the monorepo's `pnpm-lock.yaml`, but only as an optional transitive dependency of `jspdf` (used by `report-core` for PDF export), not something `viewer-oguc` can safely `import` today under pnpm's strict dependency resolution. It would need to be added as a real, direct dependency of `viewer-oguc` (or `report-core`'s existing transitive copy formally promoted) if this feature is ever built — flagging the distinction so a future implementer doesn't assume `import DOMPurify from "dompurify"` will just work because the package happens to already be in `node_modules` somewhere in the tree.

## Conclusion

Nothing to analyze beyond "doesn't exist" — this doc exists primarily to answer the brief's specific questions plainly (no, not parsed; conceptually 2D-image overlay, not 3D; flagged as a real injection risk before any implementation) rather than leave them unaddressed.
