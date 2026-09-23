"""Drone-show formations, modelled and sampled in Blender 4.5 LTS.

Build (regenerates the meshes, then exports):
    blender --background --factory-startup --python tools/blender/build_formations.py
Export after editing assets/drone-formations.blend by hand:
    blender --background assets/drone-formations.blend --python tools/blender/build_formations.py -- --export-only

Formations stand upright in Blender (Z-up) facing the audience at -Y, the
same convention as build_environment.py. Export converts to the app's
X/right, Y/up, Z/toward-the-audience: app = (x, z, -y).

Each formation is a collection. Object custom properties:
  fire=True   optional exhaust/flame emitters (sampled separately, 512 lights)
  emit=False  occluder only: hides lights inside it but receives none
LED colours come from the 'LED' colour attribute when present (paint it in
Vertex Paint), otherwise from the material's viewport colour.

Sampling (v2):
  * area-weighted surface candidates plus feature-edge candidates, so outlines
    stay crisp with small fleets;
  * candidates inside another closed part are discarded (no hidden clutter);
  * weighted farthest-point ordering: every prefix of the list is itself evenly
    spaced, so 256-4,096 drone fleets all read well;
  * lights facing away from the audience are dimmed (baked, not runtime), which
    keeps silhouettes clean from the front while orbiting still shows depth.
The web asset stores int16 positions and uint8 colours (base64) and decodes to
the same {body:{positions,colors},fire:{...}} shape the app always used.
"""
import bpy, bmesh, math, json, pathlib, sys, base64
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = pathlib.Path(__file__).resolve().parents[2]
EXPORT_ONLY = '--export-only' in sys.argv
BODY, FIRE = 4096, 512
NAMES = ['Robot', 'Fish', 'Eiffel Tower', 'Big ship', 'Firework star', 'Row of fire', 'Starship launch']
AUDIENCE_LIGHT = np.array(Vector((-0.3, 0.42, 0.86)).normalized())  # app coordinates
APP_TO_BLENDER = Matrix.Rotation(math.radians(90), 4, 'X')  # modelled in app axes, stored Z-up
to_app = lambda a: np.stack([a[..., 0], a[..., 2], -a[..., 1]], axis=-1)

palette = {'cyan': (.16, .8, 1), 'blue': (.12, .3, 1), 'silver': (.68, .84, 1), 'gold': (1, .62, .12),
           'pink': (1, .12, .38), 'white': (1, 1, 1), 'fire': (1, .87, .07), 'dark': (.025, .055, .12),
           'orange': (1, .38, .06)}

def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def ramp(stops, t):
    """Piecewise-linear colour ramp; stops = [(t, colour), ...] sorted by t."""
    if t <= stops[0][0]:
        return stops[0][1]
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t <= t1:
            return lerp(c0, c1, (t - t0) / max(1e-9, t1 - t0))
    return stops[-1][1]

