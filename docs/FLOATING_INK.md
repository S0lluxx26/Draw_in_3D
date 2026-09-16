# Floating ink and comfortable 3D drawing

16 September 2026 · Studio 06 / Android 0.6.0 · prototype implementation and design review.

## What to use now

1. Add a paper sheet and draw. Curve it with **Curved monitor**, **Panorama**, or the bend slider if desired.
2. Choose **Hide sheet · keep ink**. The background disappears; the ink stays in place, with the same grain, width and curvature. A dotted boundary shows the active hidden guide while drawing or editing it on web.
3. Choose **View 3D ink** to hide every sheet and the workspace grid, show the full scene, and switch to Orbit. Drag to inspect the drawing. These sheet visibility changes are saved and can be undone; the view/grid choices are local editor settings.
4. Orbit to another angle, then **Add a paper sheet**. Its orientation faces you. When all previous sheets are hidden, their ink remains visible as a reference; the new sheet keeps your current pen settings. Draw and repeat. Several orientations give the drawing depth.
5. Return to any hidden sheet using **Paint on → [sheet] · hidden guide**. **Face & draw** gives a usable front view. Bend, position, tilt and size still control that sheet's ink. **Show sheet** or **Show all sheets** restores backgrounds.

This removes the visible paper, while retaining its invisible editable guide. It does not detach or destructively convert strokes. **Delete sheet + ink** deliberately removes both; use Hide sheet to preserve the paint. Undo restores deletion. A single flat sheet still produces a planar drawing; use curved sheets and several directions/depths for spatial artwork. Orbit changes the camera, while a sheet's position and orientation determine where its strokes live.

On native Android, **Paper / surface** has Hide/show active sheet, Hide all sheets, and Show all sheets. Hidden guides remain in its Paint list. Android supports drawing on a hidden guide, but the dotted editing outline and web's automatic Orbit/context workflow are currently web features. Show the sheet temporarily if placement is difficult on the phone.

Export before refreshing or closing. Hidden-guide files require **Android 0.6+**; earlier files remain readable. `samples/ink-guides-v5.json` is an actual browser export containing two curved hidden guides and three strokes.

## Research and interaction decision

