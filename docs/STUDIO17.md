# Studio 17: the Demo and the Show editor in step

![Demo settings with ✎ Edit in Show editor, and the Player settings an edited show gets](media/studio17-flow.jpg)

## Why

Studio 16 let you edit the Demo, save it and play it later. An audit checked both paths side by side:

- **Demo:** Demo settings → Apply & play Demo;
- **Edit:** Show editor → Edit demo → edit → Save show → Open show → Play my show.

An unedited Demo already compiled to the same show drone for drone. The audit found seven places where the two paths still disagreed. Studio 17 fixes all seven.

Checking the fixes on a real GPU also turned up a bug already on the live site: on most PCs, **← Back to drawing** didn't leave the Demo. That is fixed too, along with a small layout slip in the Demo settings dialog.

## What changed

| # | Before | Now |
|---|---|---|
| 1 | The Show editor built its Demo once, when the page loaded. If you then changed **Demo settings** (for example to 1,024 star lights at 8×), the editor still held the old Demo, so **Play my show** didn't match the Demo you had just watched. | If you haven't edited it, the editor's Demo picks up the current Demo settings each time the editor opens. A show you have edited is never replaced. |
| 2 | The Demo's title read **SKY STORIES**, the same show from the editor read **Sky stories**. | Every show title is shown in capitals, so both read **SKY STORIES**. Your show's name is stored as you typed it. |
| 3 | An edited show had no settings button, so graphics quality and camera mode couldn't be changed while it played. | Every show has a settings button. For your own show it is labelled **Settings** and opens **Player settings** with just graphics quality and camera mode. Your show's formations and look stay as set in the Show editor. |
| 4 | **Convert to drawing** kept the Fish's and Whale's motion but dropped their water. | A drawing with **Swim (fish)** gets the three rolling waves above it (an eighth of the fleet). A drawing with **Swim (whale)** gets the split spout from the top of its head (a tenth of the fleet). This works for any drawing in a Demo-style show, like the Demo formations. |
| 5 | New drawings added to the Demo got 8 s display and 7 s transition, the Demo formations 12 s and 9 s. | In a Demo-style (version 3) show, new drawings get the Demo's 12 s and 9 s. Older shows keep 8 s and 7 s. |
| 6 | Every recording downloaded as `draw-in-3d-show.webm`. | The video is named after the show: `sky-stories.webm`, `my-demo-remix.webm` (`.mp4` in Safari). |
| 7 | There was no way from the Demo into the Show editor except closing the player and finding the editor. | **Demo settings → ✎ Edit in Show editor** stops the Demo and opens it in the Show editor, set up as in the dialog, with the formation you were watching selected. |

**Also fixed**

- **Back from the Demo on PCs.** In **Cinematic** graphics, **← Back to drawing** threw an error and the player stayed on screen. Leaving the Demo works again. Auto quality picks Cinematic on PCs with 6 or more cores, so most PCs were affected. Phones were affected only if Cinematic was chosen by hand.
- **Demo settings buttons.** On desktop, a strip of the scrolling list showed below the sticky **Cancel / Apply** bar. The bar now sits on the dialog's bottom edge on desktop, phone portrait and landscape.

## How it works

- **Untouched Demo** (`show-editor.js`): the editor remembers the content of the Demo it made (`content()`, which compares everything except formation IDs). When it opens, it compares that with the current show. If they are equal, it rebuilds the Demo from the saved Demo settings and keeps the same card selected.
- **Player settings** (`demo-settings.js`): the dialog is in Demo mode when the Demo is playing, or before any show has started. Otherwise it adds the `player-settings` class, which hides the `demo-only` fields. **Apply** then only calls `setCameraMode()` and `setQuality()`, and resumes the show.
- **Water on drawings** (`demo-library.js`, `show-project.js`): `extrasFor()` reserves the same share of the fleet as the Demo formations. `drawingExtras()` fits the waves or spout to the drawing's bounds. For the spout, it uses the highest point in the front 35% of the drawing, since the whale faces +x. The water uses the Demo's extra-drone mechanism, `formation.extra`, so seeking and recording stay exact. Version 1 and 2 shows don't get water, so they play as before.
- **Demo timing:** `DEMO_TIMING` (`{hold: 12, transfer: 9}`) in `show-project.js` is used by `newCue()` whenever the show is version 3.
- **Back on PCs** (`sky-stage.js`): the Cinematic drone bodies use one `InstancedMesh` with an array of frame materials. `SkyStage.dispose()` read `material.userData` directly, which is undefined for an array, so stopping the player threw part-way through. It now walks `[o.material].flat()`. The shared glTF materials are still kept, not disposed. The smoke tests run on SwiftShader, which picks the Battery-saver tier without drone bodies, so they never reached this path.

## Verification

- `cd web && npm test`: **95/95**. Two new cases in `demo-show-editing.test.mjs`:
  - converted Fish and Whale drawings, and a drawing given the fish swim, keep their water, with the waves above the drawing and the spout at the top of its head;
  - new drawings get the Demo timing in a Demo-style show, and 8 s / 7 s in older shows.
- **New browser test `demo-flow-smoke.mjs`** runs both paths in Chrome:
  1. Set up the Demo (1,024 drones, star, 8×, no pyro, no lasers) and play it.
  2. Open the Show editor directly: it shows those same settings. Play it unedited: the title, fleet, length and cue list are identical to the Demo.
  3. Your show gets **Player settings** with only quality and camera. Switching to Balanced applies, and the same show keeps playing.
  4. From the playing Demo, **✎ Edit in Show editor** on the Whale opens the editor on **7. Whale** with 1,024 drones.

  Step 1 plays in **Cinematic** quality so that **← Back** runs the drone-body teardown. Without the `sky-stage.js` fix this step fails.

  There are no browser errors.
- `demo-editing-smoke.mjs` now expects the **Player settings** button for a saved show. All other smoke scripts pass unchanged, including `show-editor-smoke`, whose recording still downloads a `.webm`.
- **Real GPU** (RTX 4080 SUPER, Chrome on D3D11): Demo → **✎ Edit in Show editor** → **Play my show** → **Settings** runs with no page errors. The screenshot above comes from that run.
