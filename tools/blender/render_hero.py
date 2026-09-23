"""Cycles hero image of the Sky Studio show for the README (docs/media/sky-studio-hero.jpg).

    blender --background assets/sky-stage.blend --python tools/blender/render_hero.py -- [--samples 160] [--formation Fish]

Uses the real exported formation LEDs (web/src/formation-assets.js) at the demo's
default 6x scale over the harbour stage, with glossy water and compositor glow.
"""
import bpy, base64, json, math, pathlib, re, sys
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opt = lambda name, default: args[args.index(name) + 1] if name in args else default
SAMPLES, FORMATION = int(opt('--samples', 160)), opt('--formation', 'Fish')
OUT = ROOT / 'docs' / 'media' / 'sky-studio-hero.jpg'

def formation(name):
    text = (ROOT / 'web/src/formation-assets.js').read_text()
    data = json.loads(re.search(r'const data=(\{.*?\});\n', text, re.S).group(1))[name]['body']
    q = np.frombuffer(base64.b64decode(data['p']), dtype='<i2').reshape(-1, 3).astype(float)
    lo, hi = np.array(data['min']), np.array(data['max'])
    p = lo + (q + 32768) / 65535 * (hi - lo)
    c = np.frombuffer(base64.b64decode(data['c']), dtype=np.uint8).reshape(-1, 3) / 255
    return p, c

scene = bpy.context.scene
# LEDs: a point cloud with per-point colour, emission shader, demo placement (app -> Blender axes).
p, c = formation(FORMATION)
app = np.stack([p[:, 0] * 6, (p[:, 1] + 18) * 6, p[:, 2] * 6], axis=1)
verts = [(x, -z, y) for x, y, z in app]
me = bpy.data.meshes.new('LEDs'); me.from_pydata(verts, [], []); me.update()
attr = me.color_attributes.new('led', 'FLOAT_COLOR', 'POINT')
for i, col in enumerate(c):
    attr.data[i].color = (*(col ** 2.2), 1)
leds = bpy.data.objects.new('LEDs', me); scene.collection.objects.link(leds)
gn = leds.modifiers.new('points', 'NODES')
tree = bpy.data.node_groups.new('LED points', 'GeometryNodeTree')
tree.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
tree.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
nodes, links = tree.nodes, tree.links
gi, go = nodes.new('NodeGroupInput'), nodes.new('NodeGroupOutput')
to_points = nodes.new('GeometryNodeMeshToPoints'); to_points.inputs['Radius'].default_value = .26
setmat = nodes.new('GeometryNodeSetMaterial')
led_mat = bpy.data.materials.new('LED'); led_mat.use_nodes = True
lt = led_mat.node_tree; lt.nodes.clear()
emit = lt.nodes.new('ShaderNodeEmission'); emit.inputs['Strength'].default_value = 28
col = lt.nodes.new('ShaderNodeAttribute'); col.attribute_name = 'led'
out = lt.nodes.new('ShaderNodeOutputMaterial')
lt.links.new(col.outputs['Color'], emit.inputs['Color']); lt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
setmat.inputs['Material'].default_value = led_mat
links.new(gi.outputs['Geometry'], to_points.inputs['Mesh']); links.new(to_points.outputs['Points'], setmat.inputs['Geometry']); links.new(setmat.outputs['Geometry'], go.inputs['Geometry'])
gn.node_group = tree

# Water: dark gloss with gentle ripples reflects the show and the skyline.
bpy.ops.mesh.primitive_plane_add(size=40000, location=(0, 0, -1.1))
water = bpy.context.object; wm = bpy.data.materials.new('Water'); wm.use_nodes = True
bsdf = wm.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (.002, .004, .008, 1); bsdf.inputs['Roughness'].default_value = .06
noise = wm.node_tree.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = .045; noise.inputs['Detail'].default_value = 6
bump = wm.node_tree.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .12
wm.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height']); wm.node_tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
water.data.materials.append(wm)

# Night sky: zenith-to-horizon gradient with warm city glow, plus a moon disc.
world = scene.world; world.use_nodes = True; wt = world.node_tree; wt.nodes.clear()
coord = wt.nodes.new('ShaderNodeTexCoord'); sep = wt.nodes.new('ShaderNodeSeparateXYZ')
ramp = wt.nodes.new('ShaderNodeValToRGB'); bg = wt.nodes.new('ShaderNodeBackground'); wout = wt.nodes.new('ShaderNodeOutputWorld')
ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[0].color = (.03, .026, .03, 1)
ramp.color_ramp.elements[1].position = .35; ramp.color_ramp.elements[1].color = (.002, .004, .011, 1)
wt.links.new(coord.outputs['Generated'], sep.inputs['Vector']); wt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
wt.links.new(ramp.outputs['Color'], bg.inputs['Color']); wt.links.new(bg.outputs['Background'], wout.inputs['Surface'])
bg.inputs['Strength'].default_value = 1.0
moon = bpy.data.lights.new('Moon', 'SUN'); moon.energy = .08; moon.color = (.7, .78, 1); moon.angle = .02
mo = bpy.data.objects.new('Moon', moon); scene.collection.objects.link(mo); mo.rotation_euler = (math.radians(70), 0, math.radians(-150))
bpy.ops.mesh.primitive_uv_sphere_add(radius=60, location=(2400, 4200, 1900))
disc = bpy.context.object; dm = bpy.data.materials.new('MoonDisc'); dm.use_nodes = True
dn = dm.node_tree.nodes; dn.clear(); de = dn.new('ShaderNodeEmission'); de.inputs['Color'].default_value = (1, .95, .86, 1); de.inputs['Strength'].default_value = 3
do = dn.new('ShaderNodeOutputMaterial'); dm.node_tree.links.new(de.outputs['Emission'], do.inputs['Surface']); disc.data.materials.append(dm)

# Audience camera matching the app's director framing for a held formation.
cam = scene.camera
cam.location = (0, -300, 46); cam.data.sensor_fit = 'VERTICAL'; cam.data.angle = math.radians(46)
direction = np.array([0, 300, 108 - 46.0]); pitch = math.atan2(direction[2], direction[1])
cam.rotation_euler = (math.radians(90) + pitch, 0, 0)

scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
for kind in ('OPTIX', 'CUDA', 'HIP', 'METAL', 'ONEAPI'):
    try:
        prefs.compute_device_type = kind; prefs.get_devices()
        if any(d.type == kind for d in prefs.devices):
            break
    except TypeError:
        continue
for d in prefs.devices:
    d.use = True
scene.cycles.device = 'GPU' if any(d.use and d.type != 'CPU' for d in prefs.devices) else 'CPU'
scene.cycles.samples = SAMPLES; scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1600, 900
scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Punchy'
scene.use_nodes = True; ct = scene.node_tree; ct.nodes.clear()
rl = ct.nodes.new('CompositorNodeRLayers'); glare = ct.nodes.new('CompositorNodeGlare'); comp = ct.nodes.new('CompositorNodeComposite')
glare.glare_type = 'FOG_GLOW'; glare.quality = 'HIGH'; glare.threshold = .8; glare.size = 7
ct.links.new(rl.outputs['Image'], glare.inputs['Image']); ct.links.new(glare.outputs['Image'], comp.inputs['Image'])
OUT.parent.mkdir(parents=True, exist_ok=True)
scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 86
scene.render.filepath = str(OUT)
bpy.ops.render.render(write_still=True)
print('Rendered', OUT, flush=True)
