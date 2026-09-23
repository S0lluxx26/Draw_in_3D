"""Night harbour stage and quadcopter model for the Sky Studio drone show.

Run with Blender 4.5 LTS:
    blender --background --factory-startup --python tools/blender/build_environment.py

Creates assets/sky-stage.blend (editable source) and exports
web/src/assets/sky-stage.glb (Draco-compressed, loaded lazily by the show).
Everything is generated from fixed seeds, so the output is reproducible.

Blender is Z-up; the glTF exporter converts to the app's Y-up. The audience
camera sits at Blender -Y (app +Z) looking across the water toward +Y.
Runtime code finds nodes and materials by the names used here:
  nodes:     Drone (parent of DroneFrame and DroneLED), Beacons; the rest is scenery
  materials: Deck, DeckLights, Buildings, Roofs, Beacons, Shore, ShoreLights,
             Mountains, Hills, Bridge, BridgeLights, BuoyLights, DroneBody, DroneLED
"""
import bpy, bmesh, math, pathlib, random, sys
from mathutils import Vector, noise

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT_BLEND = ROOT / 'assets' / 'sky-stage.blend'
OUT_GLB = ROOT / 'web' / 'src' / 'assets' / 'sky-stage.glb'
EXPORT_ONLY = '--export-only' in sys.argv