# ---------------------------------------------------------------- modelling helpers
class Part:
    """bmesh builder that writes an 'LED' corner colour for every face corner."""
    def __init__(self, color):
        self.bm = bmesh.new()
        self.led = self.bm.loops.layers.float_color.new('LED')
        self.color = color if callable(color) else (lambda p, c=color: c)

    def face(self, pts):
        vs = [self.bm.verts.new(Vector(p)) for p in pts]
        f = self.bm.faces.new(vs)
        for loop in f.loops:
            loop[self.led] = (*self.color(loop.vert.co), 1.0)
        return f

    def loft(self, rings, caps=True):
        """Connect equal-length closed rings of points, with optional end caps."""
        n = len(rings[0])
        for r0, r1 in zip(rings, rings[1:]):
            for i in range(n):
                j = (i + 1) % n
                self.face([r0[i], r0[j], r1[j], r1[i]])
        if caps:
            self.face(list(reversed(rings[0])))
            self.face(rings[-1])

    def lathe(self, axis_pts, radii, sides=24, squash=(1, 1)):
        """Surface of revolution along a polyline of centre points with radii."""
        rings = []
        for i, (c, r) in enumerate(zip(axis_pts, radii)):
            c = Vector(c)
            a = Vector(axis_pts[min(i + 1, len(axis_pts) - 1)]) - Vector(axis_pts[max(i - 1, 0)])
            a.normalize()
            s = a.cross(Vector((0, 0, 1)) if abs(a.z) < .9 else Vector((1, 0, 0))).normalized()
            u = a.cross(s).normalized()
            rings.append([c + (s * math.cos(t) * squash[0] + u * math.sin(t) * squash[1]) * max(r, 1e-3)
                          for t in (k * 2 * math.pi / sides for k in range(sides))])
        self.loft(rings)

    def tube(self, a, b, r, r2=None, sides=10):
        self.lathe([a, b], [r, r if r2 is None else r2], sides)

    def path(self, pts, r, sides=8, closed=False):
        pts = [Vector(p) for p in pts]
        if closed:
            pts = pts + [pts[0], pts[1]]
        self.lathe(pts, [r] * len(pts), sides)

    def box(self, c, size, bevel=0.0):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2])) + Vector(c)
        if bevel > 0:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=3, affect='EDGES', profile=0.5)
        self.merge(bm)

    def sphere(self, c, r, seg=24, rings=12):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
        r = r if isinstance(r, (tuple, list)) else (r, r, r)
        for v in bm.verts:
            v.co = Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2])) + Vector(c)
        self.merge(bm)

    def prism(self, outline, z0, z1):
        """Extrude a closed 2D outline (x, y) between two depths."""
        self.loft([[(x, y, z0) for x, y in outline], [(x, y, z1) for x, y in outline]])

    def merge(self, other):
        me = bpy.data.meshes.new('tmp'); other.to_mesh(me); other.free()
        verts = [self.bm.verts.new(v.co) for v in me.vertices]
        for p in me.polygons:
            f = self.bm.faces.new([verts[i] for i in p.vertices])
            for loop in f.loops:
                loop[self.led] = (*self.color(loop.vert.co), 1.0)
        bpy.data.meshes.remove(me)

    def finish(self, name, material, fire=False, emit=True, smooth=True):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free()
        me.materials.append(materials[material])
        me.color_attributes.active_color = me.color_attributes['LED']
        for p in me.polygons:
            p.use_smooth = smooth
        o = bpy.data.objects.new(name, me)
        o.matrix_world = APP_TO_BLENDER
        collection.objects.link(o)
        o['fire'] = fire; o['emit'] = emit
        return o

def flame(name, base, height, radius, twist=0.0, sides=18, fire=True, lean=0.0):
    """Twisting teardrop flame: white-hot base, yellow body, orange/red tips."""
    ts = np.linspace(0, 1, 16)
    col = lambda p: ramp([(0, (1, .98, .7)), (.35, (1, .85, .12)), (.7, (1, .45, .05)), (1, (1, .14, .05))], (p.y - base[1]) / height)
    part = Part(col)
    pts = [(base[0] + math.sin(t * 3.1 + twist) * radius * .35 * t + lean * t * t * height, base[1] + t * height, base[2] + math.cos(t * 2.3 + twist) * radius * .2 * t) for t in ts]
    radii = [radius * (math.sin(math.pi * min(1, t * 1.25)) ** .7) * (1 - t) ** .55 + .02 for t in ts]
    part.lathe(pts, radii, sides)
    return part.finish(name, 'fire', fire=fire)

def exhaust(xs, y, z=0.0, length=3.2, r=.5):
    """Optional falling-fire emitters under a formation (fire=True)."""
    col = lambda p: ramp([(0, (1, 1, .85)), (.3, (1, .86, .1)), (1, (1, .3, .03))], (y - p.y) / length)
    part = Part(col)
    n = 14
    for x in xs:
        part.lathe([(x, y - length * k / n, z) for k in range(n + 1)], [.04 + r * math.sin(math.pi * .5 * k / n) * (1 - .55 * k / n) for k in range(n + 1)], 14)
    part.finish('Exhaust', 'fire', fire=True)

def fin(name, root, tips, color, material='gold', thick=.08):
    """Single-sided fin membrane with raised rays (rays get edge emphasis)."""
    part = Part(color)
    for a, b in zip(tips, tips[1:]):
        part.face([root, a, b])
    part.finish(name, material, smooth=False)
    rays = Part(lambda p: (1, .85, .45))
    for t in tips:
        rays.tube(root, t, thick, thick * .5, 6)
    rays.finish(name + ' rays', 'gold')

