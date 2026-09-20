# Studio 12 — detailed 3D Demo and settings

Open **Demo settings** in the drawing inspector or inside the Demo player. Choose 256, 512, 1,024, 2,048 or 4,096 drones, round/diamond/star lights, and 2×/3×/4× formation scale. Default: 4,096 round lights at 3× scale, with fire on Row of fire and Starship. Each of the seven formations has its own falling-yellow-fire toggle. Apply restarts the Demo; Cancel preserves playback position and resumes it if it was playing. Settings persist locally when browser storage is available. They do not change saved drawing/show documents.

All seven Demo formations now use Blender mesh-surface samples: articulated robot, tapered fish with stripes, gills, fins and eyes, tower with cross-bracing, ship with decks/windows/funnels, faceted star, flame cones, and Starship with panel seams, flaps, engines and optional exhaust. Orbit to inspect their depth. Starship keeps its slow rise with fire disabled. Inter-formation transfers blink red/blue at at most 12% intensity once formation lights have faded; launch/landing retain brighter navigation lights. The full performance remains 155 seconds.

The separate **Show editor → Edit demo** still opens the editable stroke-based version. Detailed mesh formations are Blender assets, not editable pen strokes, and are not included in `.show.json` files. Demo settings do not alter Show editor fleet limits or its saved effects.

## Blender workflow

Source: `assets/drone-formations.blend`. Created and exported with official Blender 4.5.11 LTS. Each named collection is a formation in the same local coordinates; isolate a collection in the Outliner to edit it. Application coordinates are X/right, Y/up, Z/depth. Colours come from material diffuse colours; objects with the custom `fire` property are optional exhaust emitters. Keep the seven collection names and at least one nonzero-area mesh in both the body and fire groups.

Regenerate the original source and browser asset:

```text
blender --background --python tools/blender/build_formations.py
```

After saving your mesh edits in Blender, export them without regenerating the original meshes:

```text
blender --background assets/drone-formations.blend --python tools/blender/build_formations.py -- --export-only
npm --prefix web run build
```

The exporter currently reads mesh vertices/faces, world transforms and material colours. Apply modifiers and convert curves to meshes before export. Hidden/internal surfaces are also sampled; remove geometry that should not receive lights. Material shaders/textures do not become LED colours. No Blender runtime is downloaded by the app: it lazily loads only `formation-assets.js` (about 1.27 MB before transport compression), then renders one light point cloud.

## Review and limits

- Offline area-weighted triangle sampling followed by farthest-point ordering distributes lights over surfaces. Every fleet-size prefix is distributed spatially, instead of crowding 4,096 samples onto a few outline strokes. Fire uses one eighth of the selected fleet; it does not create extra drones.
- A fire mask follows drone assignment, avoiding accidental animation of gold hull/body parts. Scale affects formations, launch-grid spacing, fireworks and Starship rise/exhaust distances. Camera framing includes the complete performance.
- Demo settings are normalized; failed storage is nonfatal. Settings are unavailable during recording. Escape closes the settings dialog without exiting the player. Dismissed asynchronous settings requests cannot restart the show.
- Fixed pose scaling increases world-space spacing, but automatic camera framing can make the apparent size similar. Zoom closer to inspect dots. This is visual choreography, without collision avoidance or certified separation during transitions. Real Galaxy S9+/S22 Ultra frame rate and battery use remain unmeasured.
- Unit checks cover settings normalization, exact fleets, finite distinct 3D assets, fire masks, independent ascent, dim LEDs and continuous stage boundaries. Browser checks cover settings/restart/cancel, persistence, light shaders, desktop/mobile layout and the existing full Demo workflow.

Official Blender distribution: https://download.blender.org/release/Blender4.5/
