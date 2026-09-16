# Prototype verification and review handoff

Date: 16 September 2026.

## Studio 05 surfaces and Android 0.5.0

Eighteen web tests and nineteen Android JVM tests pass. Android assembly and lint pass (0 errors, 16 warnings). A focused browser flow passes flat drawing followed by bend/tilt/roll, drawing directly on curved sheets, flatten/undo, duplication with attached ink, sparse curved-line erasure/undo, independent sheets, export and reopen, with zero browser errors. The actual browser samples/surfaces-v4.json survives Android decode/copy/export and browser re-import with every persisted field unchanged; old v3 paper and curve fixtures also still round-trip. artifacts/studio05-surfaces.png was inspected. No device/emulator performance campaign was run; native surface runtime and S9+/S22 Ultra performance/battery remain pending. [Surface controls, data model and logic review](CURVED_SURFACES.md).

## Studio 04 curves and Android 0.4.0

Fifteen web tests and sixteen Android JVM tests pass. APK build and lint pass. The focused browser flow covers arcs/S-curves, smoothing selected strokes with exact undo, equivalent automatic finishing, gesture cancellation, paper attachment and reopening, with zero browser errors. The actual `samples/curves.json` export survives Android re-encoding and web reading with all persisted fields unchanged. `artifacts/studio04-curves.png` was inspected. No new emulator campaign or physical performance measurement was run. [Controls and logic review](CURVES_AND_SMOOTHING.md).

## Studio 03 paper and Android 0.3.0

Twelve web tests and thirteen Android JVM tests pass. Android APK assembly and lint pass. A focused browser flow exercised paper creation, attached paint, finish change, parent move/duplicate/delete with undo, v3 export/import and returning to free drawing, with zero browser errors. The browser fixture `samples/paper-v3.json` survives Android copy/encode and web re-import with every persisted field preserved. Desktop/tablet paper screenshots were inspected. Native paper runtime, physical S9+ performance and battery behavior remain pending; no new emulator campaign was run. See [the paper implementation review](PAPER_SURFACES.md).

## Studio 02 tools and Android 0.2.0

Nine web tests and ten Android JVM checks pass. Android APK build and lint pass (zero errors, 12 existing warnings). A bounded browser walkthrough covered line/dash, rectangle, ellipse, block, box selection, group duplicate/delete/move, undo/redo, segment erase, Esc cancellation and v2 export/import, with no browser errors. The previous drawing/image/game flow also passed as a regression check. A focused perspective-clipping test covers erasing across changing depth.

The actual browser download `samples/editor-v2.json` is parsed, copied and re-encoded by Android; the web reader confirms every field matches. Screenshots are `artifacts/studio02-tools.png` and `artifacts/studio02-tablet.png`. See [the tool review](EDITOR_TOOLS.md) for exact scope. New APK runtime behavior has compile/data verification only, pending a physical S9+ session; no new emulator/performance benchmark was run. Earlier sections below describe previous versions.

## Browser editor and cross-device format follow-up

The camera-free PC editor builds with Three.js 0.186.0 and runs from a local static server. Four quick Node tests pass for Android sample round trip/image bytes, Android float range endpoints, invalid/budget-exceeding project rejection and cylindrical curve conventions.

A bounded Chromium walkthrough used software WebGL: drew a wet 2 mm stroke, undid/redid it, imported a PNG, adjusted image curve/scale, downloaded a two-object project, opened a five-object project previously saved by the Android emulator, completed Start → Checkpoint → Goal, re-exported with the same IDs/image data, and rejected an unsupported-version file without replacing the scene. It logged zero browser/script/shader errors. The initial hollow-checkpoint click failure was fixed by adding a bounded whole-marker hit area; the walkthrough then passed.

The actual downloaded desktop file is checked in as `samples/web-authored.json`. The Android `SceneData` JVM parser accepts it and re-encodes it; its image header/dimensions and Base64 preservation are checked. That Android re-export was opened and downloaded in the browser again, with every JSON field and embedded image equal to the original browser file. **All nine Android JVM checks pass.** This verifies the scene-data path; it does not replace Android's BitmapFactory/device file-picker checks on a physical phone.