# ---------------------------------------------------------------- formations
def robot():
    steel = lambda p: ramp([(-8, (.35, .55, 1)), (0, (.62, .82, 1)), (4, (.85, .95, 1))], p.y)
    head = Part(lambda p: ramp([(4, (.1, .62, 1)), (8.6, (.35, .95, 1))], p.y)); head.box((0, 6.3, 0), (6.6, 4.6, 3.2), .55); head.finish('Head', 'cyan')
    visor = Part(palette['dark']); visor.box((0, 6.3, 1.25), (5.4, 2.6, .9), .3); visor.finish('Visor', 'dark', emit=False)
    eyes = Part((1, 1, 1))
    for x in (-1.35, 1.35):
        eyes.sphere((x, 6.55, 1.75), (.62, .62, .22))
    eyes.finish('Eyes', 'white')
    smile = Part(palette['gold']); smile.path([(math.sin(a) * 1.35, 5.8 - math.cos(a) * .35, 1.72) for a in np.linspace(-1.1, 1.1, 12)], .11); smile.finish('Smile', 'gold')
    ears = Part(palette['pink'])
    for s in (-1, 1):
        ears.tube((s * 3.3, 6.3, 0), (s * 4.0, 6.3, 0), .75, .75, 16); ears.tube((s * 4.0, 6.3, 0), (s * 4.25, 6.3, 0), .45, .45, 16)
    ears.finish('Ears', 'pink')
    ant = Part(palette['silver']); ant.tube((0, 8.6, 0), (0, 10.2, 0), .1, .1); ant.finish('Antenna', 'silver')
    bulb = Part(palette['pink']); bulb.sphere((0, 10.45, 0), .42); bulb.finish('Antenna light', 'pink')
    neck = Part(palette['silver']); neck.tube((0, 3.3, 0), (0, 4.1, 0), .85, .85, 16); neck.finish('Neck', 'silver')
    torso = Part(steel); torso.box((0, .25, 0), (6.2, 6.0, 3.0), .6); torso.finish('Torso', 'silver')
    panel = Part(palette['dark']); panel.box((0, .5, 1.25), (4.0, 3.6, .8), .25); panel.finish('Chest panel', 'dark', emit=False)
    heart = Part(palette['pink'])
    outline = [(16 * math.sin(a) ** 3 * .075, (13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)) * .075 + .8) for a in np.linspace(0, 2 * math.pi, 40, endpoint=False)]
    heart.prism(outline, 1.55, 1.85); heart.finish('Heart', 'pink', smooth=False)
    buttons = Part(palette['gold'])
    for x in (-1.2, 0, 1.2):
        buttons.tube((x, -1.05, 1.55), (x, -1.05, 1.8), .26, .26, 14)
    buttons.finish('Buttons', 'gold')
    belt = Part(palette['gold']); belt.box((0, -2.55, 0), (6.4, .5, 3.2), .15); belt.finish('Belt', 'gold')
    arms = Part(lambda p: ramp([(-5, (.12, .3, 1)), (6, (.3, .6, 1))], p.y))
    joints = Part(palette['gold'])
    # The left arm rests; the right arm waves.
    for a, b, c in [((-3.6, 2.2, 0), (-5.0, -.6, .3), (-4.6, -3.2, .8)), ((3.6, 2.2, 0), (6.0, 3.6, .3), (6.8, 6.6, .6))]:
        arms.tube(a, b, .62, .56, 14); arms.tube(b, c, .56, .5, 14)
        joints.sphere(a, .82); joints.sphere(b, .72)
        hand = Vector(c) + (Vector(c) - Vector(b)).normalized() * .5
        joints.sphere(tuple(hand), (.78, .78, .6))
    arms.finish('Arms', 'blue'); joints.finish('Joints', 'gold')
    legs = Part(lambda p: ramp([(-7.6, (.1, .22, .9)), (-2.8, (.28, .5, 1))], p.y))
    boots = Part(palette['silver'])
    for s in (-1, 1):
        legs.tube((s * 1.6, -2.8, 0), (s * 1.7, -6.6, 0), .95, .85, 16)
        boots.box((s * 1.8, -7.35, .45), (2.5, 1.2, 3.2), .35)
    legs.finish('Legs', 'blue'); boots.finish('Boots', 'silver')
    exhaust([-1.8, 1.8], -8.0, .4, 3.0, .55)

