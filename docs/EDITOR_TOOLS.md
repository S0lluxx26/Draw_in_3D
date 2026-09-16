# Studio 02 — drawing and selection tools

Studio 04 also adds [Curve (Q), optional smoothing on release and smoothing selected strokes](CURVES_AND_SMOOTHING.md).

16 September 2026. Studio 02 feature record. The current Studio 03 / Android 0.3 update adds [paper surfaces and attached painting](PAPER_SURFACES.md); the controls below remain available.

| Tool | Behavior | Shortcut |
| --- | --- | --- |
| Freehand | Five brushes, solid/dashed/dotted styles, stabilization, even/tapered profile, optional wet drips | D |
| Line | Drag endpoints; Shift constrains the angle to 15° steps | L |
| Rectangle / ellipse | Drag the bounds; Shift makes a square/circle; stored as editable outline strokes | R / C |
| Solid block | Drag a base on Wall/Floor/Side; set depth first; select to edit XYZ dimensions | G |
| Select | Pick an object or scene row; Shift-click adds/removes objects | V |
| Box select | Drag a rectangle; Shift adds, Ctrl/Cmd subtracts; includes overlapping projected bounds at any depth | B |
| Move | Drag the selection on a view-facing plane; optional 10 cm grid snapping | M |
| Erase | Cut stroke segments or erase whole objects; existing selection limits scope | E |
| Orbit / frame | Orbit, pan, zoom; Fit frames the selection or scene | O / F |
| Duplicate / delete | Operate on the selection; Start/Goal cannot be duplicated | Ctrl/Cmd+D / Delete |
| Undo / redo | 30 operations; restores the relevant selection; one drag is one step | Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z; Ctrl+Y also redoes |
| Cancel | Roll back the current drag; when idle, clear selection or exit play | Esc |

Profile and stabilization apply to new freehand strokes. Taper is stored in pressure samples. Brush/style/colour/opacity changes update selected compatible objects; otherwise they set drawing defaults. Shape creation and movement can snap to 10 cm increments; guide squares remain 50 cm.

Group transforms pivot around the mean of selected object origins. Inspector XYZ sets that pivot position. For multiple objects, yaw adds a rotation and scale multiplies the group. Selection is temporary; no persistent grouping/layer objects are added to the file.

## Logic review and fixes

1. The eraser clips whole line segments against the swept brush capsule, so even sparse two-point lines erase.
2. Retained pieces become separate entities and never reconnect across the erased gap. The first retains the original ID; other pieces receive unique IDs. Pressure/style/transforms survive.
3. Projected intersection fractions are corrected using endpoint depth before interpolation, so cuts on angled 3D strokes land under the cursor.
4. Gesture motion previews edits. Pointer-up creates one undo operation. Esc/pointer cancellation restores the starting scene and selection; losing focus commits the current valid result.
5. Group edits and shape previews validate the complete candidate before changing artwork. Invalid candidates retain the last valid preview and report the constraint. Erasing cannot silently exceed object/point limits.
6. A new edit after undo clears redo. Historical entities are not mutated by later group transforms or erasing.
7. Context hints, history buttons, selection actions, eraser cursor and marquee make the interaction visible. The brand no longer navigates/reloads unsaved work.
8. Blocks stay aligned with map axes plus yaw; the tool uses Wall/Floor/Side, rather than silently approximating arbitrary view-plane rotations.
9. Dashed/dotted geometry adapts spacing to a bounded number of repeats. Long zigzags cannot create unlimited geometry.

The segment eraser cuts projected stroke centrelines, including behind other objects. It does not edit image pixels or carve blocks. Whole-object erase removes those entities. Cutting patterned strokes restarts pattern phase per fragment; spray/wet details may regenerate on fragments with new IDs. These are prototype semantics, not a pixel eraser or sculpting system.

## File format and Android

V1 still loads and remains the export format for ordinary solid-stroke/image/marker scenes. A block or non-solid pattern triggers **v2**, requiring **Android app 0.2.0+**; the footer and export feedback say so.

V2 adds `type: "block"`, `size: [x,y,z]` in metres (0.02–4 each), and optional `pattern: "solid" | "dash" | "dot"`. Exports omit unused/default additions. The map-radius check includes a block's scaled half-diagonal. Source limits remain 80 objects, 4,000 points, 384 points/stroke and six images.

Android 0.2 renders/imports/exports blocks and patterns, preserves dimensions during object adjustment, and adds tap-to-place 0.5 m blocks, whole-object tap erasing and stroke-pattern presets. Rectangle/ellipse authoring, box selection, group transforms and segment erasing are currently web tools. Android loads their results and offers its existing object controls; full native tool parity remains subsequent work.

## Focused verification

Nine web tests and ten Android JVM checks pass. APK build and lint pass with zero errors and 12 existing warnings. A bounded Chromium walkthrough covered shapes, dashed lines, marquee selection, duplicate/delete/move, undo/redo, segment erase, Esc rollback and v2 export/import. The earlier drawing/image/game walkthrough also passed. No browser errors were logged.

`samples/editor-v2.json` is the real browser download read by Android's interop test. Android parses/copies/re-encodes it; the web reader confirms every field matches. Desktop and tablet-sized layouts were inspected. Physical S9+/S22 Ultra behavior and sustained performance remain unmeasured.

Next: install the new APK on S9+, import the example, inspect the block and dashed line, adjust an object, draw a dotted stroke, erase/undo, then export back to PC. Native UI parity, persistent groups/layers, arbitrary-axis block rotation, filled 2D shapes, texture painting, advanced stroke joins and physical paint mixing are future work.
