# Make the demo authorable in Draw in 3D

17 September 2026. Reviewed and implemented in browser Studio 10 / v0.10.0. The first authoring milestone and a basic real-time recorder are implemented. Advanced animation and offline encoding below remain future work. See the [user guide](SHOW_EDITOR_GUIDE.md).

## Review decisions and completed implementation

- Extract the original demo paths into editable source strokes on hidden paper guides. Automated comparison verifies that these sources reproduce the original sampled formations and timing.
- Keep the original drawing, selection, view, brush and undo history while temporarily editing a formation. Commit the result as one show-history edit; Cancel restores the formation. Artwork editing retains its own per-stroke undo. Show undo/redo restores the active card as well as the document.
- Use a separate `draw-in-3d-show` v1 schema and separate show-draft database. No change to Android drawing v1–v6. Capture includes required hidden parents and excludes unrelated objects. New/Open/Edit demo preserve older local show drafts.
- Fix automatic renormalization: store an explicit source origin, scale, rotation and stage position. Apply fitting only on capture or Fit to stage. Bound scale even for extremely short input. Validate stage extents before playback.
- Compile the bounded show on request in a worker, terminate obsolete work, reject stale revisions and time out failed compilation. Initial implementation recompiles the requested show; incremental matching caches are deferred until profiling justifies them. Dot previews use bounded samples on the main thread after committed edits.
- Deliver card drag reordering plus touch/keyboard Earlier/Later buttons, numeric timing controls, an overview timeline and the existing scrub-capable player. Timeline resize handles and ghosting of the previous formation are deferred.
- Preserve stroke-order ranks through drone assignment for Draw-on lighting. Verify position/colour continuity at minimum supported hold/transition durations and exact home landing with fireworks enabled or disabled.
- Add a 720p real-time browser recorder with supported-MIME detection, camera/control locking, memory budget, cancellation, hidden-tab/context-loss handling and restoration of the preview renderer. Prefer VP8 before VP9 to reduce encoding cost. Frame-exact export remains future work.

Review fixes included selection after duplicate/undo/redo, stale preview status on return, file-load races, recording resize interference, late recorder failure/size events, and formation bounds for very short strokes. Focused checks are recorded in [VERIFICATION.md](VERIFICATION.md).

## Product direction

Add a **Show Editor** built around **Draw → Arrange → Animate → Preview → Export video**. Users create the artwork and timing; the app generates the drone-point formations and interpolates the movement. They should not have to place 256 individual drones or redraw every video frame.

The first acceptance target is concrete: a user can open the existing demo as an editable project, redraw the robot, change the fish colour, reorder or replace the Eiffel Tower, adjust fireworks, play the complete result and save it. The same drawing and timeline concepts can later support other 3D animation modes.

## What already exists, and what is missing

At the Studio 09 starting point, drawing sheets, curves, shapes, symmetry, selection, transforms, undo, draft recovery, point sampling, assignment, trajectories, lighting and a seekable player existed. Demo figures were defined only in code, and `drawingFormation()` automatically recentred/resized a single scene. Studio 10 supplies the authoring layer and basic recording; motion keyframes remain future work.

Keep the player and drawing tools. Build the authoring/data layer between them. Treat a **paper sheet as a drawing guide**, and a **formation as a named collection of artwork**: one formation can contain strokes on several sheets. Changing a sheet must not implicitly create a new scene in the show.

## How a person would create this demo

1. Choose **New show**, or **Edit this demo** for an editable starting example.
2. In Draw, make the robot using rectangles, ellipses, curves and mirror. Select its strokes, choose **Add formation**, and name it Robot. The preview overlays the proposed drone dots.
3. Add another formation for Fish. Draw its body, fins, tail and eye. Compare the cards and stage preview to keep a consistent scale. Previous-formation ghosting is a later addition.
4. Add Eiffel Tower. Use straight lines, symmetry and the existing curve tool. Editable curve handles and locked tracing references are later additions.
5. Arrange the cards: **Takeoff → Robot → Fish → Eiffel Tower → Fireworks → Landing**. Each artistic card has a display duration; connectors have a transition duration. Takeoff/landing remain separate generated sections.
6. Set each formation's sky position, width, height and depth. Choose light behaviour: fade in, reveal along drawing order, bottom-up reveal or a colour wave. Keep lights off during ordinary transfers by default.
7. Adjust the fireworks preset's centres, radius, colours and duration. The preset uses the same fleet throughout.
8. Click **Play my show**, inspect it from the front and side, then save the editable show and export a video when recording is available.