Desktop (1440×1000) and tablet-sized (820×1180) browser layouts were visually inspected. A narrow-canvas framing adjustment prevents the sidebar from cropping the scene on resize. Screenshots are in `web/test-output/` and copied into `artifacts/web-*.png`. The tablet-sized browser capture is a layout check, not an Android/iPad touch test. Pixel appearance and sustained performance are not benchmarked by this software renderer.

The web prototype uses manual file transfer and explicit export; it has no cloud sync, autosave, browser camera/gyro/AR, or native iOS app. The original Android APK remains v0.1.1 because the web extension needs no runtime change. Next, perform one physical S9+ transfer: PC JSON → native import → draw a new stroke → phone export → PC open. Optional AR additionally needs a newly placed origin.

## v0.1.1 camera-optional follow-up

Camera-free startup is retained and onboarding now makes it the primary workflow. Camera permission/service checks are lazy. The update adds bounded redraw windows for stationary Studio/gyro scenes, a requested ~30 Hz orientation rate with noise filtering, Android Battery Saver frame-rate capping, three-second power-status polling, and the normal screen timeout. AR mode exit now closes the paused session on a worker thread; re-entry waits for cleanup. AR resumes before the GL thread resumes after backgrounding.

Two focused render-demand tests cover stationary sleep, continuous AR/input rendering and keeping a wet animation alive beyond a shorter input window. All eight quick JVM checks pass; Android lint reports zero errors and 12 existing warnings. The emulator walkthrough below describes v0.1.0. New lifecycle and battery behavior still requires a physical-phone pass. No battery percentage or runtime improvement has been measured.

On the S9+, additionally check: the camera indicator goes away after selecting Studio/Look, a static scene wakes immediately on touch/rotation, wet drips finish animating before drawing idles, normal screen timeout works, and quickly selecting AR → Look → AR does not hang or open two sessions. Allow for ARCore's documented brief processing tail after pause; do not infer instantaneous power shutdown from the camera indicator alone.

## What was verified

- Android debug APK compilation and packaging with AGP 8.13.0, Gradle 8.14.3, Android SDK 36, ARCore 1.56.0 and AndroidX ExifInterface 1.4.2.
- Six JVM tests passed: curved-panel flat limit/radius, wall/floor gravity projection, valid/invalid plane rays, JSON round trip and invalid inputs, transformed content bounds, and finite/bounded spray geometry. These completed in a fraction of a second.
- Android lint: **zero errors**. Remaining warnings concern the English-only prototype strings, portrait/large-screen behavior, touch accessibility and newer optional tool/test-library versions. They are production follow-up work, not suppressed checks.
- One disposable Android 16 x86_64 emulator session: installed and launched, dismissed onboarding, rendered a touch stroke and floor grid, saved the stroke, imported `samples/starter-map.json` through Android's document picker, displayed its curved image and drips, rotated the Studio view, completed Start → Checkpoint → Goal, returned to editing, saved the five-object scene with its image data intact, backgrounded/resumed, and used undo/redo on another stroke.
- No AndroidRuntime crash was logged during that session. Emulator output is a functional smoke check; its approximately 30 fps is **not** evidence of S9+ performance.

Screenshots from that session are in `artifacts/studio-smoke.png`, `artifacts/starter-map.png` and `artifacts/play-smoke.png`. The sample uses an original procedural calibration image. No real room or user photograph was captured.

## Implemented but waiting for physical-device review

ARCore service installation/availability, camera permission flows on Samsung, 6DoF camera pose, detected-plane origin placement, surface strokes, tracking loss/recovery, gravity behavior under phone rotation, gyro view feel, stylus pressure on S22 Ultra, photo import across Samsung providers, thermal fallback and sustained frame pacing. These have source/compile review only where the emulator cannot represent the real device behavior. The gallery picker and EXIF variants also need a short phone pass; the smoke test imported an image embedded in a project.

## Implementation logic fixes made during review