def fish():
    rings, sides = 44, 44
    def body_color(p):
        base = ramp([(-3.6, (.92, .97, 1)), (-1.2, (.55, .82, 1)), (1.0, (.1, .72, 1)), (3.6, (.12, .3, 1))], p.y)
        stripe = int((p.x + 8) * 1.25) % 4 == 0 and p.y > -1.6
        return (1, .62, .12) if stripe else base
    body = Part(body_color)
    loops = []
    for i in range(rings + 1):
        t = i / rings; x = -7 + 14 * t
        r = max(.06, math.sin(math.pi * t) ** .72) * (.72 + .38 * t)
        bend = .55 * math.sin((t - .15) * math.pi * 1.2)  # a gentle S-bend reads as swimming
        loops.append([(x, 3.7 * r * math.cos(a), 1.9 * r * math.sin(a) + bend) for a in (j * 2 * math.pi / sides for j in range(sides))])
    body.loft(loops)
    body.finish('Fish body', 'cyan')
    tail = lambda p: ramp([(-10.5, (1, .35, .1)), (-7, (1, .7, .15))], p.x)
    fin('Forked tail', (-6.6, 0, -.35), [(-10.6, 5.1, -.3), (-9.6, 2.4, -.3), (-8.8, .3, -.3), (-9.6, -2.4, -.3), (-10.6, -5.1, -.3)], tail)
    fin('Dorsal fin', (-2.6, 2.9, .2), [(-4.2, 3.4, .1), (-2.4, 5.9, .1), (-.4, 6.6, .2), (1.6, 5.2, .3), (2.8, 3.2, .4)], lambda p: (.15, .45, 1), 'blue')
    fin('Anal fin', (-2.4, -2.7, 0), [(-3.6, -3.2, 0), (-1.8, -5.2, 0), (1.4, -3.1, .2)], lambda p: (.15, .45, 1), 'blue')
    for s in (-1, 1):
        eye = Part(palette['gold']); eye.sphere((4.75, .95, s * 1.18 + .55), (.78, .78, .38)); eye.finish('Eye rim', 'gold')
        pupil = Part(palette['dark']); pupil.sphere((4.86, .95, s * 1.5 + .55), (.4, .44, .16)); pupil.finish('Eye pupil', 'dark', emit=False)
        glint = Part((1, 1, 1)); glint.sphere((4.98, 1.18, s * 1.62 + .55), (.14, .14, .08)); glint.finish('Eye glint', 'white')
        gills = Part((1, .75, .3))
        for off in (0, .38, .76):
            gills.path([(3 - off + .45 * math.cos(a), 2.3 * math.sin(a), s * (1.62 + .12 * math.cos(a)) + .55) for a in np.linspace(-1.15, 1.15, 18)], .06)
        gills.finish('Gills', 'gold')
        fin('Pectoral fin', (1.2, -.4, s * 1.7 + .55), [(-1, -1.2, s * 3.2 + .55), (-2.8, -1.8, s * 2.9 + .55), (-1.2, -2.1, s * 1.8 + .55)], lambda p: (1, .5, .2))
    lips = Part(palette['pink']); lips.path([(6.85, .45, .55), (7.2, 0, .55), (6.65, -.4, .55)], .13); lips.finish('Lips', 'pink')
    bubbles = Part((.75, .95, 1))
    for c, r in [((8.6, 2.6, .5), .45), ((9.6, 4.6, .3), .6), ((10.4, 7.0, .1), .75)]:
        bubbles.path([(c[0] + r * math.cos(a), c[1] + r * math.sin(a), c[2]) for a in np.linspace(0, 2 * math.pi, 24, endpoint=False)], .07, closed=True)
    bubbles.finish('Bubbles', 'white')
    exhaust([-5, -2, 1, 4], -4.2, .4, 3.0, .45)

def tower():
    half = lambda y: .38 + 6.2 * ((9.2 - y) / 17.2) ** 2.6
    gold = lambda p: ramp([(-8, (1, .5, .08)), (2, (1, .66, .18)), (9, (1, .84, .45))], p.y)
    legs, braces = Part(gold), Part(gold)
    ys = np.linspace(-8, 8.6, 34)
    for sx in (-1, 1):
        for sz in (-1, 1):
            legs.lathe([(sx * half(y), y, sz * half(y)) for y in ys], [.34 * (1 - .6 * (y + 8) / 16.6) + .08 for y in ys], 8)
    corners = [(1, 1), (1, -1), (-1, -1), (-1, 1), (1, 1)]
    at = lambda y, k: (k[0] * half(y), y, k[1] * half(y))
    levels = [-8, -6.2, -4.6, -3.3, -1.6, 0.0, 1.5, 3.4, 5.4, 7.2, 8.6]
    for y0, y1 in zip(levels, levels[1:]):
        for face in range(4):
            a, b = corners[face], corners[face + 1]
            braces.tube(at(y0, a), at(y1, b), .07, .07, 6); braces.tube(at(y0, b), at(y1, a), .07, .07, 6)
    legs.finish('Tower legs', 'gold'); braces.finish('Lattice braces', 'gold')
    arches = Part((1, .72, .3))
    for face in (0, 2):  # front and back arches; side arches clutter the audience view
        rot = Matrix.Rotation(face * math.pi / 2, 3, 'Y')
        pts = [rot @ Vector((math.cos(a) * half(-8) * .8, -8 + math.sin(a) * 4.0, half(-6.0))) for a in np.linspace(.12, math.pi - .12, 22)]
        arches.path([tuple(p) for p in pts], .14, 8)
    arches.finish('Base arches', 'gold')
    decks = Part((1, .94, .78))
    for y, pad in [(-3.3, .55), (1.5, .35), (7.2, .18)]:
        w = half(y) * 2 + pad * 2
        decks.box((0, y, 0), (w, .42, w), .08)
    decks.finish('Observation decks', 'white')
    spire = Part((1, 1, 1)); spire.tube((0, 8.6, 0), (0, 11.0, 0), .16, .05, 8); spire.finish('Spire', 'white')
    beacon = Part((1, 1, .9)); beacon.sphere((0, 9.1, 0), (.55, .45, .55)); beacon.finish('Beacon', 'white')
    exhaust([-5, 0, 5], -8.2, 0, 3.2, .55)

