# Bendable drawing surfaces — Studio 05 / Android 0.5

16 September 2026. Implemented prototype, with physical phone review still pending.

Studio 05.1 adds direct Flat / Curved monitor / Panorama presets, a fixed-position panorama preview, and corrects the new-sheet workflow after orbiting. **Position, tilt & size** is the new label for **Edit active surface**. See the [updated workflow and regression review](PAPER_WORKFLOW_FIX.md).

## Workflow

1. Add a paper sheet. Draw normally while it is flat, or bend it before drawing.
2. Click **Edit active surface**. Set **Surface bend**: 0° is flat, 180° is a half cylinder, and a negative value bends the opposite way. The range is −300° to +300°.
3. Use X/Y/Z, Yaw, Tilt, Roll and Scale to place the sheet. **Face sheet** puts the view in front of it. **Paint** returns to drawing on that sheet.
4. Add more sheets and switch between them with **Paint on**. Each sheet has its own transform, finish and strokes. Choose **Free 3D space** for ordinary spatial strokes.
5. Flatten, bend, move, duplicate or delete a sheet with undo. Its paint follows. Export the scene and open it in Android **0.5 or newer**.

On Android, choose the sheet in **Paper / surface**, then open **Adjust**. Bend ±30°, Flatten, Tilt ±15° and Roll ±15° change the selected/active paper; XYZ, rotation and size move the selected object. Draw and Curve work on bent paper in Studio, gyro Look or optional camera AR. Face the painted front side; the opaque sheet has one paint layer. Drawing from the back is rejected rather than creating hidden ink. Look/orbit is still needed to reach the sides of a deeply curved sheet.

The existing **Curve tool** shapes a stroke on a sheet. **Surface bend** shapes the whole sheet and its attached paint. They are independent controls.

## Data and geometry

An ordered stroke attached to a surface is a better fit than an unstructured point cloud: point order, pressure, brush style and a parent reference make editing, undo, smoothing and erasing possible without reconstructing connectivity. This is our design choice for this editor.

Version 4 adds `bend`, `pitch` and `roll` to paper and `pointSpace: "surface"` to attached strokes. Missing values mean zero/object space. A surface stroke stores:

- `paperId`: one reference to its parent sheet.
- `points`: `[u, v, 0, pressure]`, in metres on the unrolled sheet.
- `position`: `[offsetU, offsetV, 0]`, plus in-plane `yaw` rotation and uniform `scale`.
- The existing brush, width, color, wet flag and pattern.

The four-float point layout is deliberately retained for file and editing compatibility. It is 16 bytes per point in a packed float32 representation; current JSON and JavaScript/Java object storage have additional overhead. This is not a packed binary file or a dense point cloud. Quantized binary chunks are a later storage option if actual project sizes justify them.

Let `k = bendRadians / sheetWidth`, `x = u`, `y = v`. The cylindrical position is:

```text
flat:   [x, y, 0]
curved: [sin(k*x)/k, y, 2*sin(k*x/2)^2/k]
world:  translation × world-Y yaw × uniform scale × sheet basis × Rz(roll) × Rx(tilt) × curved
```

The width measures distance along the unrolled sheet, so changing curvature does not stretch the saved stroke. A small surface-normal offset separates paint from the paper. Bending is reversible and does not resample saved strokes. Resizing changes the clipping area; it does not rescale the ink. The unused point depth remains zero and is validated.

Readers retain v1/v2/v3 support. Old projected paper strokes convert to surface coordinates when a sheet is transformed, resized, bent or duplicated; the conversion preserves their visible position and width. The new reference system prevents applying a parent transform twice. Untouched old files retain their earlier version. New surface-local strokes require v4 even on flat sheets. Earlier Android apps cannot read v4.

## Input and rendering decisions

Drawing rays intersect a bounded cylinder (or a plane at zero bend), then convert that hit into unrolled coordinates. This avoids drawing onto a flat chord behind a curved sheet. The nearest bounded intersection is used; a back-face hit is rejected. Freehand, curves and basic shapes operate in this shared coordinate system. Surface movement and point editing use different transforms, so attached strokes remain on their sheet.

