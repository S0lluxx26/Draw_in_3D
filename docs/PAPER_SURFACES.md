# Paper and paint surfaces — Studio 03

16 September 2026. Web and Android prototype 0.3.0; paper projects use format v3.

“Water shed” has two plausible meanings here: watercolor paper and a water-resistant painting surface. This prototype includes both. They are drawable sheets in the 3D scene, rather than a background filter over the whole view.

| Surface | Prototype appearance with Water / Wet paint |
| --- | --- |
| Watercolor · cold press | Warm paper, fine grain, soft wash edges |
| Watercolor · rough | Stronger grain, wider spread, lower pigment coverage |
| Sketch paper | Light fibres and a narrower mark |
| Woven canvas | Repeating weave and moderate grain |
| Coated · water resistant | Smooth cool surface, tighter edges and optional animated runoff |

## Use it

**Web:** in **Paper & surface**, choose a finish and **Add a paper sheet**. The sheet is placed on the current drawing plane and becomes the paint target. Water, blue paint, 60 mm width and wet effects are selected for a visible first stroke. All five brushes and line/rectangle/ellipse tools can mark the sheet. Change **Paint on** to choose another sheet or return to free 3D drawing. Blocks and game markers continue using the map drawing plane.

Changing **Surface finish** updates the active or singly selected sheet and its existing paint, with undo. Select the paper in the Scene list to move, rotate, scale, duplicate or delete it together with attached strokes. Its width/height controls change the visible paper boundary without deleting clipped stroke data. Editing a linked stroke keeps its displayed paint projected onto the sheet. Choose free 3D space before drawing strokes that should leave the paper.

**Android:** install `artifacts/Draw-in-3D-v0.3.0-debug.apk`. The scrollable second toolbar row has **Paper / surface**. Add a preset, choose an existing sheet as the paint target, change its finish, or return to free space. Drag on the sheet or use HOLD DRAW. Select the sheet near its centre and use Adjust to move/rotate/scale it with its paint; Delete and undo/redo include the attached strokes. Native rectangle/ellipse tools, group selection and segment erasing remain web-only controls.

Export JSON from either editor and import it in the other. `samples/paper-v3.json` is a small watercolor example exported by the real browser. Paper requires Android 0.3+. Plain scenes still export v1; blocks/patterns without paper use v2. Paper does not require the camera. Optional Camera AR needs a new origin placement after importing, as before.

## Research and design choice

Paper texture and sizing affect watercolor behavior. Cold-pressed, rough and hot-pressed finishes have different surface textures; sizing regulates absorption. A watercolor preset should not be described as simply soaking up all water. [ARCHES watercolor paper](https://arches-papers.com/arches-range-of-papers/watercolor-and-wet-techniques/arches-aquarelle/).

Nonabsorbent synthetic surfaces offer a useful contrasting reference for flowing pigment. The coated preset is a generic visual interpretation, not a claim to reproduce a named manufacturer's paper. [Legion YUPO](https://legionpaper.com/yupo/).

For the S9+ prototype, surface response is modeled with width spread, edge alpha, pigment coverage and grain. This implements the visible distinction without a fluid solver. Surface settings are separate from brush settings: choosing paper does not create a second incompatible brush system. No external textures or Blender assets are needed at this stage.

## Implementation and reviewed logic

1. **Durable attachment:** v3 adds `type: "paper"`, `paperKind`, and a stroke's optional `paperId`. Width/aspect describe sheet dimensions; position, normal, yaw and scale describe its pose. Readers reject missing parents, unknown finishes and links from non-stroke objects. Older apps reject v3 instead of silently losing paper.
2. **Atomic editing:** a paper transform/delete includes its strokes exactly once, even when the selection contains both. Duplicating a sheet creates new IDs and rewrites the copies' parent references. Each user action remains one history entry.
3. **Surface coordinates:** paint and grain use the paper's local coordinates. Moving or rotating the sheet preserves their registration. Linked paint is projected onto that plane; the web eraser uses the displayed projection too.
4. **Edge behavior:** new stroke samples must hit the sheet. Fragment clipping contains soft edges and drips at its boundary. Width/height resizing crops the visible area and is reversible. Paint is on the sheet's front face.
5. **Gravity:** coated runoff follows gravity projected into the sheet plane. Horizontal sheets have no downhill runoff. Absorbent presets use static soft/grain effects; they do not create hanging 3D drips.
6. **Render order:** Android draws paper before transparent ink so sheet distance sorting cannot cover the paint. The web drawing guide is hidden while a paper target is active. Shared textures survive individual object deletion and history edits.
7. **Bounded cost:** each sheet uses two triangles. Shared procedural textures are 256 × 256 RGBA; five presets with paper/ink variants total at most 2.5 MiB of texture pixels per graphics context. Paint uses flat feathered ribbons, with at most eight runoff trails per wet stroke. Existing limits remain 80 objects and 4,000 points.
8. **Idle behavior:** textures are generated lazily and cached. Coated runoff animates for a bounded four-second window. Stationary camera-free scenes can stop redrawing after input and effects settle. No continuous water simulation or new camera dependency is introduced.

## Focused verification and remaining work

Twelve web tests and thirteen Android JVM tests pass. APK assembly and Android lint pass. One focused browser flow covers creation, drawing, finish change, paper movement, duplicate/delete with undo, v3 export/reopen and switching back to free space, with no browser errors. Desktop/tablet layouts were inspected. Android parses, copies and re-exports the browser fixture; the web reader verifies all persisted fields match.

This is a visual prototype. It does not simulate drying, puddle movement, pigment mixing, paper deformation or physical absorption. Grain scales with the sheet; brush joins, paint layering, transparency at intersections and stroke-tip quality need a later visual pass. The same document is portable, but the web and GLES colour pipelines can produce different pixels.

No new emulator campaign or physical-device benchmark was run. S9+ battery, thermal behavior, touch/stylus feel and native paper rendering still need on-device review, followed by S22 Ultra. Start by importing the example, adding a stroke, moving the paper, undoing and exporting back to PC. Do that short review before investing in a physical paint solver.

For a production quality pass: establish consistent stroke ordering/layers; improve joins and dry-brush masks; add adjustable grain/absorbency and paper size presets; profile overdraw and geometry on S9+; then evaluate an optional low-resolution wetness field only if the measured budget permits it. Keep the basic surface mode available on lower-power devices.
