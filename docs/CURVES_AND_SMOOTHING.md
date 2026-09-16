# Curves and stroke finishing — Studio 04

16 September 2026. Web and Android prototype 0.4.0.

## Controls

**Web:** choose **Curve** on the left, or press **Q**. Choose **Arc** or **S-curve**, set **Bend**, then drag between the start and end. Negative bend reverses the direction; zero is straight. Shift constrains the endpoint angle to 15° increments. Preview updates while dragging; Esc cancels. Bend and shape settings apply to new curves.

**Stroke finishing** contains **Smooth on release**, off by default, and a strength slider. Enable it to soften each new freehand stroke after lifting the pointer. The existing **Stabilization** slider affects the pointer path while drawing; finishing is a separate operation performed once at the end. Select existing strokes and choose **Smooth selected strokes** to apply the current strength later, whether or not automatic finishing is enabled.

**Android:** the first scrollable toolbar row has **Curve**. Drag its endpoints. **Pen / settings → Curves & stroke finishing** contains bend, the S-curve switch, Smooth on release, finishing strength and Smooth selected stroke. Automatic finishing also applies to freehand HOLD DRAW input when it ends. Curve authoring uses a captured plane; ordinary freehand Air drawing retains its existing spatial behavior.

Curves can use the same brushes, colours, thickness, solid/dash/dot styles and paper targets as other strokes. A paper curve can bend beyond the sheet; its paint remains clipped to the sheet's boundary. Turn finishing off for angular freehand designs. It does not automatically round rectangles, other shape tools or newly generated curves.

## Editing and saved files

Curve geometry and the finished result are stored as ordinary pressure-bearing stroke points. Select, move, duplicate, erase and export them using the existing tools. There is no schema change: plain curves use v1, patterned curves v2, paper curves v3. Older compatible readers can render the results; authoring with the new native controls needs app 0.4+.

One automatically finished freehand stroke is one undo operation. Undo removes that gesture. **Smooth selected strokes** creates its own history entry, so undo restores the exact pre-smoothing geometry. Settings and undo history are local to the editor session and are not exported. Curve control handles and a retained raw-stroke/smoothing modifier are not part of this prototype: after saving, the sampled result is the editable source.

## Reviewed implementation

- Arcs use a quadratic Bézier shape; S-curves use a cubic shape with opposing offsets. Bend is relative to endpoint distance, and the captured plane defines the side direction. Each curve uses at most 65 samples, reduced to the remaining scene capacity; fewer than three available points blocks curve creation.
- Finishing uses three corner-cutting passes, arc-length resampling and interpolation with the original path according to strength. It rounds corners without spline overshoot outside the source point hull. Open endpoints and their pressure values remain exactly fixed; explicitly closed loops remain closed. Pressure between samples is interpolated.
- Short strokes, repeated positions and zero-length input have safe finite fallbacks. Finished output stays within 384 points/stroke and the 4,000-point scene limit. A multi-stroke finish allocates spare points in scene order and commits atomically. Near the budget, smoothing may have fewer samples available.
- Plane coordinates and `paperId` survive finishing. The algorithm works on 3D local coordinates, so it does not flatten free-space drawings or detach paper paint.
- Finishing runs only on release or explicit request, with bounded temporary arrays. Renderers consume baked points; no continuous spline or smoothing calculation is added to the frame loop. The camera remains optional.
- Native pointer release captures the final valid point before finishing. Native pointer cancellation discards the current preview. Curve settings and finishing settings are captured at stroke start, so changing controls cannot alter an in-progress gesture halfway through.

## Focused verification and next review

Fifteen web tests and sixteen Android JVM tests pass, including curve endpoints and plane, pressure, loop closure, bounded sample counts, noisy input and source immutability. APK assembly and lint pass. A bounded browser walkthrough checks arc/S-curve creation, manual smoothing with exact undo, automatic finishing matching the manual result, gesture undo/redo, Esc cancellation, paper attachment and file reopening, with no browser errors. `samples/curves.json` is its actual export and survives Android re-encoding with every persisted field unchanged.

The screenshot is `artifacts/studio04-curves.png`. No broad new test campaign or phone benchmark was run. Native touch behavior, S9+ release-time latency and the preferred smoothing strength still need a short on-device review. The effect deliberately softens corners; it is not handwriting recognition, shape recognition or a guarantee to remove every wobble. Control-point editing and adjustable corner preservation are later refinements.