| Official reference | Relevant behavior | Decision for this prototype |
| --- | --- | --- |
| [Feather: Draw 3D Guide](https://support.feather.art/docs/3dguide/draw) | Creates a surface from the viewing direction and can bend an existing guide. | Continue the view-facing sheet workflow; preserve a guide separately from its visible background. Repeated bending and arbitrary hand-drawn guides are future work. |
| [Blender: Drawing Plane, 4.5 manual](https://docs.blender.org/UATEST/manual/en/4.5/grease_pencil/modes/draw/drawing_planes.html) | Uses explicit drawing planes, including the viewport orientation, and an optional canvas overlay. Plane choice applies to new strokes. | Make the drawing target visible as an outline when needed. Keep view navigation separate from moving existing surfaces. Our bending of existing ink is an additional explicit parent edit. |
| [Open Brush: Snap Settings](https://docs.openbrush.app/user-guide/using-the-open-brush-tools-quick-tools-and-menu-panels/extras-panel/snap-settings-panel) | Supports grid/angle controls and snapping to plane, sphere, line and mirror guides. | Prioritize predictable constraints and snapping before unrestricted depth input. Sphere guides and endpoint snapping are candidates for the next prototype. |

These are feature references, not a comparative performance benchmark. The recommendation is an inference from their interaction patterns and this app's phone/mouse constraints: **draw on a controlled guide, inspect the ink, choose another guide, repeat**. A touch location supplies two screen coordinates, so unrestricted depth needs another deliberate input. The existing plane offset, sheet position controls and view-facing placement provide that input without requiring the camera or continuous tracking.

For the next usability pass, test one small object such as a wireframe chair: front and side guides, seat at another height, then a curved back. Observe whether people can place those guides and return to them without help. Prioritize a depth handle with live feedback, endpoint snapping across sheets, named guides, and a small orientation indicator if that exercise exposes problems. Mirror drawing and sphere/cylinder guide presets can follow. Free-space controller/phone-tip drawing belongs to a separate tracked-input workflow; it should not replace the camera-free default.

## Data and performance review

The existing ordered stroke points remain `[u, v, 0, pressure]` in an unrolled sheet. A stroke references its guide by ID; the parent provides position, orientation, size and bend. The renderer reconstructs the 3D curve. Hiding the background only changes `paperVisible`, so it does not add points, rebuild a point cloud, discard pressure, flatten curves or change brush appearance. Blender resources are unnecessary for this visibility feature.

This is more useful than an unordered point cloud for an editable drawing: order preserves paths, each guide supplies a compact coordinate frame, and existing scene/point budgets still apply. JSON remains the prototype interchange format. Compression, spatial chunks and packed point buffers should follow measured load/render problems rather than precede the phone review.

Web hides the paper mesh and preserves attached ink meshes. Surface-local ink reuses its geometry when only background visibility changes. The active outline is one cached line object, regenerated only when the target sheet changes; its boundary has at most 404 vertices for the current 300° bend limit. It disappears during Orbit, panorama preview and play. Android skips hidden sheet drawing. Both keep the existing input-driven frame scheduling and bounded wet-paint animation; there is no added camera or sensor work.

The guide retains sheet bounds and clipping, including strokes previously trimmed by resizing. Hiding is not an unbounded 3D extrusion or a volumetric reconstruction; surface paint remains a two-sided ribbon. A future permanent “detach ink” export needs an explicit conversion: sample the bent path, preserve thickness/material/pressure, respect trimmed regions and point budgets, and define whether to export ribbons or tubes. Simply clearing `paperId` would place UV coordinates in the wrong space and change the painting. That conversion is intentionally not implemented as part of Hide sheet.

## Contract and failure cases reviewed

- Format **v5** adds optional boolean `paperVisible` to paper entities. Omitted means true; only false needs v5 and is written to the file. Non-paper false values and non-booleans are rejected. This prevents older apps silently restoring paper backgrounds when opening a hidden-guide scene.
- Both readers accept v1–v5. Exporters choose the minimum required version. Showing all sheets returns to v4 or earlier as appropriate. Android's version accumulator uses `max`, so later v4 strokes cannot incorrectly downgrade a v5 document.
- Visibility edits preserve IDs, points, paper references and all transforms. Copies, undo/redo and export/reopen preserve the flag. New sheets start visible.
- Hidden sheets cannot intercept canvas selection or object erasure. Their strokes remain pickable. Guides can still be selected deliberately through Paint on or the Scene list, transformed, and deleted with their children.
- Global “View 3D ink” clears Focus sheet and selection, so another guide's strokes do not vanish during inspection. Adding a sheet from that view preserves other ink for context. Ordinary overlapping opaque sheets retain the earlier Focus workflow.
- Saving does not serialize the dotted outline, workspace grid, camera, selection or panorama state. Geometry and appearance are independent of the paper visibility flag.

## Focused verification

20 web unit tests pass. The new browser smoke check measures rendered pixels before/after hiding a curved sheet, confirms surviving ink and removed paper, then exercises continued hidden-guide drawing, multiple sheets, preserved pen settings, undo/redo, export/reopen, a 412 × 915 viewport, explicit sheet deletion/undo and show-all/undo. It reports zero browser errors. The previous add-after-orbit and panorama workflow also passes.

Android assembly, 21 JVM tests and lint pass (0 errors, 16 existing warnings). The browser v5 fixture survives Android decode/copy/export and web import with every stored field unchanged. Screenshots were visually inspected. This is bounded prototype verification; native runtime interaction and sustained S9+/S22 Ultra performance and battery measurements remain for the device review.
