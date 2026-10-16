"""Preserve outward photo facades, give their interior faces clear glazing."""
from pathlib import Path
import json,struct,copy,numpy as np

def glaze(path):
 p=Path(path);b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);blob=bytearray(b[28+n:]);types={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}
 def read(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];w={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];d=np.dtype(types[a['componentType']]);return np.ndarray((a['count'],w),dtype=d,buffer=blob,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',w*d.itemsize),d.itemsize)).copy()
 def index(a):
  a=np.asarray(a,dtype='<u4').reshape(-1);blob.extend(b'\0'*((-len(blob))%4));o=len(blob);blob.extend(a.tobytes());g['bufferViews'].append({'buffer':0,'byteOffset':o,'byteLength':a.nbytes});g['accessors'].append({'bufferView':len(g['bufferViews'])-1,'componentType':5125,'count':len(a),'type':'SCALAR','min':[int(a.min())],'max':[int(a.max())]});return len(g['accessors'])-1
 glass=len(g['materials']);g['materials'].append({'name':'Campus_interior_clear_glazing','doubleSided':False,'alphaMode':'BLEND','pbrMetallicRoughness':{'baseColorFactor':[.68,.86,.92,.12],'metallicFactor':0,'roughnessFactor':.15}})
 count=0
 for node in g['nodes']:
  name=node.get('name','')
  if not name.startswith(('accepted_source.','accepted_southeast_photo.')):continue
  mesh=g['meshes'][node['mesh']];out=[]
  for prim in mesh['primitives']:
   v=read(prim['attributes']['POSITION']);tri=read(prim['indices']).reshape(-1,3) if 'indices'in prim else np.arange(len(v)).reshape(-1,3);pts=v[tri];center=pts.mean(1);normal=np.cross(pts[:,1]-pts[:,0],pts[:,2]-pts[:,0]);length=np.linalg.norm(normal,axis=1);normal/=np.maximum(length[:,None],1e-12)
   selected=(abs(normal[:,2])<.4)&((center[:,0]<-29.8)|(center[:,0]>27.8)|(center[:,1]>19.5))&(center[:,2]>1)
   if not selected.any():out.append(prim);continue
   if (~selected).any():q=copy.deepcopy(prim);q['indices']=index(tri[~selected]);out.append(q)
   faces=tri[selected].copy();c=center[selected];radial=c.copy();radial[:,2]=0;flip=(normal[selected]*radial).sum(1)<0;faces[flip]=faces[flip][:,[0,2,1]]
   mat=copy.deepcopy(g['materials'][prim['material']]);mat['name']=mat.get('name','')+'_outside_only';mat['doubleSided']=False;g['materials'].append(mat)
   q=copy.deepcopy(prim);q['indices']=index(faces);q['material']=len(g['materials'])-1;out.append(q)
   q=copy.deepcopy(prim);q['indices']=index(faces[:,[0,2,1]]);q['material']=glass;q['attributes']={k:v for k,v in q['attributes'].items() if k in ('POSITION','NORMAL')};out.append(q);count+=len(faces)
  mesh['primitives']=out
 g['buffers'][0]['byteLength']=len(blob);blob.extend(b'\0'*((-len(blob))%4));j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);p.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(blob))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(blob),0x004e4942)+blob);print('Interior glazing triangles:',count)
if __name__=='__main__':
 import sys
 glaze(sys.argv[1])