def ship():
    # Lofted hull with a raised bow; red below the waterline.
    hull = Part(lambda p: (1, .12, .3) if p.y < -6.6 else ramp([(-6.6, (.08, .38, 1)), (-3, (.2, .7, 1))], p.y))
    loops = []
    for x in np.linspace(-14, 14, 40):
        t = (x + 14) / 28
        beam = 3.6 * (1 - max(0, (t - .72) / .28) ** 1.6) * (1 - max(0, (.08 - t) / .08) ** 2 * .35) + .05
        top = -2.8 + 3.6 * max(0, t - .7) ** 1.5
        keel = -8 + 1.4 * max(0, t - .85) / .15 + .8 * max(0, .1 - t) / .1
        side = [(keel + (top - keel) * k / 17, beam * math.sin(math.pi * .5 * (.35 + .65 * k / 17)) ** .6) for k in range(18)]
        loops.append([(x, y, z) for y, z in side] + [(x, y, -z) for y, z in reversed(side)])
    hull.loft(loops)
    hull.finish('Hull', 'cyan')
    decks = Part(lambda p: ramp([(-3, (.8, .92, 1)), (3, (1, 1, 1))], p.y)); windows = Part((1, .7, .25))
    for y, w, l, x0 in [(-1.9, 6.2, 22, -1.5), (0.0, 5.2, 18, -1.8), (1.9, 4.2, 12.5, -2.2), (3.5, 3.0, 6, -2.8)]:
        decks.box((x0, y, 0), (l, 1.75, w), .18)
        for x in np.arange(x0 - l / 2 + 1, x0 + l / 2 - .5, 1.2):
            for s in (-1, 1):
                windows.box((x, y + .1, s * (w / 2 + .03)), (.55, .5, .06))
    decks.finish('Decks', 'silver'); windows.finish('Windows', 'gold')
    funnels = Part(lambda p: (1, .1, .28) if p.y > 6.2 else (1, .95, .9))
    for x in (-5.2, -1.2):
        funnels.lathe([(x, 4.2, 0), (x - .5, 7.4, 0)], [1.05, .9], 20, squash=(1.1, .85))
    funnels.finish('Funnels', 'pink')
    caps = Part(palette['dark'])
    for x in (-5.2, -1.2):
        caps.tube((x - .48, 7.3, 0), (x - .52, 7.6, 0), .92, .88, 20)
    caps.finish('Funnel caps', 'dark', emit=False)
    rig = Part(palette['silver']); rig.tube((6.5, 3.6, 0), (6.8, 10.2, 0), .1, .06, 8); rig.tube((-9, 1.2, 0), (-9.2, 6.6, 0), .09, .05, 8); rig.finish('Masts', 'silver')
    lights = Part(lambda p: [(1, .85, .3), (1, .3, .5), (.3, .8, 1)][int(abs(p.x) * 1.7) % 3])
    for a, b, sag in [((13.8, -2.2, 0), (6.8, 10.2, 0), 1.2), ((6.8, 10.2, 0), (-9.2, 6.6, 0), 2.2), ((-9.2, 6.6, 0), (-13.8, -2.6, 0), .9)]:
        a, b = Vector(a), Vector(b)
        for k in range(23):
            t = k / 22
            lights.sphere(tuple(a + (b - a) * t - Vector((0, sag * 4 * t * (1 - t), 0))), .2, 8, 5)
    lights.finish('String lights', 'gold')
    boats = Part((1, .5, .1))
    for x in np.arange(-8, 3.1, 2.2):
        for s in (-1, 1):
            boats.sphere((x, .9, s * 2.75), (.8, .32, .32), 12, 6)
    boats.finish('Lifeboats', 'orange')
    wake = Part((.3, .75, 1))
    for off in (0, .9):
        for s in (-1, 1):
            wake.path([(x, -8.6 - off + .25 * math.sin(x * 1.3 + off * 3 + (s > 0)), s * (3.4 + off)) for x in np.linspace(-14.5, 14.5, 60)], .1)
    wake.finish('Wake', 'cyan')
    exhaust([-9, -5, 0, 5, 9], -8.6, 0, 3.0, .5)

