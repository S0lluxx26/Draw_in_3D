"""Run with Blender --background --python tools/blender/build_formations.py.
Creates editable mesh assets and deterministic, evenly distributed LED samples.
Coordinates are the application's X/right, Y/up, Z/depth (not Blender Z/up).
"""
import bpy, math, json, pathlib, sys
import numpy as np
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[2]
EXPORT_ONLY = '--export-only' in sys.argv
if not EXPORT_ONLY:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
palette = {'cyan':(.16,.8,1), 'blue':(.12,.3,1), 'silver':(.68,.84,1),
           'gold':(1,.62,.12), 'pink':(1,.12,.38), 'white':(1,1,1),
           'fire':(1,.87,.07), 'dark':(.025,.055,.12)}
materials = {}
for name, color in palette.items():
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if not EXPORT_ONLY: m.diffuse_color=(*color,1)
    materials[name]=m
collection = None
def finish(obj, name, color, fire=False):
    obj.name=name
    for c in list(obj.users_collection): c.objects.unlink(obj)
    collection.objects.link(obj); obj.data.materials.append(materials[color]); obj['fire']=fire
    return obj
def sphere(name, p, scale, color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=p)
    o=bpy.context.object; o.scale=scale
    return finish(o,name,color)
def box(name,p,scale,color):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p)
    o=bpy.context.object; o.scale=scale
    return finish(o,name,color)
def rod(name,a,b,r,color,r2=None,fire=False):
    d=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(Vector(a)+Vector(b))/2)
    o=bpy.context.object; o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return finish(o,name,color,fire)
def mesh(name,vertices,faces,color):
    m=bpy.data.meshes.new(name);m.from_pydata(vertices,[],faces);m.update()
    o=bpy.data.objects.new(name,m);collection.objects.link(o);o.data.materials.append(materials[color]);return o
def rim(name,pts,r,color):
    for a,b in zip(pts,pts[1:]):rod(name,a,b,r,color)
def fin(name,root,tips,color):
    mesh(name,[root]+tips,[(0,i,i+1) for i in range(1,len(tips))],color)
    for p in tips:rod(name+' ray',root,p,.045,'silver')
def fire_jets(xs,y,z=0):
    for x in xs:rod('Yellow exhaust',(x,y-3,z),(x,y,z),.04,'fire',r2=.5,fire=True)
def robot():
    box('Chest',(0,0,0),(6,5.6,2.5),'silver');box('Head',(0,6,0),(7.6,5.3,2.7),'cyan')
    box('Visor',(0,6,1.4),(6,2, .2),'dark')
    for x in [-2,2]:sphere('Eye',(x,6,1.6),(.6,.65,.25),'white')
    box('Mouth',(0,4.3,1.5),(2.5,.3,.2),'gold');rod('Antenna',(0,8.6,0),(0,10,0),.14,'silver');sphere('Antenna light',(0,10,0),(.4,.4,.4),'pink')
    for s in [-1,1]:
        for y in [1,-2.8]:sphere('Arm joint',(s*4,y,0),(.8,.8,.8),'gold')
        rod('Arm',(s*4,1,0),(s*4,-3,0),.6,'blue')
        box('Leg',(s*1.8,-5,0),(1.8,4,1.8),'blue');box('Boot',(s*1.8,-7, .6),(2.6,1.1,3),'silver')
    sphere('Chest reactor',(0,0,1.35),(1.15,1.15,.3),'pink');fire_jets([-1.8,1.8],-7.5)
