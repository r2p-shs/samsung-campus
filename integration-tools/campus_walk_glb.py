"""Make the accepted GLB's untextured primitives valid for Cesium shaders."""
import json,struct,copy
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def prepare():
 b=(R/'viewer/assets/ftower-plans/ftower-with-plans.glb').read_bytes()
 n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);tail=b[20+n:];cache={};count=0
 def clean(x):
  if isinstance(x,dict):return {k:clean(v) for k,v in x.items() if not k.lower().endswith('texture')}
  if isinstance(x,list):return [clean(v) for v in x]
  return x
 for m in g['meshes']:
  for p in m['primitives']:
   if 'TEXCOORD_0' not in p['attributes'] and 'material' in p:
    i=p['material'];mat=g['materials'][i];fixed=clean(mat)
    if fixed!=mat:
     if i not in cache:cache[i]=len(g['materials']);g['materials'].append(fixed)
     p['material']=cache[i];count+=1
 j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
 out=struct.pack('<III',0x46546c67,2,20+len(j)+len(tail))+struct.pack('<II',len(j),0x4e4f534a)+j+tail
 (R/'data/campus-integration/models/f_tower_walk.glb').write_bytes(out)
 print('Removed invalid texture references from',count,'UV-less primitives; geometry unchanged')
if __name__=='__main__':prepare()
