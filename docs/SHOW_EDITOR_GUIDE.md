# Make your own drone show — Studio 19

Open [Draw in 3D](https://s0lluxx26.github.io/Draw_in_3D/) and choose **Show editor** above the canvas. The same guide is available under **How to make a show** inside the app. This workflow works in the web app on a PC, phone or tablet; it does not need a camera or IMU.

## Detailed Demo settings

Choose **Demo settings** in the drawing inspector or the Demo player to set the drone count, light shape, 4×–8× formation size and per-formation yellow fire. Apply restarts the Demo. The detailed 3D formations are Blender assets; [Blender source and export instructions](STUDIO12.md).

## Edit the Demo, save it, play it later

**Edit demo** opens the Demo itself, set up as in **Demo settings** on this device. While the Demo plays, **Demo settings → ✎ Edit in Show editor** does the same, and selects the formation you were watching. Until you edit it, the editor's Demo follows any later change to Demo settings.

It includes:
- the 12 Blender-built 3D formations (cards marked **3D**), with their built-in motion: the swimming fish and whale, the flapping butterfly, the rising balloons;
- the Demo's look: lights, size, ship fireworks and lasers (under **Look**);
- the Demo finale: the heart with the family, the star and the firework balls (under **Finale**).

Now make it yours:
- **Remove** or **reorder** formations, and change their **display** and **transition** times;
- switch **Falling fire** on or off for a Demo formation;
- add your own drawings (**＋ Draw a formation**, **＋ Current drawing**, **＋ Selected ink**), which get the Demo's 15 s display and 7 s transition, or more Demo formations (**＋ Demo formation…**);
- change the **Look** (light shape, size, ship fireworks, lasers) or choose the classic fireworks finale.

**Save show** downloads a small `.show.json` (version 3) that stores your choices, not drone positions. Later, **Open show** loads it to keep editing, and **Play my show** performs it just like the Demo, with your changes.

To change a Demo formation's *shape*, choose **✎ Convert to drawing**. It becomes the formation's editable line art (keeping its timing and motion); **Undo** restores the 3D formation. Your drawings play on the same stage as the Demo formations, at the same scale. Set any drawing's **Motion / effect** to **Swim (fish)** for rolling waves above it, or **Swim (whale)** for a water spout from the top of its head (a converted Fish or Whale keeps them).

While your show plays, **Settings** offers the viewing options: graphics quality, camera mode and **Background** (Dark night or Late afternoon). The show's formations and look stay as set here.

## Check it in Run, then come back

- **▶ Run from here** plays the show from the selected formation's transition. **Play my show** plays it from takeoff.
- **← Back to show** returns to the editor with the formation that was on screen selected, ready for the next edit.
- The preview shows the formation as Run plays it, including the whale's spout, the fish's waves and falling fire. Card times use the player's clock.
- A card marked **⚠** cannot play yet: it has nothing drawn, or its ink is outside the sky stage. **Play my show** selects it and says why.

## Design a formation on the stage

The middle of the Show editor is the **sky stage**: the audience's front view of the whole playable sky (408 × 264 m in the Demo look), with the harbour skyline along the bottom. Every line you draw becomes a line of drones in its colour, and the dots are the drones that Run flies to.

1. **＋ Draw a formation** adds a blank stage and picks the **Pen**.
2. Draw:
   - **Pen** draws freehand, and the line is smoothed.
   - **Line**, **Box**, **Ellipse**, **Heart** and **Star** draw by dragging. Hold Shift for equal width and height, or for 15° steps on a line.
   - **Text:** type in the box, choose a size, then click the stage. It has letters A–Z, digits and `! ? . , - + ' : ♥`. Accents fold away (Hà Nội → HA NOI).
   - **Erase** removes the lines you click or drag over.
   - Pick a colour from the eight swatches, or any colour from the picker.
   - **Fill** fills shapes with rings of drones.
   - **Mirror** mirrors each new line across the centre.
   - **Snap** keeps to the 1-unit grid.
   - **Trace image…** shows a picture behind the stage to draw over. It isn't saved in the show.
3. Adjust with **Select**:
   - Click a shape to pick it. A filled shape or a word comes as one piece; Alt-click picks a single line. Shift-click adds to the selection, and dragging on empty stage selects with a box.
   - Drag to move it, drag a corner to resize it, or drag the knob to rotate it (Shift gives 15° steps).
   - The arrow keys nudge it (hold Shift for bigger steps), and a colour swatch recolours it.
   - **Duplicate** (Ctrl+D), **Flip**, **Delete** (Del), **Clear**, Ctrl+A to select everything, and Undo (Ctrl+Z) all work here.
4. While you draw or drag, the dots follow live. The note under the stage counts the lights and any water drones, the lines, and how closely the drones sit ("a drone every 0.7 m").
5. **▶ Run from here** plays the show from this formation's transition, so you watch the drones fly into your drawing.

**Demo formations** keep their 3D Blender shape; **✎ Convert to drawing** puts their line art on the stage to change. **Drawings from the 3D workspace** (curved sheets, several sheets) show on the stage as they will play. **Flatten into the designer** makes them 2D-editable, and **Edit in 3D workspace** keeps their depth.

A formation holds up to 79 lines and 4,000 points; the designer says when it is full. Ink past the stage edge is cut off at the edge.

### Build the program

- Drag the cards to reorder them on desktop, or use **Earlier / Later** on any device.
- **Display** is how long a finished shape stays; **Transition** is the flight into it. The timeline below shows the whole sequence, including takeoff and landing.
- Choose **Fade in**, **Draw on in stroke order** or **Bottom to top**, and set the brightness. In a Demo-style show the drones blink red or blue in flight, and the shape lights up on arrival.
- **Motion / effect** adds swimming (with waves or a spout), wing flaps, drifting balloons, flickering candle flames, a Starship rise, sparkle or falling fire.
- **Fit to stage** scales and centres the drawing.
- Set the finale. **Play my show** performs takeoff → your formations → the finale → return and landing.

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

Keep the tab visible until landing. The video downloads automatically on completion, named after the show (for example `sky-stories.webm`). This is real-time recording: a 90-second show takes 90 seconds to record, and a slow device can drop frames. The app chooses a supported format, preferring WebM/VP8; MP4 is only used where supported. Recording is unavailable when the browser cannot capture/encode the canvas. Tab hiding, graphics loss, capture interruption or the 160 MiB memory limit cancels the recording rather than downloading an incomplete result. For long or complex shows, record on a PC.

## Motion and fleet size

New shows use 4,096 drones. The fleet selector can retain 256 drones for older projects or a lighter preview. Motion / effect offers Still, Firework sparkle, Falling fire and Starship rise. Starship rises 10 stage units during its display interval. Paint exhaust with bright yellow (#ffdf12); that ink falls and flickers, returning while dark. These effects are independent of pen thickness.

Shows edited from the Demo save as version 3 (Demo formations, look and finale). Older version 2 and version 1 files still open and play on their original small stage; **Look → Use the Demo's look** upgrades them, and adding a Demo formation does this automatically.

## Current scope

The editor supports up to 14 formations, with up to 80 source objects and 4,000 source points per formation. Matching runs in a cancellable worker when requesting a preview. Animated limbs, Bézier control-point editing, moving formation paths, music synchronization, camera tracks and frame-exact offline video encoding remain future work.

This is visual choreography, not a real flight mission. Collision avoidance, separation and aircraft speed/acceleration validation have not been implemented. Physical Galaxy S9+/S22 Ultra performance and battery measurements remain pending.
