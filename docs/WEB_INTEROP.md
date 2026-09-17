# Browser ↔ Android project contract

17 September 2026. Browser editor v0.9.0; companion Android v0.8.0. Plain v1 scenes remain compatible with Android v0.1.1.

**Studio 09 preview:** drone-show replay is transient browser state and does not add a drawing format version. The demo is generated from source-controlled vector formations; Replay my drawing derives a normalized preview from stroke centre lines. Export for phone still exports the unchanged artwork, not the show or an aircraft mission. Native Android has no drone-show player yet. [Show plan and boundaries](DRONE_SHOW_PLAN.md).

**Studio 08 extension:** optional paper `paperName` stores a label of at most 64 UTF-16 code units, excluding U+0000–U+001F and U+007F. A nonempty name requires a paper entity and **v6 / Android 0.8+**. Empty or omitted uses the material label and adds no version requirement. Both readers now accept v1–v6. Rename, duplicate, copy and export retain names; removing all names permits the lowest remaining version. Depth dragging uses the existing surface transforms and introduces no coordinate format. Local IndexedDB drafts wrap the ordinary project JSON with browser-only name/date/active-guide metadata; exported JSON remains the portable contract. [Plan and review](IMPLEMENTATION_PLAN_08.md).

**Studio 07 authoring helpers:** mirror and snap are baked into ordinary stroke points; depth and parallel-layer operations use existing parent transforms. See-through guide opacity and helper settings are local editor state, not saved materials or new schema fields. The native 0.6 reader renders and re-exports the resulting files unchanged. [Applied research and semantics](DRAWING_ASSISTS.md).

**Studio 06 extension:** v5 adds optional paper **paperVisible**. Omitted or true shows the background; false hides it while retaining the editable parent and all attached ink. Only a hidden paper requires v5; non-boolean values and non-paper false values are invalid. Both readers accept v1–v5; visibility survives undo, copy and export. Android 0.6+ is required for hidden-guide files. [Workflow and contract review](FLOATING_INK.md).

**Studio 02 extension:** blocks and non-solid stroke patterns use v2. V2 adds block `size: [x,y,z]` and optional `pattern: "solid" | "dash" | "dot"`. Both readers accept v1 and v2; exporters choose the lowest necessary version. Older Android versions intentionally reject v2 instead of silently dropping shapes. See [tools and logic review](EDITOR_TOOLS.md).

**Studio 05 extension:** version 4 introduces paper `bend`, `pitch`, `roll` and stroke `pointSpace: "surface"`. Points are unrolled `[u,v,0,pressure]`; stroke position/yaw/scale act within that sheet, while the parent positions and bends it in 3D. New local strokes need Android 0.5+, including flat ones. Old paper attachments migrate when their sheet is transformed. Both readers accept v1/v2/v3/v4 and preserve older file semantics. See [the v4 contract, workflow and review](CURVED_SURFACES.md).

**Historical Studio 03 extension:** paper uses v3. Add `type: "paper"`, `paperKind: "watercolor" | "rough" | "sketch" | "canvas" | "coated"`, and optional stroke `paperId`. Paper reuses `panelWidth`, `aspect`, `normal` and the common transform. Linked strokes retain their own transforms and points; renderers project them onto the paper. Parent edits propagate to attached strokes. Both readers accept v1/v2/v3; exporters choose the lowest required version. Paper requires Android 0.3+. See [paper semantics and review](PAPER_SURFACES.md).

**Studio 04:** curve and smoothed geometry are baked to ordinary stroke points. No new fields or version are needed. The `curves.json` browser sample round-trips through Android unchanged. New native authoring controls require app 0.4, while older compatible versions can load the resulting strokes.

## Architecture and engine decision