def fish():
    # Tapered fusiform body; per-face bands and pale belly are baked into LED colours.
    verts=[];faces=[];rings=38;sides=40
    for i in range(rings+1):
        t=i/rings;x=-7+14*t;r=max(.08,math.sin(math.pi*t)**.72)*( .72+.38*t)
        for j in range(sides):
            a=j*2*math.pi/sides;verts.append((x,3.6*r*math.cos(a),1.8*r*math.sin(a)))
    for i in range(rings):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    o=mesh('Fish tapered body',verts,faces,'cyan')
    for c in ['silver','blue','gold']:o.data.materials.append(materials[c])
    for p in o.data.polygons:
        center=sum((Vector(verts[v]) for v in p.vertices),Vector())/len(p.vertices)
        p.material_index=1 if center.y<-.7 else 2 if int((center.x+8)*1.3)%4==0 else 0
    fin('Forked tail',(-6.8,0,0),[(-10,4.9,0),(-9,1.1,0),(-8.7,0,0),(-9,-1.1,0),(-10,-4.9,0)],'gold')
    fin('Dorsal fin',(-3,2,0),[(-4,3.5,0),(-1,6.4,0),(1.4,5.4,0),(3,2.8,0)],'blue')
    fin('Anal fin',(-3,-2,0),[(-3,-3,0),(-1,-5,0),(1.8,-3,0)],'blue')
    for s in [-1,1]:
        sphere('Eye rim',(4.8,1,s*1.05),(.7,.7,.35),'gold');sphere('Eye pupil',(4.9,1,s*1.34),(.34,.38,.15),'dark');sphere('Eye glint',(5,1.16,s*1.47),(.12,.12,.07),'white')
        for offset in [0,.35,.7]:
            rim('Gill',[(3-offset+ .45*math.cos(a),2.35*math.sin(a),s*(1.55+.12*math.cos(a))) for a in np.linspace(-1.15,1.15,18)],.055,'gold')
        fin('Pectoral fin',(1,0,s*1.6),[(-1,-.8,s*3.2),(-3,-1.4,s*2.8),(-1,-1.6,s*1.6)],'gold')
    rim('Lips',[(6.8,.4,0),(7.15,0,0),(6.6,-.35,0)],.12,'pink');fire_jets([-5,-2,1,4],-4)
def tower():
    levels=[(-8,7),(-3,4.5),(3,2.1),(9,.45)]
    for (y,r),(ny,nr) in zip(levels,levels[1:]):
        for sx in [-1,1]:
            for sz in [-1,1]:
                rod('Tower leg',(sx*r,y,sz*r*.45),(sx*nr,ny,sz*nr*.45),.19,'gold')
                rod('Cross brace',(sx*r,y,sz*r*.45),(-sx*nr,ny,sz*nr*.45),.08,'gold')
        box('Observation deck',(0,ny,0),(nr*2+.5,.3,nr+.5),'silver')
    rod('Spire',(0,9,0),(0,11,0),.12,'white');fire_jets([-5,0,5],-8)
def ship():
    verts=[]
    for y,width,length in [(-8,1.8,10),(-3,3.5,14)]:
        verts += [(-length,y,0),(-length+4,y,width),(length-3,y,width),(length,y,0),(length-3,y,-width),(-length+4,y,-width)]
    mesh('Ocean liner hull',verts,[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]+[tuple(range(6)),tuple(range(6,12))],'cyan')
    for y,w,l in [(-2,5.4,19),(0,4.6,16),(2,3.5,11)]:
        box('Passenger deck',(-1,y,0),(l,1.8,w),'silver')
        for x in np.arange(-l/2+1,l/2,1.5):
            for s in [-1,1]:box('Window',(x-1,y,s*(w/2+.02)),(.65,.5,.08),'gold')
    for x in [-3,1]:rod('Funnel',(x,3,0),(x,6,0),.75,'pink')
    rod('Mast',(7,2,0),(7,9,0),.1,'silver');fin('Flag',(7,9,0),[(10,8,0),(7,7.5,0)],'blue');fire_jets([-9,-5,0,5,9],-8)