# ---------------------------------------------------------------- materials
def material(name, base=(0.02, 0.02, 0.025), emit=None, strength=1.0, rough=0.8, metal=0.0, image=None, emit_image=None, alpha=1.0, vcol=False):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial'); out.location = (400, 0)
    bsdf = nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (100, 0)
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = (*base, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if alpha < 1:
        bsdf.inputs['Alpha'].default_value = alpha
    if image is not None:
        tex = nodes.new('ShaderNodeTexImage'); tex.image = image; tex.location = (-300, 150)
        links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if vcol:
        attr = nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Color'; attr.location = (-300, 150)
        links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    if emit is not None or emit_image is not None:
        bsdf.inputs['Emission Strength'].default_value = strength
        if emit_image is not None:
            tex = nodes.new('ShaderNodeTexImage'); tex.image = emit_image; tex.location = (-300, -200)
            links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
        else:
            bsdf.inputs['Emission Color'].default_value = (*emit, 1)
    m.diffuse_color = (*base, 1)
    return m

def window_image(size=512, cells=32, seed=7):
    """Emissive facade atlas: lit, dim and dark windows in floor-wise clusters."""
    rng = random.Random(seed)
    px = [0.0] * (size * size * 4)
    cell = size // cells
    warm, cool, teal = (1.0, 0.72, 0.42), (0.72, 0.84, 1.0), (0.5, 0.95, 0.9)
    for cy in range(cells):
        floor_bias = rng.random()  # whole floors tend to be lit together (offices)
        for cx in range(cells):
            r = rng.random()
            lit = r < 0.06 + 0.34 * floor_bias ** 3
            if lit:
                hue = rng.random()
                c = warm if hue < 0.62 else cool if hue < 0.92 else teal
                k = 0.35 + 0.65 * rng.random()
            else:
                c, k = (0.30, 0.36, 0.5), 0.05
            for y in range(cy * cell + 3, cy * cell + cell - 2):
                for x in range(cx * cell + 3, cx * cell + cell - 3):
                    i = (y * size + x) * 4
                    px[i:i + 4] = [c[0] * k, c[1] * k, c[2] * k, 1.0]
    for i in range(3, len(px), 4):
        px[i] = 1.0
    img = bpy.data.images.get('windows') or bpy.data.images.new('windows', size, size, alpha=False)
    img.pixels.foreach_set(px)
    img.file_format = 'PNG'
    img.pack()
    return img

def deck_image(size=256):
    """Launch deck: dark composite panels with faint seams and painted safety lines."""
    px = []
    for y in range(size):
        for x in range(size):
            v = 0.05 + 0.012 * noise.noise(Vector((x * 0.03, y * 0.03, 0.3)))
            if x % 32 in (0, 1) or y % 32 in (0, 1):
                v *= 0.55
            if 3 <= x < 5 or size - 5 <= x < size - 3 or 3 <= y < 5 or size - 5 <= y < size - 3:
                px += [0.55, 0.42, 0.08, 1.0]
                continue
            px += [v, v * 1.04, v * 1.1, 1.0]
    img = bpy.data.images.get('deck') or bpy.data.images.new('deck', size, size, alpha=False)
    img.pixels.foreach_set(px)
    img.file_format = 'PNG'
    img.pack()
    return img

# ---------------------------------------------------------------- mesh helpers
class Mesh:
    def __init__(self):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.col = None

    def face(self, pts, uvs=None, mat=0, colors=None):
        vs = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(vs)
        f.material_index = mat
        if uvs:
            for loop, uv in zip(f.loops, uvs):
                loop[self.uv].uv = uv
        if colors:
            if self.col is None:
                self.col = self.bm.loops.layers.float_color.new('Color')
            for loop, c in zip(f.loops, colors):
                loop[self.col] = (*c, 1.0)
        return f

    def box(self, center, size, facade=None, mat_side=0, mat_top=0, uv_scale=1.0):
        """Axis-aligned box; facade=(cell_w, floor_h, offset_u, offset_v) maps windows in metres."""
        cx, cy, cz = center; sx, sy, sz = (s / 2 for s in size)
        x0, x1, y0, y1, z0, z1 = cx - sx, cx + sx, cy - sy, cy + sy, cz - sz, cz + sz
        def side(a, b, width):
            pts = [(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)]
            if facade:
                cw, fh, ou, ov = facade
                uvs = [(ou, ov), (ou + width / cw / 32, ov), (ou + width / cw / 32, ov + (z1 - z0) / fh / 32), (ou, ov + (z1 - z0) / fh / 32)]
            else:
                uvs = [(0, 0), (width * uv_scale, 0), (width * uv_scale, (z1 - z0) * uv_scale), (0, (z1 - z0) * uv_scale)]
            self.face(pts, uvs, mat_side)
        side((x0, y0), (x1, y0), x1 - x0); side((x1, y0), (x1, y1), y1 - y0)
        side((x1, y1), (x0, y1), x1 - x0); side((x0, y1), (x0, y0), y1 - y0)
        top_uv = [(x0 * uv_scale, y0 * uv_scale), (x1 * uv_scale, y0 * uv_scale), (x1 * uv_scale, y1 * uv_scale), (x0 * uv_scale, y1 * uv_scale)]
        self.face([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], top_uv, mat_top)
        self.face([(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)], None, mat_top)

    def tube(self, a, b, r, sides=6, mat=0, r2=None):
        a, b = Vector(a), Vector(b)
        d = b - a
        if d.length < 1e-6:
            return
        axis = d.normalized()
        side = axis.cross(Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))).normalized()
        up = axis.cross(side)
        r2 = r if r2 is None else r2
        ring = lambda c, rr: [c + (side * math.cos(t) + up * math.sin(t)) * rr for t in (i * 2 * math.pi / sides for i in range(sides))]
        ra, rb = ring(a, r), ring(b, r2)
        for i in range(sides):
            j = (i + 1) % sides
            self.face([ra[i], ra[j], rb[j], rb[i]], None, mat)

    def light(self, p, r, mat=0):
        """Octahedral light bulb: eight triangles, reads as a point from a distance."""
        p = Vector(p)
        ax = [Vector((r, 0, 0)), Vector((0, r, 0)), Vector((-r, 0, 0)), Vector((0, -r, 0))]
        top, bottom = p + Vector((0, 0, r)), p - Vector((0, 0, r))
        for i in range(4):
            self.face([top, p + ax[i], p + ax[(i + 1) % 4]], None, mat)
            self.face([bottom, p + ax[(i + 1) % 4], p + ax[i]], None, mat)

    def object(self, name, materials, collection, smooth=False):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me); self.bm.free()
        for m in materials:
            me.materials.append(m)
        for p in me.polygons:
            p.use_smooth = smooth
        if len(me.color_attributes):
            me.color_attributes.active_color = me.color_attributes[0]
            me.color_attributes.render_color_index = 0
        o = bpy.data.objects.new(name, me)
        collection.objects.link(o)
        return o