def star():
    part = Part(lambda p: ramp([(0, (1, .55, .08)), (4.5, (1, .78, .25)), (10.2, (1, .98, .88))], math.hypot(p.x, p.y)))
    outer = [(math.cos(math.pi / 2 + i * math.pi / 5) * (10 if i % 2 == 0 else 4.1), math.sin(math.pi / 2 + i * math.pi / 5) * (10 if i % 2 == 0 else 4.1)) for i in range(10)]
    front, back = (0, 0, 2.2), (0, 0, -2.2)
    for i in range(10):
        a = (*outer[i], 0); b = (*outer[(i + 1) % 10], 0)
        part.face([front, a, b]); part.face([back, b, a])
    part.finish('Faceted star', 'gold', smooth=False)
    halo = Part((1, .9, .55))
    halo.path([(12.2 * math.cos(a), 12.2 * math.sin(a), 0) for a in np.linspace(0, 2 * math.pi, 96, endpoint=False)], .12, closed=True)
    halo.finish('Halo ring', 'white')
    rays = Part((1, 1, .95))
    for i in range(5):
        a = math.pi / 2 + i * 2 * math.pi / 5 + math.pi / 5
        rays.tube((math.cos(a) * 5.2, math.sin(a) * 5.2, 0), (math.cos(a) * 8.6, math.sin(a) * 8.6, 0), .12, .03, 6)
    rays.finish('Sparkle rays', 'white')
    exhaust([-6, -3, 0, 3, 6], -8.6, 0, 3.0, .45)

def fire_row():
    for i in range(9):
        flame('Flame sculpture', ((i - 4) * 3.0, -7.2, (i % 2) * .8 - .4), 11.5 + 1.6 * (i % 3), 1.25, twist=i * 1.7, fire=False, lean=.05 * (i - 4))
    brazier = Part((1, .45, .1))
    brazier.path([(x, -7.4, .9 * math.sin(x * .8)) for x in np.linspace(-13.5, 13.5, 60)], .22)
    brazier.finish('Brazier rail', 'orange')
    exhaust(list(range(-12, 13, 3)), -7.6, 0, 3.0, .45)

def starship():
    # Stainless steel with a cool sheen; the far side (heat shield) is darker.
    steel = lambda p: tuple(v * (1 if p.z > -.9 else .45) for v in ramp([(-6, (.55, .7, 1)), (2, (.78, .9, 1)), (11, (.95, .98, 1))], p.y + .6 * p.x))
    hull = Part(steel)
    nose = np.linspace(.15, math.pi / 2, 12)
    ys = list(np.linspace(-5.2, 5, 18)) + [5 + 6 * (1 - math.cos(a)) for a in nose]
    radii = [2.0] * 18 + [2.0 * math.cos(a) ** .55 + .02 for a in nose]
    hull.lathe([(0, y, 0) for y in ys], radii, 40)
    hull.finish('Steel fuselage', 'silver')
    seams = Part((.35, .6, 1))
    for y in np.arange(-4.4, 5.1, 1.2):
        seams.path([(2.04 * math.cos(a), y, 2.04 * math.sin(a)) for a in np.linspace(-.2, math.pi + .2, 30)], .045, 6)
    seams.finish('Panel seams', 'blue')
    flaps = Part((.22, .78, 1))
    for s in (-1, 1):
        flaps.prism([(s * 2.0, -1.2), (s * 5.2, -5.4), (s * 5.2, -7.4), (s * 2.0, -5.2)][::s], -.18, .18)
        flaps.prism([(s * 1.9, 7.6), (s * 3.5, 4.8), (s * 3.5, 3.0), (s * 1.95, 3.4)][::s], -.14, .14)
    flaps.finish('Flaps', 'cyan', smooth=False)
    bells = Part(palette['gold'])
    for x, z, r in [(-.8, .45, .42), (.8, .45, .42), (0, -.9, .42), (-1.25, -.9, .55), (1.25, -.9, .55), (0, 1.3, .55)]:
        bells.lathe([(x, -5.2, z), (x, -6.3, z)], [r * .55, r], 16)
    bells.finish('Engine bells', 'gold')
    plume = Part(lambda p: ramp([(0, (1, 1, .9)), (.25, (1, .9, .2)), (1, (1, .35, .05))], (-6.3 - p.y) / 5.5))
    for x, z in [(-.8, .45), (.8, .45), (0, -.9)]:
        plume.lathe([(x, -6.3 - 5.5 * k / 14, z) for k in range(15)], [.35 + .45 * math.sin(math.pi * .5 * k / 14) - .25 * (k / 14) ** 3 for k in range(15)], 14)
    plume.finish('Exhaust plume', 'fire', fire=True)

