# Studio 10 follow-up code and logic review

Reviewed commit `dca4fc64019af494db569de6ac072c01d19ee0a3`, 17 September 2026. Scope: show authoring, source capture/validation, immutable history, worker cancellation, draft recovery, playback, framing and recording. The fixes described here are included in the Studio 10 follow-up update.

## Findings and fixes

1. **P2 — Failed saves become inaccessible when storage listing also fails.** `ShowEditor.recover()` awaited `store.list()` before merging `DraftWriter.failed`. When IndexedDB was unavailable, control skipped the memory-only snapshots and only showed an error. A user who switched shows could not download the earlier failed save from the recovery shelf. Catch listing failure separately and still expose failed snapshots with Restore/Download. Regression: a failed list operation and a memory-only record produce a usable recovery row.

2. **P2 — An asynchronous draft restore can replace newer edits.** A slow `store.get()` completed with no revision check, unlike Open show. Editing or replacing the show during that read was followed by an unexpected document replacement. The old implementation retained an undo path, but still surprised users and could supersede their current work. Move restore into `loadDraft()` and reject stale revisions; independent draft downloads remain allowed. Regression: defer the read, advance the revision, resolve it and verify that replacement never occurs.

3. **P2 — Late recording failures leave a misleading completion state.** `finish(false)` clears `active` before the final recorder data/error callbacks. A final chunk crossing the memory limit, or an encoder error during finalization, called `finish(true)` when it could no longer update the status. No usable file was produced and “Finishing video…” remained visible. Centralize failure reporting independently of active capture, discard failed chunks, and explicitly report empty output. Regression: drive actual recorder handlers with a controlled MediaRecorder substitute after stop; verify size/error/empty outcomes, no download and unlocked controls.

4. **P2 — Fixed front camera crops permitted formations.** The old front position was fixed at approximately `[0,16,62]`. Valid authoring positions near the top or sides of the stage could be outside the frame, including in fixed-camera recordings where users could not correct it. Frame the combined trajectory endpoint bounds, including landing, account for aspect ratio and preview offset, and preserve orbit/front mode when recording ends. The trajectories interpolate between these endpoints, so their bounds cover intermediate positions. Regression: project high, wide and deep authored formations and landing into landscape, video and portrait camera frusta and verify all endpoints remain inside.

## Verification

- 40 web unit tests pass, including four new focused regressions.
- Production build and `git diff --check` pass.
- Show Editor browser flow passes: edit/cancel, history, save/open, new formations, worker cancellation, mobile layout, recovery and original drawing preservation.
- Existing drone player flow passes: original demo figures, seek/pause/replay/speed, orbit, mobile viewport, curved drawing conversion and repeated entry/exit.
- Full real-time video encoding was verified during Studio 10 implementation and was not repeated in this review. This review adds controlled tests for finalization failures and camera geometry.

No further blocking issue was identified in the reviewed paths. This is not a guarantee of defect-free operation: physical Galaxy performance, browser-specific codecs, animated rigs, real-flight constraints and vehicle control remain outside this verification.
