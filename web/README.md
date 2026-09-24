# Draw in 3D — browser studio 0.16.0

**Current: Show editor → Edit demo** lets you author formations, arrange a show, save/recover it and record a 720p video. [Start here](../docs/SHOW_EDITOR_GUIDE.md).

**Drawing helpers:** See-through guides, live left/right or top/bottom mirroring, same-sheet endpoint snapping, Nearer/Farther depth steps and blank parallel sheets are available in Paper & surface. Mirrors are ordinary independent strokes after release; one undo handles the pair. Generated files remain compatible with Android 0.6. [Research, usage and verification](../docs/DRAWING_ASSISTS.md).

**Floating ink:** Hide sheet · keep ink removes the background while preserving the guide and every stroke. View 3D ink hides all papers and the workspace grid, shows all objects and activates Orbit. Orbit → add a sheet → draw to build in another direction; your pen settings are preserved. Paint on selects hidden guides; Face & draw, Show sheet and Show all sheets let you return. Hidden visibility is undoable and saved in **v5 / Android 0.6+**. [Research and workflow](../docs/FLOATING_INK.md).

**New-sheet drawing:** Orbit, then Add a paper sheet; the new sheet faces you and switches to Draw. Focus sheet hides other objects until you choose Show all objects. Flat / Curved monitor / Panorama presets curve the active sheet with its paint. Panorama view lets you look around from a fixed viewpoint; Back to drawing restores the editor. [Workflow fixes and checks](../docs/PAPER_WORKFLOW_FIX.md). Surface files without hidden sheets still work in Android 0.5+.

**Bendable surfaces:** Add a paper sheet → Edit active surface → Surface bend. XYZ, Yaw, Tilt and Roll position each sheet. Face sheet adjusts the view; Paint resumes drawing. Paint follows the sheet even when it is curved after drawing. Several independent sheets share one portable v4 file. Install **Android 0.5+** for these files. [Surface guide and reviewed design](../docs/CURVED_SURFACES.md).

**Curves & finishing:** Q draws arcs or S-curves; set Bend before dragging endpoints. Smooth on release optionally finishes freehand strokes after lifting, with adjustable strength. Smooth selected strokes applies it later with undo. See [the curve guide](../docs/CURVES_AND_SMOOTHING.md). Geometry remains compatible with the existing file versions.

**Paper & surface:** add a watercolor, rough, sketch, canvas or water-resistant sheet; paint on it and move its strokes with it. Change the finish to alter grain and soft edges. Wet coated paint shows short animated runoff. Paper projects require **Android 0.3+**. See [the paper guide and logic review](../docs/PAPER_SURFACES.md). Export unsaved browser work before refreshing to load this version.

**New tools:** freehand/line/rectangle/ellipse, solid blocks, dashed/dotted styles, stabilization and taper, segment/object erasers, box selection, group move/rotate/scale, duplicate, snapping, and 30-step undo/redo. See [the tool guide and reviewed logic](../docs/EDITOR_TOOLS.md). **Blocks and patterned strokes require Android app 0.2.0+.** Plain scenes still export v1.

A camera-free desktop editor using Three.js 0.186.0. Open/create editable 3D drawings and transfer them to the Android prototype as a **single JSON file with embedded images**. The Android app can export edits back to this editor.

## Run locally

Install Node.js 22 or newer, then from the repository root:

```powershell
.\web\start-web.ps1
```

Open **http://127.0.0.1:5173** in Chrome or Edge. Keep the terminal open. The prepared ZIP includes `dist/`, so it needs only Node to run. To rebuild after source edits:

```powershell
cd web
npm ci
npm run build
npm start
```

Requires WebGL 2 and a current browser. Firefox/Safari are intended targets, but only Chromium has been smoke-checked. Browser tablet layout is included; real touch/tablet behavior remains to be reviewed. The existing Android APK is the phone/tablet path for gyro viewing and optional AR.