BUILDERS = {'Robot': robot, 'Fish': fish, 'Eiffel Tower': tower, 'Big ship': ship,
            'Firework star': star, 'Row of fire': fire_row, 'Starship launch': starship}

# ---------------------------------------------------------------- sampling
def mesh_data(o):
    """World-space triangles, corner colours, face normals and feature edges."""
    ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    me.calc_loop_triangles()
    mw = o.matrix_world
    nmw = mw.to_3x3().inverted_safe().transposed()
    verts = to_app(np.array([tuple(mw @ v.co) for v in me.vertices]).reshape(-1, 3))
    loop_vertex = np.array([l.vertex_index for l in me.loops], dtype=np.int64)
    led = me.color_attributes.get('LED')
    if led is not None and led.domain == 'CORNER':
        corner = np.array([tuple(d.color[:3]) for d in led.data]).reshape(-1, 3)
    elif led is not None and led.domain == 'POINT':
        corner = np.array([tuple(led.data[v].color[:3]) for v in loop_vertex]).reshape(-1, 3)
    else:
        mats = [m.diffuse_color[:3] if m else (1, 1, 1) for m in me.materials] or [(1, 1, 1)]
        corner = np.zeros((len(me.loops), 3))
        for p in me.polygons:
            corner[list(p.loop_indices)] = mats[min(p.material_index, len(mats) - 1)]
    vertex_color = np.zeros((len(verts), 3)); hits = np.zeros(len(verts))
    np.add.at(vertex_color, loop_vertex, corner); np.add.at(hits, loop_vertex, 1)
    vertex_color /= np.maximum(hits, 1)[:, None]
    tris = np.array([t.vertices[:] for t in me.loop_triangles], dtype=np.int64).reshape(-1, 3)
    loops = np.array([t.loops[:] for t in me.loop_triangles], dtype=np.int64).reshape(-1, 3)
    normals = to_app(np.array([tuple((nmw @ t.normal).normalized()) for t in me.loop_triangles]).reshape(-1, 3))
    polys = [p.vertices[:] for p in me.polygons]
    bm = bmesh.new(); bm.from_mesh(me)
    closed = len(bm.edges) > 0 and all(e.is_manifold for e in bm.edges)
    edges = []  # boundary edges and creases sharper than ~35 degrees
    for e in bm.edges:
        fs = e.link_faces
        if len(fs) == 1 or (len(fs) == 2 and fs[0].normal.angle(fs[1].normal, 0) > math.radians(35)):
            n = sum((f.normal for f in fs), Vector()).normalized()
            edges.append((e.verts[0].index, e.verts[1].index, to_app(np.array(nmw @ n))))
    bm.free()
    ev.to_mesh_clear()
    return {'verts': verts, 'tris': tris, 'colors': corner[loops], 'normals': normals, 'edges': edges,
            'vertex_color': vertex_color, 'polys': polys, 'closed': closed}

