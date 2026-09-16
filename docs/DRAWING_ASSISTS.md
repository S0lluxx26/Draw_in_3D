# Research applied: drawing helpers

16 September 2026 · Web Studio 07 · compatible with Android 0.6 and existing v1–v5 files.

## What changed

The next prototype increment concentrates on placement and accuracy. All four features are available in the web editor, including a phone/tablet browser. Generated artwork opens in the existing native Android app; the new helper controls themselves are web features.

| Research source | Observed interaction | Applied in our app |
| --- | --- | --- |
| [Feather: 3D Guide interface](https://support.feather.art/docs/3dguide/interface) | Guides have adjustable translucency so they obstruct the artwork less. | **See-through guides** reveals other ink while keeping a visible drawing surface and active boundary. It is an editor view setting; saved paper materials remain unchanged. |
| [Feather: Mirror](https://support.feather.art/docs/assistance/mirror) | Axis-based symmetry reduces repetitive sketching. | **Mirror new strokes** offers left/right and top/bottom symmetry around the active sheet centre. A gold line shows the axis and the partner appears during drawing. |
| [Gravity Sketch: Mirror](https://help.gravitysketch.com/hc/en-us/articles/5912776412445-mirror) | Mirroring generates a counterpart; baked geometry can subsequently be edited independently. | Our pair becomes two ordinary editable strokes on release, with one undo step for both. This avoids a new modifier system or file dependency. |
| [Open Brush: Grid and Angle Snapping](https://docs.openbrush.app/user-guide/grid-and-angle-snapping) | Predictable positional increments and alignment help construct regular structures. | **Nearer/Farther** use explicit depth steps, and **Add parallel sheet** creates the next blank drawing layer. Existing grid/angle constraints remain available. **Snap stroke ends** is our adaptation of the broader constraint-based approach, not a claim that this source describes our endpoint feature. |
| [Feather: Stable Strokes](https://support.feather.art/docs/assistance/stablestrokes) | Adjustable stabilization makes strokes cleaner. | We retained existing stabilization and Smooth on release, and verified that smoothing preserves snapped endpoints and mirrored pressure profiles. |

These are primary-source feature comparisons, not independent app benchmarks. We implemented our own interaction and geometry code; no third-party artwork, interface assets or app code were copied.

## Using the helpers

Add or choose a sheet in **Paper & surface**. Open **Drawing helpers** below the paper visibility controls.

- **See-through guides:** turn it on to reveal strokes behind paper. It also clears Focus sheet so other sheets' ink remains available as context. Turn it off for normal paper appearance. Panorama preview and map play use actual saved sheet appearance. Hidden paper stays hidden.
- **Mirror new strokes:** select Left ↔ right or Top ↔ bottom, then Draw, Line, Curve, Rectangle or Ellipse. Symmetry follows the unrolled sheet, including after bending or tilting it. Both sides are previewed live. Undo or Esc handles the whole pair. After release, either stroke can be selected and edited independently; existing strokes are not automatically mirrored when enabling the setting.
- **Snap stroke ends:** works with Draw, Line and Curve on the active sheet. Approach an existing endpoint and look for the gold ring. Starting or ending there uses that exact sheet coordinate. Freehand only snaps at the start/release, preserving the motion in between. Shift bypasses endpoint snapping and retains the existing shape constraints. Endpoint snapping takes precedence over grid snapping when an endpoint is acquired.
- **Nearer / Farther:** choose 1, 5, 10 or 25 cm and move the active sheet along the current viewing direction. All its ink moves with it. Camera orientation and paper orientation are unchanged. Undo returns to the previous position.
- **Add parallel sheet:** creates a blank copy of the active guide one depth step nearer. Its size, bend and orientation are retained; the original ink stays on the original sheet. The new guide becomes active, other artwork remains visible, and See-through guides switches on for tracing.

Example: sketch a side profile, enable left/right mirror to draw a balanced front detail, add a parallel sheet 10 cm nearer for another layer, then View 3D ink and Orbit to inspect depth. For a new angle instead of a parallel layer, Orbit and use the existing **Add a paper sheet** action.

See-through, mirror mode, snap mode and step size are local editor choices. Exported files contain the resulting geometry and persistent sheet visibility, not those tool settings. Continue to export before closing or refreshing; this increment does not introduce autosave.

## Logic review and fixes

**Mirror correctness:** reflection happens in sheet coordinates, not camera or world coordinates. Both stroke position and path are reflected, and in-sheet rotation changes sign. Pressure, brush, width, grain and paper attachment remain intact. Bending the parent later still works. Mirrored geometry is baked into the existing surface-point format, so there is no new file version.

**Overlapping reflections:** a stroke on the centre axis, a centred line, or a closed outline may coincide with its own reflection. The helper compares forward/reversed paths and cyclic closed paths, including pressure, to avoid painting the same outline twice. Asymmetric pressure can still produce a distinct mirrored stroke.

**Atomic edits and capacity:** live previews use a stable partner ID. Release records both strokes in one history entry; cancellation restores the original scene. The point and object budget reserves room for two strokes before starting, including smoothing's extra samples. Near the limit, the UI asks the user to remove content or turn Mirror off. The limits remain 80 objects, 4,000 total points and 384 points per stroke. This reservation is conservative even when a completed mirror would overlap exactly.

**Safe snapping:** only endpoints on the active sheet are candidates. Cropped endpoints, points behind the camera and candidates on the inaccessible side of a curved guide are excluded. Mouse tolerance is 14 CSS pixels; touch tolerance is 22. This stays predictable under zoom. Cross-sheet snapping is deferred because an endpoint at another depth cannot safely be attached merely because its screen position is nearby. Endpoints are matched geometrically; their strokes are not welded into one object or constrained to move together later.

**Depth and blank layers:** depth edits reuse the parent transform operation, preserving stored child coordinates. A parallel sheet gets a new ID and no children. Both operations validate the shared four-metre map bounds before committing. This does not infer physical phone motion or require the camera.

**Rendering:** see-through mode changes paper material opacity/depth writing in the editor only. It retains ink textures and shape. Mirror increases visible stroke work, but all points still count against existing limits; the app continues to render on input and for bounded wet-paint effects. The gold axis is one cached line, rebuilt only when the active sheet or mirror mode changes. Endpoint search examines at most two ends per stroke, rather than scanning every stored point. Physical device performance has not been measured in this increment.

## Verification

24 web unit tests pass. A focused Chromium flow covers live mirror preview, cancellation, paired undo/redo, both symmetry axes, curved guides, smoothing with exact endpoint snapping, see-through rendering without file changes, depth movement/undo, blank parallel sheets, a 412 × 915 viewport, export/reopen, and ordinary free-space/grid tools. The hidden-sheet workflow also passes. Browser errors: zero. Desktop and narrow layouts were visually inspected; new depth/helper controls have at least 44 px touch targets in the narrow layout.

22 Android JVM tests pass. The actual browser fixture `samples/drawing-assists.json` loads through the unchanged native scene parser, produces finite ink vertex data, survives copy/export, and returns to the web with every persisted field unchanged. Native code/APK remains 0.6.0. This verifies format and geometry compatibility; it is not a physical Android touch or performance test.

## Next decisions

The next usability pass should test a small chair or room outline on the S9+ and S22 Ultra. Prioritize local draft recovery, named guides and a drag-based depth handle if the current steps become cumbersome. Then evaluate cross-sheet endpoint placement with explicit depth feedback and sphere/mesh guides. Live linked symmetry, editable curve control points and arbitrary surface projection need separate data and interaction designs. Keep those distinct from the working baked-stroke prototype.