Use **Three.js** for the desktop browser editor, alongside the existing native Android prototype. The durable scene document is the boundary between engines. A browser does not need ARCore to author geometry: mouse/touch input intersects explicit drawing planes, with orbit controls for spatial inspection. Three.js WebGLRenderer requires WebGL 2; current browsers with hardware acceleration are the target. [Three.js renderer](https://threejs.org/docs/pages/WebGLRenderer.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html).

This adds a separate web UI and renderer, while retaining the same object semantics and limits. A future Unity runtime must import this contract; do not use a Unity scene, Three.js object dump, Blender file or baked GLB as the editable interchange format. The production engine gate in PLAN.md remains open: native Android + Three.js now adds maintenance cost for two renderers. Before migrating to Unity, assess whether the native runtime already meets the required game complexity. Preserve the file contract either way.

Local browser file selection/import and Blob downloads support a manual transfer workflow. Images are embedded, avoiding missing sidecar files or external asset URLs. The app never uploads project content. [Browser File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications).

## What moves between devices

| Data | Contract |
| --- | --- |
| Header | `version: 1`, `units: "metres"`, `coordinates: "right-handed-y-up"`, `alignment: "manual-origin-required"` |
| Coordinates | Right-handed, +Y up; local map origin; camera convention looks down −Z. No latitude/longitude or saved ARCore session handles. |
| Entity identity/order | Stable `id`; `type` is stroke, image, start, checkpoint or goal. Array order determines checkpoint order. |
| Transform | `position[3]`, `yaw` in degrees about +Y, uniform `scale`. Object point arrays remain in object-local coordinates. |
| Stroke | `brush`, signed 32-bit ARGB `color`, `width` in metres, `alpha`, `wet`, `surface`, unit `normal[3]`, and `points` of `[x,y,z,pressure]`. |
| Image | Raw Base64 in `image`, width/height `aspect`, `panelWidth` in metres, and cylindrical `arc` in degrees. No `data:` prefix. |
| All entities | Include every v1 entity field, even those unused by a given type, matching SceneData defaults. Non-image payload is an empty string. |
| Not transferred | Camera view, selection, undo stack, play progress, running effect time, room tracking map, physical location or permissions. |

Canonical scalar/vector fields are exported as float32 values. This avoids a subtle boundary mismatch: Java's `0.002f` is slightly greater than JavaScript's `0.002`, so exporting the JavaScript literal for minimum pen width would fail the phone's strict numeric validation. Signed ARGB is similarly explicit to prevent unsigned colour values exceeding Java's int range.

The base schema remains version 1; Studio 02 has an explicit version 2 extension. Additive editor-only metadata needs explicit review; never silently change coordinates/units or bump limits and assume older phones will load them. If unsupported primitives or incompatible semantics are introduced, introduce a documented new version and a migration path.

## Import safety and resource lifecycle

- Parse, validate all objects and decode every embedded raster **before replacing** the open scene. Invalid imports leave current artwork intact.
- Validate unique IDs, supported types/brushes, finite values, pressure/ranges, transformed object bounds and scene budgets. No executable snippets or asset URL loading.
- Inspect PNG/JPEG headers before decoding; reject oversized embedded rasters, mismatched aspect ratios and non-raster payloads. New photos are re-encoded as PNG with EXIF orientation applied by the browser decoder and resized to the phone budget.
- Preserve embedded pixel bytes for imported projects. New desktop photo imports may have different downsampled dimensions than importing the original photo directly on Android; both exports obey the same limits.
- Keep completed mesh buffers cached. Rebuild only edited objects, dispose removed GPU resources, cap pixel ratio and stop requesting frames after input/effects settle. Browser image loading is asynchronous; there is no cloud/network decoding service.
- One editor is authoritative at a time. Export/import is manual; concurrent edits are not merged. Keep separately named file versions if editing on multiple devices.

## Logic review fixes

1. **Browser AR confusion:** desktop authoring works without a camera. Native Android remains the gyro/AR viewer; no WebXR support or iOS native app is implied.
2. **Export mistaken for a screenshot:** persist editable source primitives, not pixels or engine meshes. Embed each image.
3. **Apparent room persistence:** phone import always needs a new origin for optional AR. A PC cannot establish a real-room pose from its canvas.
4. **PC content overwhelming the S9+:** enforce the same limits in both editors, including transformed image extent and total stroke samples.
5. **Float and colour incompatibility:** serialize float32 values and signed ARGB; verify a real browser download with the actual Android SceneData parser.
6. **Mismatched spray/drips after transfer:** reproduce Java's string hash and random generator in the web mesh builder.
7. **Scene erased by a bad file:** stage parsing and all image decodes before replacement; preserve the old scene on failure.
8. **Hollow marker missed by clicking its centre:** add a bounded spherical target around markers, while respecting nearer scene hits.
9. **Unnecessary battery usage:** no camera/sensor request in the browser and no perpetual animation loop. Native camera-free behavior is unchanged.

## Review scope still pending

Run one physical S9+ round trip: PC export → Android import → draw another stroke → Android export → PC open. Then repeat on the S22 Ultra/tablet when available. Verify EXIF photo variants, touch/stylus behavior and colour/transparency appearance as individual functions. Browser screenshots at tablet dimensions only verify layout; they are not physical-tablet evidence. No cloud service, public deployment, browser AR, automatic synchronization, full landscape-native Android UI, or production-grade crash recovery has been added.
