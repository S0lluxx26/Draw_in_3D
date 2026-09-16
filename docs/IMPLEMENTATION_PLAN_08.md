# Studio 08 implementation plan

16 September 2026. Scope: make the existing multi-sheet drawing workflow easier to resume, organize and place in depth. This is a prototype increment, not a claim of AAA readiness or measured phone performance.

## Research and decisions

The [previous research](DRAWING_ASSISTS.md) identified named reusable guides and direct depth manipulation as the next practical improvements. [Feather's guide interface](https://support.feather.art/docs/3dguide/interface) provides the guide reuse/placement reference. Our implementation uses the existing sheet geometry and an accessible depth slider rather than adding a heavy transform system.

For local recovery, use [IndexedDB transactions](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB). Image-containing scenes can exceed practical localStorage sizes. Only report success after the write transaction completes. [Browser storage can be evicted](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), so keep explicit JSON export and label recovery as local to this browser. Saving on committed edits is primary; [visibility changes](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event) provide an additional best-effort flush.

## Implementation sequence and acceptance criteria

1. **Local drafts:** debounce writes after committed edits, serialize writes, preserve separate drafts across New/Open and tabs, show saving/saved/error states, and expose Restore, Download and Delete in a draft list. Startup offers recovery without replacing artwork. Store lightweight list metadata separately from scene payloads. Never silently remove older drafts. Storage failure leaves drawing/export usable and offers Retry. Restoring validates the project and prepares images before replacing the scene; history restarts and the recovered scene is marked unexported.
2. **Named guides:** add an optional bounded `paperName` field, an undoable rename control, and names in sheet choices, focus feedback and the scene list. Blank means the existing material-based label. Preserve names through duplication and transfer. Use project format v6 only when a name is present; update Android's parser, copy, serializer and paper list. Older unnamed projects keep their existing format.
3. **Drag depth:** add a relative -1 m to +1 m range control with centimetre feedback. Freeze the current view direction at drag start; preview moving the parent and attached ink without rewriting surface-local points. Release creates one history entry. Esc/pointer cancellation restores the original scene; returning to zero creates no entry. Validate each preview against existing map bounds. Keyboard arrows provide the same operation. Keep existing step buttons and blank parallel guides.
4. **Review:** inspect async save ordering/failure handling, document switching and multiple tabs; schema/version gates and text safety; depth cancellation, undo, bounds and interaction with other tools. Fix actionable issues before committing.
5. **Focused verification:** unit tests for the new persistence queue and schema; one browser workflow for recovery, naming, live depth/cancellation/undo, narrow layout and export; existing drawing-helper regression; Android round-trip/build checks. Avoid broad unrelated testing. Record actual results and limitations, then commit, push and verify the existing Pages deployment.

## Performance and boundaries

No continuous autosave polling, camera access or render loop. Save after a short idle period and render on interaction. Reuse existing child geometry for parent movement. Draft recovery does not synchronize devices, retain undo history or replace exported backups. Depth is virtual scene placement, not IMU position tracking. Physical S9+/S22 Ultra battery and frame-rate evaluation remains a later device pass.

## Completion record

Steps 1–4 are implemented and reviewed. Step 5's local checks pass; commit/push and Pages deployment follow those checks.

### What to use

- **Drafts** in the top bar opens the recovery shelf. Edits save after one idle second. Restore keeps the original draft and starts a separate working copy. Download exports a draft without replacing the canvas. Delete removes only that local draft. Multiple tabs and New/Open receive independent IDs. Nothing is uploaded or automatically deleted.
- **Paper & surface → Sheet name** gives the active guide a label. Rename is undoable. Names appear in Paint on, focus feedback, the scene list, draft summaries and Android's paper picker. Blank restores the finish-based label. Native Android 0.8 reads/displays/preserves names; the rename control is currently on web.
- **Drawing helpers → Drag depth from this view** previews the whole guide and its ink. Farther is left, nearer is right. It works on flat, curved and hidden sheets. Release applies one undo step and recentres the slider. Esc or pointer cancellation restores the starting scene. Arrow keys move one centimetre per step. Map-boundary feedback retains the last valid position.

### Code review and logic review

1. **Save ordering:** the original commit function marked dirty before assigning the new scene. Scheduling there would capture the old state. Moved the dirty/save call after the entity and active-guide assignment. Each queued job captures its document and immutable committed scene; it never reads a later document's globals. Gestures and depth previews do not enqueue partial edits.
2. **Async races:** one writer serializes transactions, coalesces repeated edits per document and suppresses stale success reports. A failure remains retryable without blocking later documents. A transaction must complete before the status says Saved. Scene and summary updates share the same transaction. New/Open use new IDs; restore also clones to a new ID, preventing tab collisions and accidental replacement of the recovery source.
3. **Failure visibility:** switching documents originally could hide an earlier document's save failure. Fixed the status to show any outstanding failure. The shelf includes those in-memory drafts and permits Download/Restore; Retry attempts all failed writes. Closing the tab still loses memory-only data, so the shelf explicitly marks it NOT SAVED. There is no claim of guaranteed storage under eviction, browser crash or an immediate close before saving.
4. **Recovery safety:** validate and prepare images before replacing the active scene; cancel leaves it untouched. A corrupt or concurrently deleted draft reports an error. Draft list requests have a generation token so overlapping refreshes cannot append duplicate or stale rows. User-supplied names use textContent/Option, never HTML interpolation. Saved payloads stay out of the list store.
5. **Schema correctness:** paperName is optional, at most 64 UTF-16 code units, and excludes control characters. A nonempty name requires a paper entity and v6. Both readers reject invalid/down-version data. Android's version accumulator now uses max for hidden-guide v5, preventing a later hidden sheet from downgrading a v6 document. Copy and serialization retain names. Existing v1–v5 documents remain readable, and blank names add no version requirement.
6. **Depth semantics:** freeze the camera direction and starting snapshot for the gesture. Every preview derives from that origin rather than accumulating rounding error. Returning to zero or cancelling adds no history. Pre-localize legacy ink once per depth gesture, then reuse child point data and cached geometry while moving the parent. Bounds validation rejects an invalid preview without losing the last valid scene. Existing step and mirror/snap operations continue to work.

### Verification performed

- **27 web unit tests pass**, including coalescing, slow-write ordering, separate documents, retry after storage/serialization failure and name validation/versioning. Web production build passes.
- **Focused Chromium flow passes:** naming with undo/redo, curved attached ink, live depth, single-step undo, keyboard movement, Esc/pointer cancellation, zero return, map bounds, reload recovery, multi-tab separation, restore/download/delete, and a 412 × 915 layout. Desktop and narrow screenshots inspected. No browser errors.
- **Storage fault flow passes:** injected quota/write failure stays visible after New; the earlier draft downloads from memory; Retry persists both documents; corrupt stored JSON does not replace the active scene.
- **Existing drawing-helper regression passes:** mirrored/smoothed strokes, snapping, translucent guides, stepped depth, parallel layers, mobile drawing, export/reopen and free-space tools.
- **25 Android JVM tests pass.** Android 0.8 debug build and lint pass with 0 errors and 16 existing warnings. The actual browser fixture samples/named-guides-v6.json survives native decode, finite ink geometry, copy/export and web re-import with every persisted field unchanged.

No physical S9+/S22 Ultra run, frame-rate/battery benchmark, browser eviction simulation or exhaustive device/browser matrix was performed. Local drafts and the new depth/name authoring controls are web features. Android 0.8 is required to read named-sheet files. Browser IMU and Camera AR remain outside this increment.
