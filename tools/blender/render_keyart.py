"""Key art for the app's title screen (web/src/assets/keyart-wide.webp and keyart-tall.webp).

    blender --background assets/sky-stage.blend --python tools/blender/render_keyart.py -- --aspect wide
    blender --background assets/sky-stage.blend --python tools/blender/render_keyart.py -- --aspect tall

Options: --formation Whale  --samples 192  --scale 1.0 (resolution factor)  --out <file>  --preview

Same sources as the README hero (tools/blender/render_hero.py): the real exported formation LEDs from
web/src/formation-assets.js at the Demo's default 6x scale, over the harbour stage the player loads. The key
art adds a very dark blue sky with stars, black-blue water and ship fireworks, and leaves room for the title
and buttons: the wide crop keeps the left side quiet, the tall crop keeps the top and bottom quiet.
"""
import bpy, base64, json, math, pathlib, re, sys
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opt = lambda name, default: args[args.index(name) + 1] if name in args else default
ASPECT = opt('--aspect', 'wide')
FORMATION = opt('--formation', 'Whale')
SAMPLES = int(opt('--samples', 192))
SCALE = float(opt('--scale', 1.0))
PREVIEW = '--preview' in args
OUT = pathlib.Path(opt('--out', str(ROOT / 'web' / 'src' / 'assets' / f'keyart-{ASPECT}.webp')))
WIDE = ASPECT == 'wide'
rng = np.random.default_rng(11)
scene = bpy.context.scene

def formation(name):
    text = (ROOT / 'web/src/formation-assets.js').read_text()
    data = json.loads(re.search(r'const data=(\{.*?\});\n', text, re.S).group(1))[name]['body']
    q = np.frombuffer(base64.b64decode(data['p']), dtype='<i2').reshape(-1, 3).astype(float)
    lo, hi = np.array(data['min']), np.array(data['max'])
    p = lo + (q + 32768) / 65535 * (hi - lo)
    c = np.frombuffer(base64.b64decode(data['c']), dtype=np.uint8).reshape(-1, 3) / 255
    return p, c

# The drone models are templates for the player's Cinematic tier; they are not part of the view.
# The drones are all in the air in this picture, so the empty launch deck in the foreground would only be clutter.
for o in bpy.data.objects:
    if o.name.startswith('Drone') or o.name in ('Launch deck', 'Beacons'):
        o.hide_render = True

# One point-cloud material: per-point colour attribute 'led', emission only.
def led_material(name, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    t = m.node_tree; t.nodes.clear()
    e = t.nodes.new('ShaderNodeEmission'); e.inputs['Strength'].default_value = strength
    a = t.nodes.new('ShaderNodeAttribute'); a.attribute_name = 'led'
    o = t.nodes.new('ShaderNodeOutputMaterial')
    t.links.new(a.outputs['Color'], e.inputs['Color']); t.links.new(e.outputs['Emission'], o.inputs['Surface'])
    return m

def point_cloud(name, points, colours, radius, material):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(p) for p in points], [], []); me.update()
    attr = me.color_attributes.new('led', 'FLOAT_COLOR', 'POINT')
    attr.data.foreach_set('color', np.concatenate([np.asarray(colours, float), np.ones((len(colours), 1))], axis=1).ravel())
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    tree = bpy.data.node_groups.new(name + ' points', 'GeometryNodeTree')
    tree.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    tree.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    n, l = tree.nodes, tree.links
    gi, go = n.new('NodeGroupInput'), n.new('NodeGroupOutput')
    pts = n.new('GeometryNodeMeshToPoints'); pts.inputs['Radius'].default_value = radius
    sm = n.new('GeometryNodeSetMaterial'); sm.inputs['Material'].default_value = material
    l.new(gi.outputs['Geometry'], pts.inputs['Mesh']); l.new(pts.outputs['Points'], sm.inputs['Geometry']); l.new(sm.outputs['Geometry'], go.inputs['Geometry'])
    ob.modifiers.new('points', 'NODES').node_group = tree
    return ob

# LEDs at the Demo's placement (app -> Blender axes: x, -z, y).
p, c = formation(FORMATION)
app = np.stack([p[:, 0] * 6, (p[:, 1] + 18) * 6, p[:, 2] * 6], axis=1)
leds = np.stack([app[:, 0], -app[:, 2], app[:, 1]], axis=1)
point_cloud('LEDs', leds, c ** 2.2, .27, led_material('LED', 30))
centre = (leds.min(0) + leds.max(0)) / 2; size = leds.max(0) - leds.min(0)

