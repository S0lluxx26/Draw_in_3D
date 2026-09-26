# Studio 23 review fixes

- Demo settings handed to **Edit in Show editor** remain intact even before they are saved. Reopening an untouched Demo follows saved settings only when those settings actually change; edited shows remain intact.
- A single pointer owns each formation-designer gesture. A second finger cannot replace, finish or cancel the first finger's stroke. Losing capture, cancelling, changing tools or switching cues clears the gesture safely.
- Show files preserve word, mirrored-stroke and filled-shape groups. Duplicates get independent groups, and Undo/Redo preserves them. Files saved by older versions cannot recover group metadata that was never stored. This metadata belongs to show files, not standalone drawing exports.
- Automatic camera movement no longer bypasses the battery-mode 30 FPS limit. Manual camera input still requests a redraw, and paused orbit damping can settle before rendering stops.

Focused regression coverage: `web/test/review-regressions.test.mjs` and `web/scripts/review-fixes-smoke.mjs`. The browser check covers settings handoff, fresh-page save/reopen, grouped selection, Undo, camera redraws and the frame cap. Android hardware performance remains a separate device check.