1. Separate camera-free orientation from actual spatial tracking; never integrate accelerometer data into a claimed room position.
2. One bounded map origin; stop drawing and hide content when AR tracking is unreliable. Surface strokes capture their plane at the start.
3. Use map-local coordinates, and require origin placement after project load or a new AR session. Do not persist ARCore handles as room locations.
4. Include AR camera projection offsets when constructing screen rays.
5. Project gravity into a surface; horizontal floors do not receive vertical wall drips.
6. Cap spray geometry below the initial 100k-triangle scene target at the point limit. Cache completed meshes and textures; bound active-stroke rebuilds.
7. Validate an entire imported scene before replacing the current one. Check version, units, coordinates, IDs, numeric ranges, image dimensions and resource limits. Save locally using atomic files.
8. Decode images off the rendering thread, cap resolution, correct EXIF orientation and use the maintained AndroidX EXIF reader.
9. Stop the GL session before pausing/closing the camera, guard repeated permission requests, and release an AR session if setup fails.
10. Keep game progress separate from authored objects; highlight the next marker. Make neon's outer stroke translucent so it does not hide its bright inner core.

## Known prototype limitations

- The production Unity engine recommendation is not yet implemented. This APK is the native feasibility prototype. Do not budget its renderer/UI as reusable Unity components.
- AR finds planes but does not show a reconstructed room mesh or depth occlusion. Surface strokes may extend past a real plane's observed boundary; drips do not detect wall edges or collide with floors.
- Pen strokes use individual low-sided tube segments. Production needs improved joins, caps, transported frames, stabilization and taper. Marker is a broad translucent tube; spray is sparse procedural dots; neon is a core/halo approximation without bloom; wet paint does not mix pigments.
- Active geometry is rebuilt within a 384-point bound. This is not the final chunked/pooled production brush implementation. Completed geometry is cached.
- Transparency is sorted per object, not per triangle. Overlapping transparent strokes/panels can show sorting artifacts. There is no physically correct water refraction.
- Look mode fixes camera position and recentres its orientation. It offers no spatial relocalization. Game mode in Studio uses the currently chosen camera view; orient the view before pressing Play, or use gyro/AR to look around while playing.
- Images are cylindrical strips, not spherical panoramas. No missing image content or 3D depth is inferred. Selection uses proximity to an object's centre or stroke sample rather than precise triangle picking.
- Images are capped at 1024 pixels on the long edge; six cached imports includes deleted images retained for undo. Save/reopen releases that cache. Transparent image handling uses a simple prototype blend path and merits device review.
- Local Save is one slot. Export JSON to keep multiple projects. Autosave occurs on backgrounding, not continuously; abrupt force-stop/power loss can lose changes since the last save/background event.
- Gyro orientation assumes the phone portrait workflow. Large tablets, landscape, split-screen and foldable behavior are not production-ready.
- No cloud anchors, multiplayer, full room reconstruction, layer system, segment eraser, physical fluid solver, spherical panorama viewer, smudge/mixing, GLB import or public publishing exists in this build.

## First S9+ review: one short session

Record the exact model/SoC (Exynos or Qualcomm), Android version and Google Play Services for AR version. Then spend about ten minutes on these checks:

1. Studio: draw two colours, change thickness, undo/redo, save, reopen.
2. AR: allow camera, scan a textured area, place origin, draw in air, move around it.
3. Surface: capture a wall, draw with wet drips, rotate the phone, briefly cover/uncover the camera. Check that tracking loss ends a stroke rather than stretching it across the room.
4. Import one photo, set curve to 0° and 150°, then turn the phone to inspect it. Check its orientation and placement.
5. Import the starter map, place its origin, complete the marker game, export and reopen it.
6. Leave and resume the app; inspect stability and temperature. Report frame-rate dips with the scene size, rather than running a large benchmark suite now.

Fix blockers in this order: data loss/crashes → tracking/placement → drawing/input → image workflow → game flow → frame pacing → visual polish. Repeat only the affected checks after a fix. Begin S22 Ultra testing after the S9+ creator loop is usable.