Sparse straight lines and rectangle edges need extra display segments to follow a cylinder. These are generated only in the render geometry, using roughly 3° spacing and a bounded subdivision allowance; they are not written into the project. Patterned paths have a separate existing density cap. Paper itself uses at most 100 strips / 200 triangles. Web geometry uses Three.js vertex buffers; the Android prototype uses OpenGL ES 2 vertex buffers. Both APIs provide buffer-based geometry suitable for this representation. [Three.js BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html), [Android OpenGL ES](https://developer.android.com/develop/ui/views/graphics/opengl/about-opengl).

Object picking uses the displayed web mesh; drawing uses the analytic surface intersection to avoid triangle-resolution input errors. Three.js ray intersections also expose the hit point and UV coordinates. [Three.js Raycaster](https://threejs.org/docs/pages/Raycaster.html).

Dry paint buffers stay cached. Moving or rotating an existing web surface with local strokes reuses its ink geometry when the visual parameters are unchanged. Native surface matrices are cached per immutable sheet. Bend changes rebuild affected geometry once per committed edit; the application does not regenerate a point cloud every display frame. Existing 80-object / 4,000-point source budgets and demand-driven rendering remain in place. Those limits are guardrails, not measured frame-rate guarantees on S9+.

Wet coated paint uses local tangent gravity and a short shader animation. Its display segments bend with the surface, with animated texture coordinates and clipping. This remains a visual approximation: no fluid volume, collision, pooling or paper absorption solver. No Blender assets are required for these mathematical surfaces.

## Logic review and fixes

| Issue found | Implemented correction |
| --- | --- |
| Curving a stroke did not curve its drawing plane | Separate surface bend and stroke Curve controls |
| Existing strokes used world/object coordinates | Explicit surface point space; lazy migration of old attachments |
| A flat-plane ray misses the visible curved surface | Analytic bounded-cylinder ray intersection shared with Android |
| Sparse lines cut through a curved sheet | Render-only subdivision without growing saved point arrays |
| Parent plus child selection could transform ink twice | Parent transform owns attached paint; group pivot excludes its children |
| World-Y rotation was insufficient for sheet orientation | Additional local tilt and roll, with the same rotation order in both renderers |
| Curved erasing tested only straight projected endpoints | Temporary curve samples for the swept eraser; unchanged strokes keep original samples |
| Mixed sheet/free-space transforms have ambiguous axes | Transform one sheet or strokes on one sheet; the editor gives a specific message for mixed-space selections |
| Back-side drawing produced hidden paint | Reject drawing through the back face; provide Face sheet in web |
| Shader effects could reuse an incompatible program | Separate shader cache keys for surface sheet, surface ink and ordinary objects |
| Runoff left a bent/tilted sheet | Tangent gravity, subdivided runoff and curved shader displacement |
| Rebuilding or allocating transforms every display frame | Cached web buffers and native sheet matrices |

## Focused verification and limits

The focused browser flow draws on a flat sheet, bends/tilts/rolls it, draws on the curved result, flattens and undoes, duplicates with attached paint, erases a sparse curved line and undoes, creates an independent second sheet, then exports and reopens. The screenshot is `artifacts/studio05-surfaces.png`. The browser-produced `samples/surfaces-v4.json` is decoded/copied/exported by Android JVM code and returned to the web decoder; every persisted field must match.

Numerical checks cover signed bends, near-flat cases, arbitrary orientation, bounded ray hits, cylinder-conforming ink, legacy migration and bounded display subdivision. Build/lint and these focused checks do not establish native visual correctness, sustained FPS or battery use. Those need the planned Galaxy S9+ review and then S22 Ultra. No broad emulator or device test campaign was added.

Current surfaces bend cylindrically along one sheet axis. Rotate the sheet to change the bend direction. Arbitrary mesh painting, compound/spherical bends, sculpted surfaces, back-side paint layers, automatic real-world layout recognition and cloud alignment are later features. Native selection/erase remains the existing approximate object-level tool; web has the finer segment eraser. This update does not add browser IMU or camera AR.