The local server binds to **127.0.0.1 only**, reads files only from `dist/`, and accepts no uploads. All editor assets and dependencies are local; no CDN, account, camera, external API, or cloud sync is used. Do not double-click `index.html`: ES modules need a local HTTP server. The published HTTPS version is [Draw in 3D on GitHub Pages](https://s0lluxx26.github.io/Draw_in_3D/), including access from a phone browser; see [publishing and current sensor limitations](../docs/GITHUB_PAGES.md).

## Create and transfer

1. Drag on the canvas to draw. Use the brush presets, colour, thickness, opacity and wet-paint switch. Pressure is stored when supplied by a pen; mouse strokes use constant pressure.
2. Right-drag to orbit, middle-drag to pan, wheel to zoom. Use **Orbit** for left-drag or touch rotation; two-finger gestures pan/zoom in that mode.
3. Draw on Wall (XY), Floor (XZ), Side (YZ) or a plane facing the view. Offset moves the plane. Each stroke retains its plane; changing view does not flatten the existing geometry.
4. **Image** accepts PNG/JPEG and embeds a downsized PNG. Select it in the scene list, then adjust position, yaw, scale, panel width and curvature from 0–300°.
5. **Select** picks objects, or use the scene list. Position/yaw/scale edits and Delete are undoable. Colour/brush settings edit a selected stroke. Undo/redo stores 30 operations. Shift-click or Box select chooses multiple objects; Move drags the selection. One gesture is one undo step.
6. Place one **Start**, optional **Check** markers and one **Goal**. **Play map** runs the same ordered tap game as the phone. Return to edit when finished.
7. Choose **Export for phone**. Transfer the downloaded `.json` by USB or another file-transfer method you choose. On Android: **Files / more → Import project JSON**. Continue in Studio without the camera. For Camera AR, place the origin again in the room.
8. To return to PC, export project JSON from Android and choose **Open project** here.

The export contains editable objects, not a screenshot or a baked model. IDs, brush parameters, pressure samples, local coordinates, curved-image data and marker order are preserved. View position, selection, wet-animation time, undo history and play progress are not transferred. There is no autosave: export before closing. A browser cannot confirm whether you later keep/delete its downloaded file.

## Shared limits and review

Limits match Android v0.1.1: 80 objects, 4,000 total stroke points, 384 points per stroke, 6 images, 1,024 px maximum image edge, 16 MiB project, 4 m map radius. Web edits reject out-of-bounds content. The renderer redraws on changes and while bounded wet effects run, then idles. The drawing editor caps pixel ratio at 1.5 and uses no shadows, bloom or physical fluids. The sky show (Studio 13) has its own graphics tiers with HDR bloom, water reflections and adaptive resolution; see [Studio 13](../docs/STUDIO13.md).

Brush geometry uses the same cylindrical curve, tube/spray construction, Java-compatible random seed and gravity projection as Android. Pixel-perfect rendering is not promised: the web engine's colour/transparency pipeline differs from GLES, and transparent intersections can still show artifacts. Gyro/AR, surface detection and room localization are **not implemented in the web editor**.

Eighteen fast model/editing/paper/curve/surface tests run with `npm test`. The paper walkthrough is `scripts/paper-smoke.mjs`; the original walkthrough is in `scripts/smoke.mjs`; it requires the local server and `DRAW3D_CHROME` pointing to a Chromium executable. It uses software graphics, so it is not a performance benchmark. Android's focused JVM interop test reads the real browser export in `samples/web-authored.json` and writes `app/build/interop/android-reencoded.json`.

See [`../docs/WEB_INTEROP.md`](../docs/WEB_INTEROP.md) for contract details and [`../docs/VERIFICATION.md`](../docs/VERIFICATION.md) for the exact checks performed. Three.js is MIT licensed; its license accompanies the local renderer in `dist/vendor/THREE-LICENSE.txt`. Playwright Core is a development-only Apache-2.0 dependency and is not shipped in the prepared static editor.

## Studio 10 show authoring

Use **Show editor → Edit demo** to edit source artwork, arrange formation cards, set timing/lights/placement, and save or open `.show.json` files. **Play my show → Record video** exports a real-time 720p recording with the show music (silent when ♪ Music is off). Show drafts are separate from drawing drafts. [Walkthrough](../docs/SHOW_EDITOR_GUIDE.md), [architecture and review](../docs/SHOW_AUTHORING_PLAN.md). Native Android does not import show documents; the Android browser can use this web workflow.

Studio 11 adds a 4,096-drone default fleet, larger LEDs, red/blue takeoff and landing flashes, editable ship/star/fire-row/Starship scenes, and motion presets. [Details](../docs/STUDIO11.md).
