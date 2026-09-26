# Studio 21: a sentence for Happy day, a 3D heart, showpiece fireworks

![TODAY IS A GIFT, the sentence morphing into HAPPY DAY, and the 3D heart beating with the family in its window](media/studio21-sentence-heart.jpg)

## What's new

**Happy day grows out of a sentence.** Before HAPPY DAY appears, the drones spell out a well-known line one phrase at a time:

> *Yesterday is history, tomorrow is a mystery, today is a gift — that's why it's called the present.*

YESTERDAY / IS HISTORY → TOMORROW / IS A MYSTERY → TODAY / IS A GIFT → THAT'S WHY / IT'S CALLED → THE / PRESENT → HAPPY DAY.

- Each phrase is 3D Blender lettering like HAPPY DAY, in its own colours: cool blue for the past, violet for the mystery, warm gold for the gift, cyan for "that's why", and a rainbow for THE PRESENT.
- A phrase holds for 3.5 s, then the drones glide into the next one over 2.5 s. Their lights stay on and their colours blend, so the words change gradually rather than blinking out.
- The camera holds one steady frame for the whole sentence, with the words clear of the skyline. As THE PRESENT becomes HAPPY DAY the camera pulls back, and the music builds and drops on HAPPY DAY.

**The growing heart is 3D.** It's now a real 3D heart shell rather than flat nested outlines:
- It's shaded like a sculpture, deep red below to pink above, lit from the upper left, with a warm glow at its edges.
- An oval locket window at the front, with a gold rim, shows the family standing inside the heart.
- It turns gently as it grows, then **beats (lub-dub) for 5 s** before it falls into sparks. The family stays still in the window.

**Showpiece fireworks** burst around the heart and through the sentence:
- **Chrysanthemums:** gold stars with long tails that change colour mid-flight (pink, violet, cyan, orange or green) around a white inner core.
- **Brocade crowns:** heavy gold stars that droop slowly and glitter.
- **Double rings:** two rings crossing at right angles, cyan and magenta.
- **Heart-shaped shells** bloom beside the growing heart.
- Each phrase gets a showpiece, and the HAPPY DAY salvo and crescendo now include them.

The Demo runs 6:59.

## How it works

- **The sentence** (`drone-show.js`, `demo-library.js`):
  - Happy day's library entry has a `prelude` of phrase names, and `libraryFormation()` loads those phrase assets.
  - `buildShow()` makes a hold for each phrase, a lit `morph` flight between phrases (a smooth full-length ease with colour blending), then HAPPY DAY as a `climax` hold.
  - `demoHold()` adds the sentence's 30 s to the cue's display time, so the editor's clock, `showDuration()` and Run agree. An edited Demo keeps the sentence. A shorter display in the editor shortens the phrases proportionally.
- **Phrase assets:** `build_formations.py` builds `PHRASES` with Blender's text curves (Arial Black, extruded and bevelled) and samples 4,096 lights each. Only the five new entries were merged into `formation-assets.js`, so the 12 formations are byte-identical. Body-only assets load with an empty fire set.
- **Framing:** `show-camera.js` gives the whole sentence one frame around all its phrases, with room below.
- **The 3D heart:**
  - `heartShell()` samples Taubin's heart surface. Rays from the centre find the surface, and farthest-point sampling spreads the lights evenly. The locket window is cut out before sampling, so exactly the right number of lights remain.
  - A `turn` mask separates the shell from the family.
  - The grow and `beat` stages share one sine turn that is zero where they start and end, and the beat's lub-dub also fades to zero at the stage's start and end, so the grow → beat → fall boundaries stay continuous.
  - `HEART_BEAT` (5 s) is added to `DEMO_FINALE`.
- **Fireworks** (`pyro.js`):
  - Particles gain a `shift` attribute: a second colour and the fraction of life at which a star changes to it. `PARTICLE_FLOATS` goes from 21 to 25.
  - A glitter mode sparkles each brocade star in the second half of its life.
  - `fineShell()` builds the chrysanthemum (with pistil), the crown and the rings. The total stays under the 40,000-particle budget.
- **Safer transfers:** the uncrossing pass now also looks for pairs that come closest a quarter or three quarters of the way through a flight. A pair could meet there while far apart at the start, middle and end. This caught one close pass on the morph into HAPPY DAY, and it applies to every transfer.

## Verification

- `cd web && npm test`: **106/106**.
  - New `sentence-fireworks.test.mjs` checks:
    - the five phrases come in order, as 3D assets, each held for 3.5 s, and THE PRESENT becomes HAPPY DAY;
    - during every morph at least 95% of the drones stay lit, with colours halfway between the phrases;
    - an edited Demo keeps the sentence and its length;
    - heart, chrysanthemum, crown and rings shells burst around the heart, and every phrase gets a showpiece;
    - chrysanthemum stars change colour around a white pistil, the crown glitters, and the rings have two colours;
    - the particle budget holds.
  - The heart test now checks the 3D locket:
    - 28% of the fleet is the family, standing in the window;
    - no shell light sits in front of the family;
    - more than 10 units of depth;
    - the shell turns while the family doesn't, and it returns to rest.
  - The separation test passes for every transfer, including all the morphs.
- **Fixed along the way:** two assertions were hidden behind mid-line `//` comments, one from Studio 18 in `show-project.test.mjs` and an older one in `paper-smoke.mjs`. Both run again and pass.
- **Real GPU** (RTX 4080 SUPER): each phrase, the morph into HAPPY DAY with its trails, and the heart growing and beating, with no page errors.
