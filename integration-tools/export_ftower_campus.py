"""Run with Blender --background --factory-startup --python this-file.
Canonical SWM GLB is stored Z-up; campus GLB must be glTF Y-up.
"""
import bpy, json, hashlib
from pathlib import Path
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/campus-upper-regularized.glb'
OUT = ROOT / 'data/campus-integration/models/f_tower.glb'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
# Blender import maps raw glTF (u,q,z) to (u,-z,q).
transform = Matrix(((.7441652433144595,0,.6679955768137475,1.13317611772),
                    (-.6679955768137475,0,.7441652433144595,-.4035371367),
                    (0,-1,0,0),(0,0,0,1)))
removed=[]
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        bpy.data.objects.remove(obj, do_unlink=True)
        continue
    # SWM external terrain patches must not cover the campus terrain.
    if 'grade' in obj.name.lower():
        removed.append(obj.name)
        bpy.data.objects.remove(obj, do_unlink=True)
        continue
    obj.matrix_world=transform @ obj.matrix_world

# Merge only materially identical definitions, preserving texture references.
def signature(mat):
    if not mat.use_nodes: return ('plain',tuple(mat.diffuse_color))
    nodes=[]
    for node in mat.node_tree.nodes:
        vals=[]
        for inp in node.inputs:
            if hasattr(inp,'default_value'):
                v=inp.default_value
                vals.append((inp.name,tuple(v) if hasattr(v,'__len__') and not isinstance(v,str) else v))
        nodes.append((node.type,tuple(vals),getattr(getattr(node,'image',None),'name',None)))
    return repr((mat.surface_render_method,mat.use_backface_culling,nodes,[(l.from_node.type,l.from_socket.name,l.to_node.type,l.to_socket.name) for l in mat.node_tree.links]))
canonical={}
for obj in bpy.context.scene.objects:
    for slot in obj.material_slots:
        if slot.material:
            key=signature(slot.material)
            slot.material=canonical.setdefault(key,slot.material)
for img in bpy.data.images:
    w,h=img.size
    if max(w,h)>2048:
        ratio=2048/max(w,h);img.scale(round(w*ratio),round(h*ratio));img.pack()
# Join static meshes by material. Detailed interactive source remains separate.
groups={}
for obj in list(bpy.context.scene.objects):
    key=tuple(slot.material.name if slot.material else '' for slot in obj.material_slots)
    groups.setdefault(key,[]).append(obj)
for objects in groups.values():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1: bpy.ops.object.join()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
OUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_yup=True,
    export_animations=False,export_cameras=False,export_lights=False)
report={'source':str(SOURCE.relative_to(ROOT)),'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'output_sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'bytes':OUT.stat().st_size,
    'excluded_external_grade_objects':removed,'origin_epsg5186':[202148.71,540753.09],
    'ground_local_y':0,'placement_ellipsoid_height':53.251,'units':'meters',
    'axes':'+X grid east, +Y up, -Z grid north','upper_mesh_decimation_ratio':1,
    'upper_facade':'frame-aligned planar color bands; display regularization, not measured blinds',
    'floor_labels':[1,2,3,5,6,7,8,9,10,11],
    'assumptions':['Upper floor layouts repeat floor 3; dimensions are not surveyed.','No height rescaling. Campus terrain and imagery unchanged.']}
OUT.with_suffix('.manifest.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8')
print('CAMPUS_EXPORT',json.dumps(report))