def sample(objects, count, seed):
    rng = np.random.default_rng(seed)
    data = {o.name: mesh_data(o) for o in objects if o.type == 'MESH'}
    emitting = [o.name for o in objects if o.type == 'MESH' and o.get('emit', True) and len(data[o.name]['tris'])]
    occluders = [(name, BVHTree.FromPolygons([tuple(v) for v in d['verts']], d['polys']), d['verts'].min(0) - 1e-3, d['verts'].max(0) + 1e-3)
                 for name, d in data.items() if d['closed']]
    tri = np.concatenate([data[n]['verts'][data[n]['tris']] for n in emitting])
    col = np.concatenate([data[n]['colors'] for n in emitting])
    nrm = np.concatenate([data[n]['normals'] for n in emitting])
    owner = np.concatenate([[n] * len(data[n]['tris']) for n in emitting])
    open_part = np.concatenate([[not data[n]['closed']] * len(data[n]['tris']) for n in emitting])
    areas = np.linalg.norm(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1) / 2
    m = count * 10
    idx = rng.choice(len(tri), size=m, p=areas / areas.sum())
    uv = rng.random((m, 2)); flip = uv.sum(axis=1) > 1; uv[flip] = 1 - uv[flip]
    w = np.stack([1 - uv[:, 0] - uv[:, 1], uv[:, 0], uv[:, 1]], axis=1)
    points = np.einsum('ij,ijk->ik', w, tri[idx]); colors = np.einsum('ij,ijk->ik', w, col[idx])
    normals, owners, opened, weights = nrm[idx], owner[idx], open_part[idx], np.ones(m)
    # Feature-edge candidates, spaced about a third of the expected light spacing.
    spacing = math.sqrt(areas.sum() / count) * .33
    ep, ec, en, eo, eopen = [], [], [], [], []
    for name in emitting:
        d = data[name]
        for a, b, n in d['edges']:
            pa, pb = d['verts'][a], d['verts'][b]
            k = max(1, int(np.linalg.norm(pb - pa) / spacing))
            for t in (np.arange(k) + rng.random()) / k:
                ep.append(pa + (pb - pa) * t); ec.append(d['vertex_color'][a] * (1 - t) + d['vertex_color'][b] * t)
                en.append(n); eo.append(name); eopen.append(not d['closed'])
    if ep:
        points = np.concatenate([points, ep]); colors = np.concatenate([colors, ec]); normals = np.concatenate([normals, en])
        owners = np.concatenate([owners, eo]); opened = np.concatenate([opened, eopen]); weights = np.concatenate([weights, np.full(len(ep), 1.3)])
    # Discard candidates inside any other closed part (hidden from every view).
    keep = np.ones(len(points), dtype=bool)
    for name, bvh, lo, hi in occluders:
        for i in np.nonzero(np.all((points > lo) & (points < hi), axis=1) & (owners != name))[0]:
            loc, normal, _, _ = bvh.find_nearest(Vector(points[i]))
            if loc is not None and (Vector(points[i]) - loc).dot(normal) < -2e-3:
                keep[i] = False
    points, colors, normals, opened, weights = points[keep], colors[keep], normals[keep], opened[keep], weights[keep]
    # Weighted farthest-point order: every prefix is evenly spread.
    w2 = weights ** 2
    distances = np.full(len(points), np.inf)
    chosen, nxt = [], int(np.argmax(points[:, 1]))
    for _ in range(count):
        chosen.append(nxt)
        delta = points - points[nxt]
        distances = np.minimum(distances, np.einsum('ij,ij->i', delta, delta))
        nxt = int(np.argmax(distances * w2))
    chosen = np.array(chosen)
    p, c, n, two_sided = points[chosen], np.clip(colors[chosen], 0, 1), normals[chosen], opened[chosen]
    facing = n @ AUDIENCE_LIGHT
    lam = np.clip(np.where(two_sided, np.abs(facing), facing), 0, 1)
    return p, np.clip(c * (.42 + .58 * lam)[:, None], 0, 1)

def encode(p, c):
    lo, hi = p.min(0), p.max(0)
    q = np.round((p - lo) / np.maximum(hi - lo, 1e-6) * 65535 - 32768).astype('<i2')
    return {'n': len(p), 'min': [round(float(v), 5) for v in lo], 'max': [round(float(v), 5) for v in hi],
            'p': base64.b64encode(q.tobytes()).decode(), 'c': base64.b64encode(np.round(c * 255).astype(np.uint8).tobytes()).decode()}

DECODER = '''const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function decode(g){const view=new DataView(bytes(g.p).buffer),c=bytes(g.c),positions=[],colors=[];
  for(let i=0;i<g.n;i++){positions.push([0,1,2].map(k=>Math.round((g.min[k]+(view.getInt16((i*3+k)*2,true)+32768)/65535*(g.max[k]-g.min[k]))*1e4)/1e4));colors.push([0,1,2].map(k=>Math.round(c[i*3+k]/255*1e3)/1e3));}
  return {positions,colors};}
export default Object.fromEntries(Object.entries(data).map(([name,f])=>[name,{body:decode(f.body),fire:decode(f.fire)}]));
'''

# ---------------------------------------------------------------- main
if not EXPORT_ONLY:
    bpy.ops.wm.read_factory_settings(use_empty=True)
materials = {}
for name, color in palette.items():
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if not EXPORT_ONLY:
        m.diffuse_color = (*color, 1)
    materials[name] = m
collection = None
encoded = {}
for i, name in enumerate(NAMES):
    if EXPORT_ONLY:
        collection = bpy.data.collections[name]
    else:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
        BUILDERS[name]()
    bpy.context.view_layer.update()
    objects = list(collection.all_objects)
    body = sample([o for o in objects if not o.get('fire')], BODY, 100 + i)
    fire = sample([o for o in objects if o.get('fire')], FIRE, 200 + i)
    encoded[name] = {'body': encode(*body), 'fire': encode(*fire)}
    print('Exported', name, flush=True)
if not EXPORT_ONLY:
    (ROOT / 'assets').mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/drone-formations.blend'), compress=True)
(ROOT / 'web/src/formation-assets.js').write_text(
    '// Generated by tools/blender/build_formations.py; do not edit.\n'
    '// int16 positions (per-group bounds) and uint8 LED colours, base64-encoded.\n'
    'const data=' + json.dumps(encoded, separators=(',', ':')) + ';\n' + DECODER)