## Features to add, in order

| Feature | User action and benefit | Delivery |
| --- | --- | --- |
| **Edit this demo** | Load robot, fish and tower as ordinary editable strokes and the show as editable cards. The demo becomes a tutorial and a regression fixture. | First milestone |
| **Formation cards** | Add from drawing/selection, name, thumbnail, edit, duplicate, delete, reorder and replace artwork. Each card preserves its drawing and required sheet parents. | First milestone |
| **Save/Open show** | Save artwork, formation placement, order, timing, LED settings and fleet definition together; recover local drafts. Separate from the existing drawing-only export. | First milestone |
| **Timeline / storyboard** | Drag cards to reorder; resize display/transition durations; inspect total duration and scrub the result. Provide move-left/right and numeric duration controls for touch/keyboard. | First milestone |
| **Drone-dot preview** | Display the sampled formation over the original strokes. Show how 256 drones are distributed and flag details that receive too few points. Keep original strokes editable. | First milestone |
| **Formation placement** | Move/rotate/scale in a shared stage; explicit Fit to stage. No automatic resizing after every small artwork edit. | First milestone |
| **Light cues** | Fade and draw-on reveal after arrival, preserve stroke colours, set brightness, and control transfer blackout. | First milestone, simple presets |
| **Drawing improvements** | Editable Bézier handles, named groups/parts, reusable shapes and locked tracing references. Existing tools can recreate the current demo; these improve precision and speed. | Second milestone |
| **Motion keyframes** | Set positions/rotations at two times and interpolate. Group robot parts so an arm can wave; animate fish translation or tail rotation. | Second milestone |
| **Draw a movement curve** | Sketch the route of a whole formation, with tangent/orientation preview and easing. Treat this separately from the lines defining its appearance. | Second milestone |
| **Camera track** | Save an audience view; optionally add camera keyframes. Keep free inspection orbit separate from the camera used for exported video. | Fixed view first; animated track later |
| **Video export** | Export the rendered performance without editor panels, with progress/cancel and a useful downloadable file. | Third milestone |

Desktop layout: formation cards on the left, drawing/preview viewport in the centre, active card properties on the right, timeline at the bottom. On phones, use Draw / Arrange / Preview tabs and a bottom properties sheet; do not squeeze every panel around the canvas.