def star():
    pts=[(math.cos(math.pi/2+i*math.pi/5)*(10 if i%2==0 else 4.2),math.sin(math.pi/2+i*math.pi/5)*(10 if i%2==0 else 4.2),0) for i in range(10)]
    verts=[(0,0,1.8),(0,0,-1.8)]+pts
    mesh('Faceted star',verts,[(0,i+2,(i+1)%10+2) for i in range(10)]+[(1,(i+1)%10+2,i+2) for i in range(10)],'gold');fire_jets([-6,-3,0,3,6],-8)
def fire_row():
    for i in range(9):
        x=(i-4)*3;rod('Flame sculpture',(x,-7,0),(x+.4,5+i%3,0),.95,'fire',r2=.035)
    fire_jets(list(range(-12,13,3)),-6)
def starship():
    rod('Steel fuselage',(0,-5,0),(0,5,0),2,'silver')
    rod('Ogive nose',(0,5,0),(0,11,0),2,'silver',r2=.02)
    for y in np.arange(-4,6,1):
        rim('Panel seam',[(2.02*math.cos(a),y,2.02*math.sin(a)) for a in np.linspace(0,2*math.pi,33)],.035,'blue')
    for s in [-1,1]:
        fin('Lower flap',(s*2,-2,0),[(s*5,-6,0),(s*5,-8,0),(s*2,-5,0)],'blue')
        fin('Upper flap',(s*1.9,6,0),[(s*3.6,3,0),(s*3.6,1,0),(s*2,2,0)],'cyan')
    for x in [-1.2,0,1.2]:rod('Engine bell',(x,-6,0),(x,-5,0),.5,'gold',r2=.25)
    fire_jets([-1.2,0,1.2],-6)

def sample(objects,count,seed):
    triangles=[];colors=[]
    for o in objects:
        if o.type!='MESH':continue
        o.data.calc_loop_triangles()
        for t in o.data.loop_triangles:
            triangles.append([tuple(o.matrix_world @ o.data.vertices[i].co) for i in t.vertices])
            colors.append(tuple(o.data.materials[t.material_index].diffuse_color[:3]))
    tri=np.asarray(triangles);colors=np.asarray(colors)
    areas=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)/2
    rng=np.random.default_rng(seed);idx=rng.choice(len(tri),size=count*8,p=areas/areas.sum())
    uv=rng.random((len(idx),2));uv[uv.sum(axis=1)>1]=1-uv[uv.sum(axis=1)>1]
    points=tri[idx,0]+uv[:,0,None]*(tri[idx,1]-tri[idx,0])+uv[:,1,None]*(tri[idx,2]-tri[idx,0])
    # Greedy farthest-point order: every prefix is itself evenly distributed.
    distances=np.full(len(points),np.inf);chosen=[];next_i=0
    for _ in range(count):
        chosen.append(next_i);delta=points-points[next_i];distances=np.minimum(distances,np.einsum('ij,ij->i',delta,delta));next_i=int(np.argmax(distances))
    return {'positions':np.round(points[chosen],4).tolist(),'colors':np.round(colors[idx[chosen]],3).tolist()}

assets={}
for i,(name,fn) in enumerate([('Robot',robot),('Fish',fish),('Eiffel Tower',tower),('Big ship',ship),('Firework star',star),('Row of fire',fire_row),('Starship launch',starship)]):
    if EXPORT_ONLY:
        collection=bpy.data.collections[name]
    else:
        collection=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(collection);fn()
    bpy.context.view_layer.update()
    assets[name]={'body':sample([o for o in collection.objects if not o.get('fire')],4096,100+i),'fire':sample([o for o in collection.objects if o.get('fire')],512,200+i)}
    print('Exported',name,flush=True)
(ROOT/'assets').mkdir(exist_ok=True)
if not EXPORT_ONLY:
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/drone-formations.blend'),compress=True)
(ROOT/'web/src/formation-assets.js').write_text('// Generated by tools/blender/build_formations.py; do not edit.\nexport default '+json.dumps(assets,separators=(',',':'))+';\n')