# Ship fireworks from the barges and the yacht (same launch sites as web/src/pyro.js), vivid and warm.
def shell(origin, height, radius, pattern, colour, n=150, age=1.0, tail=11):
    """A burst at one moment: bright star heads plus fading trails behind them (drag and gravity as in pyro.js)."""
    heads, trails = ([], []), ([], [])
    for i in range(n):
        if pattern == 'ring':
            a = i * 2 * np.pi / n; d = np.array([np.cos(a), .22 * np.sin(a), np.sin(a)])
        else:
            z = 1 - 2 * (i + .5) / n; r = np.sqrt(1 - z * z); a = i * 2.3999; d = np.array([np.cos(a) * r, np.sin(a) * r, z])
        d /= np.linalg.norm(d)
        for k, ts in enumerate(np.linspace(1.2 * age, .38 * age, tail)):
            spread = (1 - np.exp(-1.5 * ts)) / 1.5 * radius * 1.5
            droop = .5 * 9.81 * (1.5 if pattern == 'willow' else .55) * ts * ts
            point = (origin[0] + d[0] * spread, origin[1] - d[2] * spread, height + d[1] * spread - droop)
            fade = (1 - k / tail) ** 1.8
            target = heads if k == 0 else trails
            target[0].append(point); target[1].append(tuple(ch * (1.4 if k == 0 else fade) for ch in colour))
    return heads, trails

if WIDE:  # bright shells around and behind the formation; the left side stays quiet for the title
    shells = [((150, 330), 262, 44, 'peony', (1, .45, .14)), ((250, 360), 176, 40, 'peony', (.25, .75, 1)), ((205, 300), 318, 30, 'ring', (1, .32, .64)),
              ((-70, 330), 290, 30, 'peony', (.6, 1, .45)), ((300, 300), 262, 32, 'willow', (1, .72, .3)), ((330, 420), 96, 30, 'peony', (1, .84, .5))]
else:  # the tall crop: a crown of shells above the formation and two low ones over the water
    shells = [((-150, 330), 268, 44, 'peony', (1, .45, .14)), ((150, 330), 280, 42, 'peony', (.25, .75, 1)), ((0, 380), 360, 40, 'ring', (1, .32, .64)),
              ((-90, 360), 380, 30, 'peony', (.6, 1, .45)), ((110, 380), 392, 32, 'willow', (1, .72, .3)), ((-200, 420), 118, 34, 'willow', (1, .8, .4)),
              ((210, 420), 104, 30, 'peony', (.95, .35, .9))]
hp, hc, tp, tc = [], [], [], []
for origin, h, radius, pattern, colour in shells:
    (a, b), (c2, d2) = shell(origin, h, radius, pattern, colour); hp += a; hc += b; tp += c2; tc += d2
spark = led_material('Firework', 22)
point_cloud('Firework stars', hp, hc, .62, spark); point_cloud('Firework trails', tp, tc, .3, spark)

# Stars on a far dome, denser near the zenith, a few brighter ones.
nstars = 1400
az = rng.uniform(-1.3, 1.3, nstars) + math.pi / 2; el = np.arcsin(rng.uniform(math.sin(math.radians(9)), 1, nstars))
R = 26000
stars = np.stack([R * np.cos(el) * np.cos(az), R * np.cos(el) * np.sin(az), R * np.sin(el)], axis=1)
tone = rng.uniform(.55, 1, (nstars, 1)) * np.array([[.8, .86, 1]]) * (rng.random((nstars, 1)) ** 3 * 1.6 + .15)
point_cloud('Stars', stars, tone, 9, led_material('Star', 6))