The storyboard/formation separation follows the approach documented in [Skybrush's storyboard](https://docs.skybrush.io/public/skybrush-studio-for-blender/latest/panels/formations/storyboard.html). Its [formation tools](https://docs.skybrush.io/public/skybrush-studio-for-blender/latest/panels/formations/formations.html) also provide a useful reference for importing artwork and mapping it to fleet points. Our UI, storage and implementation remain our own.

## Technical design and logic issues to fix

**Retain source artwork.** Extract the demo's original coloured vector paths into reusable formation assets before sampling them. Convert those paths to ordinary editor strokes when opening Edit this demo. Do not try to reconstruct editable outlines from the 256 assigned drone points. Keep a fixed conversion between the demo's virtual-stage coordinates and the existing bounded drawing workspace.

**Use a separate show document.** Introduce a discriminated, versioned document such as `format: "draw-in-3d-show", version: 1`. Store fleet configuration, formation assets with source drawing snapshots, per-cue transforms, display/transition durations, LED presets, camera settings and a deterministic compilation revision. Existing v1–v6 drawing JSON and the native Android importer remain unchanged. Clearly label Export drawing versus Save show. A video is a rendered result, not the editable source file.

**Capture complete references.** Capturing selected strokes includes every referenced paper parent, even if that sheet is hidden. Unselected artwork does not leak into the formation. Duplicate a formation as an independent editable asset by default; an explicitly reused asset should disclose which cues share it. Switching cards restores their artwork and drawing target without discarding pending edits. Reordering/deleting/changing timing is undoable.

**Separate sampling from placement.** Refactor the current automatic normalization in `drawingFormation()` into source extraction, sampling and an explicit stage transform. Fit to stage establishes an initial transform once; moving one point must not unexpectedly change the size or origin of the entire formation. A show-wide stage transform supports consistent composition across cards.

**Compile identities once.** Preserve stable drone IDs and store a deterministic assignment for each transition. Animated parts use a stable set of samples bound to their group, rather than resampling/reassigning on every video frame. Maintain a fixed fleet count for the first milestone. Dots are generated display data, not hundreds of new editable drawing entities.

**Avoid stale previews.** Compile only committed relevant edits in a worker; include a project revision token. Cancel or discard older compilation results. Moving a card invalidates its affected transitions; colour-only edits should not recompute geometry or matching. Display a compiling/stale status instead of playing an older result as though it were current.

**Keep deterministic time.** Use one show clock for position, colour and camera. Seeking must reproduce the same frame. LED draw-on reveal should follow saved stroke order/direction after formation arrival; it need not physically send drones along the pen path. Formation motion and light animation need separate controls.

**Bound memory and storage.** Reuse batched geometry and typed buffers. Store shared asset revisions rather than a full copy per video frame or undo step. Validate each source scene against its existing limits and impose explicit whole-show limits for cues, bytes and cached previews. Start with the existing 256-drone budget and a short storyboard; raise limits after device measurement. Extend draft recovery with an explicit document kind so an older drawing loader cannot misread a show.

**Distinguish visuals from flight planning.** Preview assignment can minimize travel, but it is not collision avoidance. Minimum spacing, speed/acceleration/jerk and continuous trajectory validation remain the separate production gates in [DRONE_SHOW_PLAN.md](DRONE_SHOW_PLAN.md). Creating an attractive video must not imply a flight-ready plan.

## Video export design

For a first recording feature, render at a fixed export resolution and record the canvas with `captureStream()` plus MediaRecorder. Start the show from zero at 1× and use an explicit camera; exclude editor controls. Browser MIME support must be checked at runtime, and the filename extension must match the actual recorded container. Prefer a supported WebM option; offer MP4 only where the implementation supports it. Supported codecs may still fail under resource pressure. [Canvas capture](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream), [recording format detection](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static).

This initial path records in real time, so rendering stalls can affect the result. On hiding the tab or losing WebGL, pause/abort the recording cleanly with an explicit incomplete result; do not silently continue the clock and export missing scenes. Lock timeline edits for recording, support cancellation, release stream tracks, and restore the preview camera/renderer settings afterwards. A canvas capture includes canvas pixels, not HTML overlays; titles/subtitles require a deliberate composition layer. Start with silent video and a device-appropriate resolution.

For production export, sample the deterministic show at exact frame timestamps, apply encoder backpressure, encode in a worker where supported and mux the encoded output into a container. WebCodecs supplies low-level codecs, not a finished video file by itself. Codec support and container tooling need a separate implementation/compatibility review; provide a supported fallback rather than promising MP4 everywhere. [WebCodecs documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API).

## First implementation milestone and acceptance

Build **Edit this demo + formation capture/edit + storyboard timing + Save/Open show + Play my show** first. Add only the light presets needed to reproduce the existing demo. This makes the core authoring workflow usable before curve rigs, soundtrack synchronization or advanced encoding increase the scope.

Acceptance scenario: open the demo, redraw the robot's eyes, recolour the fish, replace the tower with a heart, reorder two cards, change a hold and transfer duration, undo/redo, save/reopen, and replay through landing. Confirm the original drawing remains recoverable, all drone identities persist, placement is stable, hidden-sheet ink is preserved and obsolete worker results cannot replace the latest preview. A subsequent export check verifies duration, first/last frames, cancellation and camera restoration on supported browsers. Keep these focused checks rather than beginning with an exhaustive test matrix.
