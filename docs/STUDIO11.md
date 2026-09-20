# Studio 11 — larger fleet and animated sky scenes

21 September 2026. Browser v0.11.0; native Android is unchanged.

## Use it

- **Demo** now plays a 155-second performance with **4,096 persistent drones**, sixteen times the previous fleet.
- Larger light sprites make each drone more visible. Takeoff and landing alternate red and blue across the fleet, with a flashing intensity envelope. Lights finish dark after landing.
- New editable scenes: **Big ship**, **Firework star**, **Row of fire**, and **Starship launch**. Robot, Fish, Eiffel Tower and the spherical fireworks finale remain.
- Starship rises slowly over its 14-second display interval. Bright yellow exhaust points fall beneath its engines, fade before returning, and repeat. Fire-row points use the same falling-light effect; the star sparkles.
- **Show editor → Edit demo** loads all seven source drawings. **Motion / effect** selects Still, Firework sparkle, Falling fire or Starship rise. Use yellow `#ffdf12` ink for animated exhaust; colour ratios identify yellow independently of the brightness setting.
- The fleet selector supports **4,096** and legacy **256** drones. New projects default to 4,096. Old show v1 files retain their original count; saving uses show v2. Older app versions must not silently load new motion effects, so these require v2. Drawing-only Android files are unchanged.

## Performance and logic review

The former Hungarian matcher builds a quadratic cost matrix and has cubic worst-case runtime. At 4,096 drones that is inappropriate for mobile preview generation. Large fleets now use recursive spatial partitions, yielding a deterministic bijection in approximately O(n log² n) time and O(n) live storage. Exact Hungarian matching remains for the legacy 256-drone option. The new method is an approximate short-travel assignment, not a globally optimal or collision-safe flight planner.

Formation colours and stroke-order reveal ranks follow the assignment permutation. The launch grid derives its row count from fleet size; staggered takeoff and landing therefore finish for every drone. All shapes and effects use the same IDs, with exact home landing. Effects remain deterministic under seeking. Their motion/light envelopes return smoothly to stage endpoints.

Rendering remains batched. Trail history now uses two segments and three sampled frames, instead of eight segments and nine frames per drone. Shared timing calculations are outside the drone loop, telemetry counts avoid temporary per-drone arrays, and the light shader refreshes pixel ratio when recording changes render resolution. Thumbnails use a bounded 256-point overview; the main formation preview and player use the selected fleet count.

One desktop Node check of the 4,096-drone demo took roughly 59 ms to compile and 0.214 ms per sampled frame before the final falling-light refinement. These are CPU-only observations, not Android frame-rate or battery measurements. Galaxy S9+/S22 Ultra GPU/thermal performance remains unmeasured; the 256-drone option is available for a lighter workload.

## Focused verification

43 unit tests pass. Coverage includes the large-fleet permutation, alternating navigation lights, source/effect save-open, legacy import, animated exhaust, stage-boundary continuity, exact landing and camera framing. Browser checks cover all new demo cue buttons, authoring, mobile layout, recovery and editor preservation. Ship, fire-row and Starship screenshots were visually inspected. A complete short 4,096-drone show was recorded to WebM and decoded at 1280 × 720.

The effect is a visual simulation. It does not export validated aircraft trajectories or model real propulsion/fire.
