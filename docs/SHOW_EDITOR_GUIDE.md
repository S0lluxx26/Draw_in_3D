# Make your own drone show — Studio 12

Open [Draw in 3D](https://s0lluxx26.github.io/Draw_in_3D/) and choose **Show editor** above the canvas. The same guide is available under **How to make a show** inside the app. This workflow works in the web app on a PC, phone or tablet; it does not need a camera or IMU.

## Detailed Demo settings

Choose **Demo settings** in the drawing inspector or the Demo player to set the drone count, light shape, 4×–8× formation size and per-formation yellow fire. Apply restarts the Demo. The detailed 3D formations are Blender assets; **Show editor → Edit demo** opens the stroke-based version described below. [Blender source and export instructions](STUDIO12.md).

## Recreate and change the stroke-based demo

1. Click **Edit demo**. You get Robot, Fish, Eiffel Tower, Big ship, Firework star, Row of fire and Starship launch as editable drawings, with the original timing and a fireworks finale.
2. Select the Robot card and click **Edit drawing**. Its original strokes open on a hidden drawing guide. Use Select or Box select to change colours or move parts; use Line, Curve, Rectangle, Ellipse or freehand Draw to add details. Undo and Redo work here. **Drone dots** previews the 4,096 samples over committed strokes.
3. Click **Save formation & return**. The app restores the drawing you had before entering formation editing, including its undo history. **Cancel** returns without changing the formation. The show itself has a separate Undo/Redo history.
4. Select Fish, edit its drawing and colour it. For a different third scene, select Eiffel Tower, edit it, select its strokes and delete them, then draw a heart, star or your own symbol. Keep the guide if you want to draw on the same sheet. Rename the card when finished.
5. Drag the cards to reorder them on desktop, or use **Earlier / Later** on any device. **Display** is the time a completed shape remains visible. **Transition** is the travel interval before that shape. The timeline below shows the complete sequence, including generated takeoff and landing.
6. Choose **Fade in**, **Draw on in stroke order**, or **Bottom to top**, and set brightness. Lights fade out before transfer and reveal after arrival. Draw-on animates the LEDs; it does not make drones physically follow the pen path.
7. Set stage X, Height, Depth, Scale and Rotation. Small artwork changes preserve this placement. **Fit to stage** explicitly recalculates the centre and size. A warning identifies artwork outside the supported stage; reduce scale, reposition it or use Fit. **View in 3D** opens the show paused at the selected formation so you can orbit and inspect depth.
8. Set the fireworks radius and duration, or disable the finale. **Play my show** performs takeoff → your formations → optional light fireworks → return and landing. The same 4,096 virtual drones persist throughout.

## Start with your own artwork

**Current drawing** captures all stroke ink and paper guides from the drawing workspace. **Selected ink** captures selected strokes, including the hidden paper parents they need; selecting a paper captures its attached ink. Other drawing objects are excluded. **Draw a formation** opens a blank guide for a new card. A formation can use several curved or oriented sheets; it is not limited to one paper sheet.

The sky uses stroke centre lines and stroke colours. Brush width, paint spread, opacity, dashed styles, images, blocks and paper backgrounds are not rendered as separate drones. Use simple outlines and inspect the dots: 4,096 points cannot represent unlimited detail. Use Duplicate to make an independently editable copy of a formation.

## Save, recover and transfer

- **Save show** downloads a `.show.json` project containing source drawings, placement, sequence, timing, light settings and fireworks. **Open show** reopens it in this web app on another device. No upload or account is required.
- **Show drafts** provides Restore and Download for browser-local recovery. Committed artwork edits also save while you are inside a formation. Browser storage can fail or be cleared; Save show is the lasting backup. New/Open/Edit demo keep prior show drafts and are undoable in the current session.
- **Export for phone** remains the ordinary drawing-only file. The native Android 0.8 app cannot import a show document. Use the web app on Android for show editing and playback.
- [Editable demo file](../samples/drone-show-demo.show.json) is included in the repository.

## Record a video

In the player, click **Record video**. Recording resets the show to takeoff at 1× and uses the front audience view at 1280 × 720. It captures the canvas with the show music, without editor panels or HTML labels. Turn **♪ Music** off first for a silent video. Record video becomes available once the harbour scenery has loaded. Playback controls and orbit are locked for a consistent camera; **Cancel recording** or leaving the player cancels the recording.

Keep the tab visible until landing. The video downloads automatically on completion. This is real-time recording: a 90-second show takes 90 seconds to record, and a slow device can drop frames. The app chooses a supported format, preferring WebM/VP8; MP4 is only used where supported. Recording is unavailable when the browser cannot capture/encode the canvas. Tab hiding, graphics loss, capture interruption or the 160 MiB memory limit cancels the recording rather than downloading an incomplete result. For long or complex shows, record on a PC.

## Motion and fleet size

New shows use 4,096 drones. The fleet selector can retain 256 drones for older projects or a lighter preview. Motion / effect offers Still, Firework sparkle, Falling fire and Starship rise. Starship rises 10 stage units during its display interval. Paint exhaust with bright yellow (#ffdf12); that ink falls and flickers, returning while dark. These effects are independent of pen thickness.

Show files now save as version 2; version 1 files load with their original 256-drone count and still formations.

## Current scope

The editor supports up to 12 formations, with up to 80 source objects and 4,000 source points per formation. Matching runs in a cancellable worker when requesting a preview. Animated limbs, Bézier control-point editing, moving formation paths, music synchronization, camera tracks and frame-exact offline video encoding remain future work.

This is visual choreography, not a real flight mission. Collision avoidance, separation and aircraft speed/acceleration validation have not been implemented. Physical Galaxy S9+/S22 Ultra performance and battery measurements remain pending.