# Water: black-blue gloss with fine ripples, so the show and the skyline reflect as long streaks.
bpy.ops.mesh.primitive_plane_add(size=60000, location=(0, 0, -1.1))
water = bpy.context.object; wm = bpy.data.materials.new('Water'); wm.use_nodes = True
bsdf = next(n for n in wm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Base Color'].default_value = (.001, .003, .009, 1); bsdf.inputs['Roughness'].default_value = .09
noise = wm.node_tree.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = .05; noise.inputs['Detail'].default_value = 7
mapping = wm.node_tree.nodes.new('ShaderNodeMapping'); mapping.inputs['Scale'].default_value = (1, 5.0, 1)
tex = wm.node_tree.nodes.new('ShaderNodeTexCoord')
bump = wm.node_tree.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .34
wm.node_tree.links.new(tex.outputs['Object'], mapping.inputs['Vector']); wm.node_tree.links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
wm.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height']); wm.node_tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
water.data.materials.append(wm)

# Very dark blue night sky: deep navy at the zenith, a slightly lighter blue band at the horizon, no pink glow.
world = scene.world; world.use_nodes = True; wt = world.node_tree; wt.nodes.clear()
coord = wt.nodes.new('ShaderNodeTexCoord'); sep = wt.nodes.new('ShaderNodeSeparateXYZ')
ramp = wt.nodes.new('ShaderNodeValToRGB'); bg = wt.nodes.new('ShaderNodeBackground'); wout = wt.nodes.new('ShaderNodeOutputWorld')
els = ramp.color_ramp.elements
els[0].position = 0.0; els[0].color = (.006, .012, .034, 1)
els[1].position = .42; els[1].color = (.0016, .003, .012, 1)
mid = els.new(.06); mid.color = (.0042, .008, .026, 1)
wt.links.new(coord.outputs['Generated'], sep.inputs['Vector']); wt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
wt.links.new(ramp.outputs['Color'], bg.inputs['Color']); wt.links.new(bg.outputs['Background'], wout.inputs['Surface'])
bg.inputs['Strength'].default_value = 1.0
moon = bpy.data.lights.new('Moon', 'SUN'); moon.energy = .06; moon.color = (.7, .78, 1); moon.angle = .02
mo = bpy.data.objects.new('Moon', moon); scene.collection.objects.link(mo); mo.rotation_euler = (math.radians(70), 0, math.radians(-150))

# Audience camera across the water. Lens shift places the formation: right of centre for the wide crop
# (title on the left), upper middle for the tall crop (title above, buttons below over the water).
cam = scene.camera
cam.data.clip_end = 60000; cam.data.sensor_fit = 'VERTICAL'
if WIDE:
    cam.location = (0, -330, 40); cam.data.angle = math.radians(40)
    target = np.array([centre[0], centre[1], centre[2] - 4]); cam.data.shift_x = -.2; cam.data.shift_y = .02
    res = (2400, 1350)
else:
    cam.location = (0, -400, 52); cam.data.angle = math.radians(52)
    target = np.array([centre[0], centre[1], centre[2] - 2]); cam.data.shift_x = 0; cam.data.shift_y = -.06
    res = (1350, 2400)
d = target - np.array(cam.location); pitch = math.atan2(d[2], math.hypot(d[0], d[1])); yaw = math.atan2(d[0], d[1])
cam.rotation_euler = (math.radians(90) + pitch, 0, -yaw)

scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
for kind in ('OPTIX', 'CUDA', 'HIP', 'METAL', 'ONEAPI'):
    try:
        prefs.compute_device_type = kind; prefs.get_devices()
        if any(d.type == kind for d in prefs.devices):
            break
    except TypeError:
        continue
for dev in prefs.devices:
    dev.use = True
scene.cycles.device = 'GPU' if any(dev.use and dev.type != 'CPU' for dev in prefs.devices) else 'CPU'
scene.cycles.samples = 48 if PREVIEW else SAMPLES; scene.cycles.use_denoising = True
scale = .4 if PREVIEW else SCALE
scene.render.resolution_x, scene.render.resolution_y = int(res[0] * scale), int(res[1] * scale)
scene.render.resolution_percentage = 100
try:
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Punchy'
except TypeError:
    pass
scene.view_settings.exposure = .25
scene.use_nodes = True; ct = scene.node_tree; ct.nodes.clear()
rl = ct.nodes.new('CompositorNodeRLayers'); comp = ct.nodes.new('CompositorNodeComposite')
glow = ct.nodes.new('CompositorNodeGlare'); glow.glare_type = 'FOG_GLOW'; glow.quality = 'HIGH'; glow.threshold = .7; glow.size = 8
bloom = ct.nodes.new('CompositorNodeGlare'); bloom.glare_type = 'STREAKS'; bloom.quality = 'HIGH'; bloom.threshold = 3.5; bloom.streaks = 4; bloom.fade = .82; bloom.mix = -.75
ct.links.new(rl.outputs['Image'], glow.inputs['Image']); ct.links.new(glow.outputs['Image'], bloom.inputs['Image']); ct.links.new(bloom.outputs['Image'], comp.inputs['Image'])
OUT.parent.mkdir(parents=True, exist_ok=True)
fmt = 'WEBP' if OUT.suffix.lower() == '.webp' else 'JPEG'
scene.render.image_settings.file_format = fmt; scene.render.image_settings.quality = 84
scene.render.image_settings.color_mode = 'RGB'
scene.render.filepath = str(OUT)
bpy.ops.render.render(write_still=True)
print('Rendered', OUT, scene.render.resolution_x, 'x', scene.render.resolution_y, flush=True)
