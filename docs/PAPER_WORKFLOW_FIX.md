# Studio 05.1 — new-sheet drawing and panoramic paper

16 September 2026. Browser workflow update; Android 0.5 remains compatible with exported v4 scenes.

## Reproduction and correction

The original Orbit → Facing the view → Add paper sequence drew successfully in isolated checks at angled, rear and steep viewpoints. Two nearby failure cases were reproduced:

- Leaving the drawing plane at Wall after orbiting behind it created a sheet whose back was visible. Front-face drawing correctly rejected the stroke, but the blank sheet made the failure confusing.
- Two sheets created at the same scene target intersected. Paint was saved on the new sheet, but the other opaque sheet hid part of the mark.

New sheets now default to **Facing my view** in a dedicated **New sheet orientation** selector. They also match the screen's horizontal direction at steep angles, become the active paper, and switch to Draw. **Use drawing plane** explicitly retains Wall/Floor/Side/offset placement; its front faces the camera when it is created. Existing surfaces are never silently reoriented.

**Focus sheet** initially hides other objects while authoring a new sheet. A visible banner identifies the focused sheet and has **Show all objects** to restore the complete scene. The objects remain in the project; focus is only a local editing view. Hidden objects are excluded from picking, box selection, Fit and Select all. Selecting a free-space object or adding a block, marker or image restores the complete scene. Selecting another paper or an attached stroke changes the active sheet.

The active paint target is now included in undo/redo snapshots. Redoing Add paper restores that sheet as the drawing target, instead of leaving a visible sheet with the editor accidentally drawing in free space.

## Curved monitor and panorama

The Paper & surface panel now exposes **Flat (0°)**, **Curved monitor (90°)** and **Panorama (180°)**, plus a signed bend slider. These operate on the active paper without requiring object selection or scrolling to the transform inspector. They preserve the existing local stroke points and are undoable. **Position, tilt & size** opens the detailed transforms. **Face & draw** positions the camera in front of the sheet and resumes authoring.

**Panorama view** places the camera at the centre of the positive-bend cylinder. Dragging, touch dragging or arrow keys turn the view while keeping that position fixed. **Back to drawing** or Escape restores the previous camera, zoom, tool and selection; resizing the viewport during preview is accounted for. Focus and camera state are not exported, and preview navigation does not rewrite the drawing. Keyboard delete/duplicate/select-all commands do not edit the scene from preview. Undo/redo or selecting an editing tool leaves preview first.

This is a cylindrical panel, up to the existing 300° limit. It is not a stitched 360° photograph, spherical projection or a newly implemented phone IMU mode. The original drawing wraps with the paper; it does not require conversion into a bitmap. Native Android 0.5 loads the same paper shape and strokes; the new preset/focus/preview controls are browser features.

## Focused verification

The browser regression flow creates and paints a sheet, orbits behind it while leaving the old plane at Wall, creates a second sheet and draws, verifies its parent reference, undoes and redoes sheet creation, applies both bend presets, and checks that the stroke data remain identical. It then turns the panorama view, exports unchanged scene data, resizes to a phone viewport, returns to drawing, creates another attached stroke, undoes flattening and restores the full scene. Browser errors are collected. Screenshots of the panel and preview were inspected.

Existing 18 web logic tests remain the focused data/geometry checks. No Android code, interchange version or camera/IMU pipeline changed, so no extra native build or device campaign was added. The static build uses a content revision on app-module and stylesheet URLs to prevent a freshly loaded page from mixing old cached app code with the new controls.
