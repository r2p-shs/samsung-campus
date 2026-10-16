import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector,Matrix
R=Path.cwd();args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [];SRC=Path(args[0]) if args else R/'data/rocketbox';OUT=Path(args[1]) if len(args)>1 else R/'data/campus-integration/assets/visitor';OUT.mkdir(parents=True,exist_ok=True)
for ident,gender,outname in [('Male_Adult_09','m','casual-male'),('Female_Adult_05','f','casual-female')]:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 folder=SRC/'Assets/Avatars/Adults'/ident
 bpy.ops.import_scene.fbx(filepath=str(folder/'Export'/(ident+'.fbx')))
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
 for mat in body.data.materials:
  mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear();bs=nodes.new('ShaderNodeBsdfPrincipled');bs.inputs['Roughness'].default_value=.85;output=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(bs.outputs['BSDF'],output.inputs['Surface'])
  imagepath=folder/'Textures'/(mat.name.split('.')[0]+'_color.tga');image=bpy.data.images.load(str(imagepath),check_existing=False);image.scale(min(image.size[0],1024),min(image.size[1],1024));image.pack();tex=nodes.new('ShaderNodeTexImage');tex.image=image;mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
  if 'opacity' in mat.name:mat.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha']);mat.surface_render_method='DITHERED'
  mat.use_backface_culling=False
 bpy.context.scene.frame_set(1);bpy.context.view_layer.update();scale=1.76/body.dimensions.z
 poses=[]
 for kind,path in [('Idle','all_animations_max_motextr_static/'+gender+'_idle_neutral_01.max.fbx'),('Walk','all_animations_max_motextr_xy/'+gender+'_walk_neutral.max.fbx'),('Run','all_animations_max_motextr_xy/'+gender+'_run_neutral.max.fbx')]:
  before=set(bpy.context.scene.objects);bpy.ops.import_scene.fbx(filepath=str(SRC/'Assets/Animations'/path));added=set(bpy.context.scene.objects)-before;source=next(o for o in added if o.type=='ARMATURE');action=source.animation_data.action;rig.animation_data_clear()
  start,end=action.frame_range
  count=1 if kind=='Idle' else (10 if kind=='Run' else 24)
  for i in range(count):
   frame=start if kind=='Idle' else start+(end-start)*i/count;bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
   alignment=rig.matrix_world.to_quaternion().inverted()@source.matrix_world.to_quaternion();desired={}
   for bone in rig.pose.bones:
    src=source.pose.bones.get(bone.name)
    if not src:continue
    q=alignment@src.matrix.to_quaternion();parent=desired.get(bone.parent.name) if bone.parent else None
    localrest=(bone.parent.bone.matrix_local.inverted()@bone.bone.matrix_local) if bone.parent else bone.bone.matrix_local
    bone.rotation_mode='QUATERNION';bone.rotation_quaternion=localrest.to_quaternion().inverted()@(parent.inverted()@q if parent else q);bone.location=(0,0,0);bone.scale=(1,1,1);desired[bone.name]=q
   bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();ev=body.evaluated_get(deps);mesh=bpy.data.meshes.new_from_object(ev,depsgraph=deps);world=ev.matrix_world.copy();center=rig.matrix_world@rig.pose.bones['Bip01 Pelvis'].matrix.translation
   for v in mesh.vertices:v.co=world@v.co;v.co.x-=center.x;v.co.y-=center.y;v.co*=scale
   obj=bpy.data.objects.new(kind if kind=='Idle' else kind+'_'+str(i),mesh);bpy.context.collection.objects.link(obj);poses.append(obj)
  for o in added:bpy.data.objects.remove(o,do_unlink=True)
 zmin=min(v.co.z for o in poses for v in o.data.vertices)
 for o in poses:
  for v in o.data.vertices:v.co.z-=zmin;v.co.x=-v.co.x;v.co.y=-v.co.y
 bpy.ops.object.select_all(action='DESELECT')
 for o in poses:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(outname+'.glb')),export_format='GLB',use_selection=True,export_yup=False,export_animations=False)
 print('BAKED',outname,len(poses),zmin,scale,(OUT/(outname+'.glb')).stat().st_size,flush=True)
