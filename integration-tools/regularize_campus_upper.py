"""Regularize vertex-colored reconstruction into frame-aligned planar strips.
This is a display regularization, not measured blind geometry.
"""
from pathlib import Path
import struct,json,numpy as np
R=Path(__file__).resolve().parents[1]
src=R/'viewer/assets/ftower-plans/ftower-with-plans.glb'
b=src.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);blob=bytearray(b[28+n:])
def acc(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5121:'u1',5123:'<u2',5125:'<u4'}[a['componentType']]
 out=np.frombuffer(blob,dtype=dt,count=a['count']*{'VEC3':3,'VEC4':4,'SCALAR':1}[a['type']],offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],-1).copy()
 return out.astype(float)/np.iinfo(out.dtype).max if a.get('normalized') and out.dtype.kind=='u' else out
node=next(x for x in g['nodes'] if x.get('name')=='registered_multiview_upper');mesh=g['meshes'][node['mesh']];p=mesh['primitives'][0];pos=acc(p['attributes']['POSITION']);col=acc(p['attributes']['COLOR_0']);bounds=[pos.min(0),pos.max(0)]
xs=[float(bounds[0][0]),float(bounds[1][0])]
for node in g['nodes']:
 if node.get('name','').startswith('frame_registered_vertical_'):
  a=g['accessors'][g['meshes'][node['mesh']]['primitives'][0]['attributes']['POSITION']]
  x=(a['min'][0]+a['max'][0])/2
  if xs[0]<x<xs[1]:xs.append(x)
xs=sorted(xs);zs=np.linspace(bounds[0][2],bounds[1][2],249)
verts=[];colors=[];faces=[]
for x0,x1 in zip(xs,xs[1:]):
 chosen=(pos[:,0]>=x0)&(pos[:,0]<=x1);cp=pos[chosen];cc=col[chosen,:3];rows=[]
 for z0,z1 in zip(zs,zs[1:]):
  mask=(cp[:,2]>=z0)&(cp[:,2]<z1)
  rows.append(np.median(cc[mask],axis=0) if mask.any() else np.median(cc,axis=0))
 rows=np.asarray(rows)
 for j,(z0,z1) in enumerate(zip(zs,zs[1:])):
  rgb=np.median(rows[max(0,j-1):min(len(rows),j+2)],axis=0)
  q=float(bounds[0][1]);k=len(verts);verts.extend([[x0,q,z0],[x1,q,z0],[x1,q,z1],[x0,q,z1]])
  colors.extend([list(rgb)+[1]]*4);faces.extend([[k,k+1,k+2],[k,k+2,k+3]])
def add(data,kind,component,target):
 while len(blob)%4:blob.append(0)
 a=np.asarray(data,dtype='<f4' if component==5126 else '<u4');off=len(blob);blob.extend(a.tobytes());vi=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':a.nbytes,'target':target});ai=len(g['accessors']);g['accessors'].append({'bufferView':vi,'componentType':component,'count':len(a),'type':kind,'min':a.min(0).tolist(),'max':a.max(0).tolist()});return ai
v=add(verts,'VEC3',5126,34962);c=add(colors,'VEC4',5126,34962);i=add(np.asarray(faces).reshape(-1,1),'SCALAR',5125,34963)
mesh['primitives']=[{'attributes':{'POSITION':v,'COLOR_0':c},'indices':i,'mode':4}]
g['buffers'][0]['byteLength']=len(blob);j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
out=struct.pack('<III',0x46546c67,2,28+len(j)+len(blob))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(blob),0x004e4942)+blob
(R/'data/campus-upper-regularized.glb').write_bytes(out)
(R/'data/campus-upper-regularized.json').write_text(json.dumps({'source':str(src),'columns':len(xs)-1,'bands_per_column':248,'triangles':len(faces),'depth_range':float(np.ptp(pos[:,1])),'preserved':'All other meshes, doors, stairs and lower floors unchanged','interpretation':'Window-wise median color bands; not surveyed blind geometry'},indent=2),encoding='utf8')
print('Upper facade regularized:',len(faces),'triangles;',len(xs)-1,'frame-aligned columns')