def collection(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    return c

# ---------------------------------------------------------------- the stage
def build_stage(root):
    M = {n: bpy.data.materials[n] for n in ['Deck', 'DeckLights', 'Buildings', 'Roofs', 'Beacons', 'Shore', 'ShoreLights', 'Mountains', 'Hills', 'Bridge', 'BridgeLights', 'BuoyLights']}
    rng = random.Random(2026)

    # Floating launch deck, 200 m x 170 m, top at water level + 0.
    deck = Mesh()
    deck.box((0, 0, -2.0), (200, 170, 4.0), mat_side=0, mat_top=0, uv_scale=1 / 50)
    for x in range(-96, 97, 8):
        for y in (-84, 84):
            deck.light((x, y, 0.6), 0.35, 1)
    for y in range(-80, 81, 8):
        for x in (-99, 99):
            deck.light((x, y, 0.6), 0.35, 1)
    # Crew cabin and equipment containers give the deck a sense of scale.
    deck.box((-86, 72, 2.4), (14, 8, 4.8), mat_side=0, mat_top=0, uv_scale=1 / 50)
    for i in range(4):
        deck.box((-60 + i * 7.5, 78, 1.3), (6.1, 2.4, 2.6), mat_side=0, mat_top=0, uv_scale=1 / 50)
    for i in range(3):
        deck.light((-92 + i * 6, 68.5, 4.2), 0.45, 1)
    deck.object('Launch deck', [M['Deck'], M['DeckLights']], root)

    # Marker buoys around the deck (port red / starboard green / white).
    buoys = Mesh()
    for i in range(18):
        a = i / 18 * 2 * math.pi
        p = (math.cos(a) * 150, math.sin(a) * 135, 0)
        buoys.tube((p[0], p[1], -1), (p[0], p[1], 1.6), 0.6, 8, 0)
        buoys.light((p[0], p[1], 2.2), 0.5, 1 + i % 3)
    lights = [bpy.data.materials['BuoyLights']]
    for name, c in [('BuoyRed', (1, .08, .05)), ('BuoyGreen', (.1, 1, .35))]:
        lights.append(material(name, emit=c, strength=6.0))
    buoys.object('Buoys', [M['Shore'], lights[0], lights[1], lights[2]], root)

    # Far shore embankment with promenade lights.
    shore = Mesh()
    shore.box((0, 1060, -1), (9000, 80, 8), mat_side=0, mat_top=0, uv_scale=1 / 40)
    for x in range(-3600, 3601, 16):
        shore.light((x + rng.uniform(-2, 2), 1022, 7.5), 1.0, 1)
    shore.object('Shore', [M['Shore'], M['ShoreLights']], root)

    # Skyline: rows of towers with metre-true window atlases and roof beacons.
    city, beacons = Mesh(), Mesh()
    def tower_at(x, y, w, d, h):
        facade = (rng.choice([3.2, 3.6, 4.0]), rng.choice([3.4, 3.8]), rng.randrange(32) / 32, rng.randrange(32) / 32)
        city.box((x, y, h / 2), (w, d, h), facade=facade, mat_side=0, mat_top=1)
        if h > 70:  # setbacks and crowns on taller towers
            sh = h * rng.uniform(0.12, 0.3)
            city.box((x, y, h + sh / 2), (w * 0.7, d * 0.7, sh), facade=facade, mat_side=0, mat_top=1)
            h += sh
            if rng.random() < 0.5:
                city.tube((x, y, h), (x, y, h + h * 0.18), 0.9, 6, 1, r2=0.15)
                h += h * 0.18
            beacons.light((x, y, h + 1.5), 1.6, 0)
    for row, (y0, spread, hmin, hmax) in enumerate([(1150, 16, 8, 30), (1300, 22, 14, 62), (1480, 30, 24, 105), (1700, 34, 18, 78)]):
        x = -3400.0
        while x < 3400:
            w = rng.uniform(18, 44)
            centre = math.exp(-((x + 260) / 700) ** 2) + 0.6 * math.exp(-((x - 1150) / 420) ** 2)
            h = hmin + (hmax - hmin) * min(1, 0.25 + centre * rng.uniform(0.6, 1.25) + 0.2 * rng.random())
            tower_at(x + w / 2, y0 + rng.uniform(-spread, spread), w, rng.uniform(18, 40), h)
            x += w + rng.uniform(4, 16)
    city.object('Skyline', [M['Buildings'], M['Roofs']], root)
    beacons.object('Beacons', [M['Beacons']], root)

    # Suspension bridge crossing the right-hand bay.
    bridge, blights = Mesh(), Mesh()
    A, B, H = Vector((380, 520, 0)), Vector((2300, 1560, 0)), 44.0
    axis = (B - A).normalized(); across = Vector((-axis.y, axis.x, 0))
    length = (B - A).length
    towers = [0.28, 0.72]
    def at(t, z=H):
        p = A + (B - A) * t
        return Vector((p.x, p.y, z))
    for s in (-1, 1):  # deck girders
        bridge.tube(at(0) + across * 12 * s, at(1) + across * 12 * s, 1.2, 4, 0)
    for i in range(0, 101, 4):
        t = i / 100
        bridge.tube(at(t) - across * 12, at(t) + across * 12, 0.5, 4, 0)
        for s in (-1, 1):
            blights.light(at(t) + across * 12.5 * s + Vector((0, 0, 1.5)), 0.8, 0)
    for t in towers:
        for s in (-1, 1):
            bridge.tube(at(t, -5) + across * 13 * s, at(t, 175) + across * 11 * s, 3.2, 6, 0, r2=2.4)
        for z in (55, 120, 170):
            bridge.tube(at(t, z) - across * 12, at(t, z) + across * 12, 2.0, 4, 0)
        for s in (-1, 1):
            blights.light(at(t, 180) + across * 11 * s, 1.8, 1)
    def cable_z(t):
        # Parabolic main span and side spans between tower tops and anchorages.
        t0, t1 = towers
        if t < t0:
            return 60 + (175 - 60) * (t / t0) ** 1.3
        if t > t1:
            return 60 + (175 - 60) * ((1 - t) / (1 - t1)) ** 1.3
        u = (t - t0) / (t1 - t0)
        return 175 - 4 * (175 - 62) * u * (1 - u)
    for s in (-1, 1):
        prev = None
        for i in range(0, 161):
            t = i / 160
            p = at(t, cable_z(t)) + across * 11.5 * s
            if prev is not None:
                bridge.tube(prev, p, 0.7, 4, 0)
            prev = p
            if i % 2 == 0:
                blights.light(p + Vector((0, 0, 1.2)), 0.7, 0)
            if i % 4 == 0 and cable_z(t) > H + 3:
                bridge.tube(at(t, H) + across * 11.5 * s, p, 0.15, 3, 0)
    bridge.object('Bridge', [M['Bridge']], root)
    gold = material('BridgeTowerLights', emit=(1.0, .35, .12), strength=8.0)
    blights.object('Bridge lights', [M['BridgeLights'], gold], root)

    # Layered hills and mountains; vertex colours fade toward the horizon.
    def ridge(name, y0, y1, x_extent, hmin, hmax, freq, seed, mat, near, far, nx=180, ny=14):
        m = Mesh()
        grid = []
        for j in range(ny + 1):
            v = j / ny
            row = []
            for i in range(nx + 1):
                u = i / nx
                x = -x_extent + 2 * x_extent * u
                y = y0 + (y1 - y0) * v
                n = noise.fractal(Vector((x * freq, seed, v * 1.7)), 0.6, 2.1, 5)
                profile = math.sin(math.pi * v) ** 0.8
                z = max(-5.0, (hmin + (hmax - hmin) * (0.5 + 0.55 * n)) * profile)
                row.append((x, y, z))
            grid.append(row)
        for j in range(ny):
            for i in range(nx):
                q = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
                cols = []
                for p in q:
                    k = max(0.0, min(1.0, p[2] / hmax))
                    cols.append(tuple(near[c] + (far[c] - near[c]) * k for c in range(3)))
                m.face(q, None, 0, cols)
        return m.object(name, [mat], root, smooth=True)
    ridge('Hills', 2100, 2700, 6000, 30, 150, 0.0018, 3.0, M['Hills'], (.006, .01, .016), (.018, .03, .05))
    ridge('Mountains', 3600, 5200, 9000, 100, 560, 0.0007, 9.0, M['Mountains'], (.014, .024, .042), (.05, .07, .11))

def build_drone(root):
    """0.62 m quadcopter: frame and rotors (one mesh) plus a separately tinted LED dome."""
    body, led = bpy.data.materials['DroneBody'], bpy.data.materials['DroneLED']
    frame = Mesh()
    frame.box((0, 0, 0.0), (0.2, 0.2, 0.07), mat_side=0, mat_top=0)
    frame.box((0, 0, 0.05), (0.12, 0.14, 0.04), mat_side=0, mat_top=0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            tip = Vector((sx * 0.21, sy * 0.21, 0.01))
            frame.tube((sx * 0.06, sy * 0.06, 0.0), tip, 0.014, 6, 0)
            frame.tube(tip - Vector((0, 0, 0.02)), tip + Vector((0, 0, 0.035)), 0.028, 10, 0)
            # Rotor disc (two blades as flat quads) reads at close range.
            c = tip + Vector((0, 0, 0.04))
            for a in (0.4 + sx * sy * 0.3, 0.4 + sx * sy * 0.3 + math.pi / 2):
                d = Vector((math.cos(a), math.sin(a), 0)) * 0.12
                n = Vector((-math.sin(a), math.cos(a), 0)) * 0.012
                frame.face([c - d - n, c + d - n, c + d + n, c - d + n])
                frame.face([c - d + n, c + d + n, c + d - n, c - d - n])
    for sx in (-1, 1):  # landing skids
        frame.tube((sx * 0.07, -0.09, -0.035), (sx * 0.07, -0.09, -0.1), 0.006, 4, 0)
        frame.tube((sx * 0.07, 0.09, -0.035), (sx * 0.07, 0.09, -0.1), 0.006, 4, 0)
        frame.tube((sx * 0.07, -0.12, -0.1), (sx * 0.07, 0.12, -0.1), 0.007, 4, 0)
    f = frame.object('DroneFrame', [body], root)
    bulb = Mesh()
    for i in range(8):  # hemispherical LED dome under the body
        a0, a1 = i * math.pi / 4, (i + 1) * math.pi / 4
        for j in range(3):
            b0, b1 = j * math.pi / 6, (j + 1) * math.pi / 6
            p = lambda a, b: (math.cos(a) * math.cos(b) * 0.045, math.sin(a) * math.cos(b) * 0.045, -0.035 - math.sin(b) * 0.045)
            bulb.face([p(a0, b0), p(a1, b0), p(a1, b1), p(a0, b1)][::-1])
    l = bulb.object('DroneLED', [led], root, smooth=True)
    empty = bpy.data.objects.new('Drone', None)
    root.objects.link(empty)
    f.parent = empty; l.parent = empty
    empty.location = (0, 0, -60)  # parked below the water; the app reads it by name

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    windows, deck = window_image(), deck_image()
    material('Deck', base=(1, 1, 1), rough=0.75, image=deck)
    material('DeckLights', emit=(1.0, 0.62, 0.28), strength=5.0)
    material('Buildings', base=(0.012, 0.016, 0.024), rough=0.6, metal=0.2, emit_image=windows, strength=1.6)
    material('Roofs', base=(0.01, 0.012, 0.018), rough=0.9)
    material('Beacons', emit=(1.0, 0.05, 0.03), strength=10.0)
    material('Shore', base=(0.012, 0.014, 0.018), rough=0.95)
    material('ShoreLights', emit=(1.0, 0.8, 0.55), strength=6.0)
    material('Mountains', rough=1.0, vcol=True)
    material('Hills', rough=1.0, vcol=True)
    material('Bridge', base=(0.03, 0.035, 0.045), rough=0.5, metal=0.6)
    material('BridgeLights', emit=(0.75, 0.88, 1.0), strength=7.0)
    material('BuoyLights', emit=(1.0, 0.95, 0.85), strength=6.0)
    material('DroneBody', base=(0.035, 0.038, 0.045), rough=0.35, metal=0.55)
    material('DroneLED', base=(0.9, 0.9, 0.9), emit=(1, 1, 1), strength=2.0, rough=0.2)
    env = collection('Environment')
    build_stage(env)
    build_drone(collection('DroneModel'))
    # A camera matching the app's audience view makes the .blend immediately previewable.
    cam = bpy.data.objects.new('Audience camera', bpy.data.cameras.new('Audience camera'))
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (0, -380, 110); cam.rotation_euler = (math.radians(90), 0, 0)
    cam.data.sensor_fit = 'VERTICAL'; cam.data.angle = math.radians(46); cam.data.clip_end = 12000
    bpy.context.scene.camera = cam
    world = bpy.data.worlds.new('Night'); world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.008, 0.02, 1)
    bpy.context.scene.world = world
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND), compress=True)

def export():
    OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    # Export only the named collections (not the preview camera/world).
    for o in bpy.context.scene.objects:
        o.select_set(o.users_collection[0].name in ('Environment', 'DroneModel'))
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB), export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
        export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_image_format='AUTO',
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=8,
        export_draco_texcoord_quantization=12, export_draco_color_quantization=8,
        export_cameras=False, export_lights=False, export_extras=False)
    print('Exported', OUT_GLB, OUT_GLB.stat().st_size, 'bytes', flush=True)

if EXPORT_ONLY:
    export()
else:
    build()
    export()
