"""Open the 2F escalator landing, preserving 1F walls and all unrelated meshes."""
from pathlib import Path
import json,struct,numpy as np

def open_landing(path):
 p=Path(path);b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);blob=bytearray(b[28+n:]);types={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'};width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
 def read(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dtype=np.dtype(types[a['componentType']]);w=width[a['type']];o=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',dtype.itemsize*w)
  arr=np.ndarray((a['count'],w),dtype=dtype,buffer=blob,offset=o,strides=(stride,dtype.itemsize)).copy()
  if a.get('normalized') and dtype.kind=='u':arr=arr.astype(float)/np.iinfo(dtype).max
  return arr
 def append(a):
  a=np.asarray(a,dtype='<f4');blob.extend(b'\0'*((-len(blob))%4));offset=len(blob);blob.extend(a.tobytes());g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes});info={'bufferView':len(g['bufferViews'])-1,'componentType':5126,'count':len(a),'type':{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[a.shape[1]]};info['min']=a.min(0).tolist();info['max']=a.max(0).tolist();g['accessors'].append(info);return len(g['accessors'])-1
 def clip(poly,axis,value,sign):
  out=[]
  for a,b in zip(poly,poly[1:]+poly[:1]):
   da=(a[axis]-value)*sign;db=(b[axis]-value)*sign
   if da>=0:out.append(a)
   if (da>=0)!=(db>=0):out.append(a+(b-a)*(da/(da-db)))
  return out
 names=[]
 for node in g['nodes']:
  name=node.get('name','')
  if not name.startswith(('accepted_camera_lobby_back.','accepted_camera_gallery_glass.','accepted_camera_gallery_post_','accepted_camera_gallery_back_joint_')):continue
  mesh=g['meshes'][node['mesh']]
  for prim in mesh['primitives']:
   attrs=prim['attributes'];keys=['POSITION']+[k for k in attrs if k!='POSITION'];arrays=[read(attrs[k]) for k in keys];vertices=np.concatenate(arrays,axis=1);pos=arrays[0]
   if pos[:,0].max()<-21.6 or pos[:,0].min()>-18 or pos[:,2].max()<5.69:continue
   indices=read(prim['indices']).reshape(-1) if 'indices'in prim else np.arange(len(vertices));result=[]
   for ids in indices.reshape(-1,3):
    inside=[v.copy() for v in vertices[ids]]
    for axis,value,sign in [(0,-21.6,1),(0,-18,-1),(2,5.69,1),(2,9.1,-1)]:
     if not inside:break
     outside=clip(inside,axis,value,-sign)
     for i in range(1,len(outside)-1):result.extend([outside[0],outside[i],outside[i+1]])
     inside=clip(inside,axis,value,sign)
   if not result:node.pop('mesh');break
   result=np.asarray(result);start=0;new={}
   for key,a in zip(keys,arrays):new[key]=append(result[:,start:start+a.shape[1]]);start+=a.shape[1]
   prim['attributes']=new;prim.pop('indices',None);names.append(name)
 g['buffers'][0]['byteLength']=len(blob);blob.extend(b'\0'*((-len(blob))%4));j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
 p.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(blob))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(blob),0x004e4942)+blob)
 print('Opened 2F landing:',names)
if __name__=='__main__':
 import sys
 open_landing(sys.argv[1])
