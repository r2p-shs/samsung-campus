"""Conservative evacuation graph from current model. No inferred wall openings."""
import json, math, hashlib
from pathlib import Path
import numpy as np
import trimesh
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'models/walk-layout.json').read_text(encoding='utf8'))
building=json.loads((ROOT/'models/building-walk.json').read_text(encoding='utf8'))
scene=trimesh.load(ROOT/'models/f_tower_walk.glb',force='scene')
doors=[d['id'] for d in building['walk']['doors']]
meshes=[]
for name in scene.graph.nodes_geometry:
    if name.startswith('stairs_') or any(name.startswith('accepted_'+d+'_') for d in doors):continue
    transform,geom=scene.graph[name]
    m=scene.geometry[geom].copy();m.apply_transform(transform);meshes.append(m)
mesh=trimesh.util.concatenate(meshes)
nodes=[];edges=[];floor_nodes={};spacing=.8;radius=.24

def inside(x,y,poly):
    yes=False
    for a,b in zip(poly,poly[1:]+poly[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:yes=not yes
    return yes

def add(p,level,kind='floor',well=-1):
    i=len(nodes);nodes.append({'p':[round(v,5) for v in p],'floor':level,'kind':kind,'well':well});return i

def edge(a,b):
    if a!=b:edges.append([a,b,round(math.dist(nodes[a]['p'],nodes[b]['p']),5)])

def floor_clear(x,y,f,obstacles,shaft=True):
    lo,hi,bottom,top=data['bounds']
    for dx,dy in [(0,0),(radius,0),(-radius,0),(0,radius),(0,-radius)]:
        xx,yy=x+dx,y+dy
        valid=lo<=xx<=hi and bottom<=yy<=top
        if f['level']==1:valid=valid or (-17<=xx<=-2 and -38<=yy<=-19)
        if not valid or any(inside(xx,yy,r['localXY']) for r in f['regions'] if r['kind']=='void'):return False
        if shaft and any(w['opening'][0]<xx<w['opening'][2] and w['opening'][1]<yy<w['opening'][3] for w in data['stairwells']):return False
        if f['level']==2 and any(abs(xx-c)<.7 and -16<yy<-8.65 for c in [-20.8,-18.8]):return False
    if len(obstacles):
        a=obstacles[:,0,:2];v=obstacles[:,1,:2]-a;delta=np.array([x,y])-a
        t=np.clip(np.sum(delta*v,axis=1)/np.maximum(np.sum(v*v,axis=1),1e-12),0,1)
        if np.any(np.sum((delta-v*t[:,None])**2,axis=1)<radius**2):return False
    return True

floor_info=[]
for f in data['floors']:
    z=f['z']; obs=np.concatenate([trimesh.intersections.mesh_plane(mesh,[0,0,1],[0,0,z+h]) for h in [.35,1,1.6]])
    clear=lambda x,y:floor_clear(x,y,f,obs)
    grid={}
    for ix in range(77):
        for iy in range(74):
            x=-31.2+ix*spacing;y=-38+iy*spacing
            if clear(x,y):grid[ix,iy]=add([x,y,z],f['level'])
    for (ix,iy),a in grid.items():
        for dx,dy in [(1,0),(0,1)]:
            b=grid.get((ix+dx,iy+dy))
            if b is not None:
                p=nodes[a]['p'];q=nodes[b]['p']
                if all(clear(p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t) for t in [.25,.5,.75]):edge(a,b)
    floor_nodes[f['level']]=list(grid.values());floor_info.append((f,obs,clear))
    print('floor',f['level'],'nodes',len(grid),flush=True)
# Attach exact stair entries to nearby grid only across verified free floor.
entries={}
for f,obs,_ in floor_info:
    for wi,w in enumerate(data['stairwells']):
        for side in [-1,1]:
            p=[w['center']+side*.8,-6.7,f['z']];a=add(p,f['level'],'entry',wi);entries[f['level'],wi,side]=a
            for b in floor_nodes[f['level']]:
                q=nodes[b]['p']
                if math.dist(p,q)<1.4 and all(floor_clear(p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,f,obs) for t in np.linspace(0,1,15)):edge(a,b)
# Stairway centerline follows already walk-tested return flight, landing, first flight.
for lower,upper in zip(data['floors'],data['floors'][1:]):
    for wi,w in enumerate(data['stairwells']):
        c=w['center'];z0=lower['z'];z1=upper['z'];zm=(z0+z1)/2
        points=[[c+.8,-6.7,z1],[c+.8,-5.9,z1],[c+.8,-1.1,zm],[c+.8,-.4,zm],[c-.8,-.4,zm],[c-.8,-1.1,zm],[c-.8,-5.9,z0],[c-.8,-6.7,z0]]
        previous=entries[upper['level'],wi,1]
        for k,(p,q) in enumerate(zip(points,points[1:])):
            count=max(1,round(math.dist(p,q)/.8))
            for j in range(1,count+1):
                last=k==len(points)-2 and j==count
                b=entries[lower['level'],wi,-1] if last else add([p[t]+(q[t]-p[t])*j/count for t in range(3)],upper['level'],'stairs',wi)
                edge(previous,b);previous=b
# Exterior endpoint, not an assumed refuge safety zone.
exits=[i for i in floor_nodes[1] if nodes[i]['p'][1]<-35 and -16<nodes[i]['p'][0]<-3]
assert exits,'No exterior exit nodes'
adj=[[] for _ in nodes]
for a,b,d in edges:adj[a].append(b);adj[b].append(a)
seen=set(exits);todo=list(exits)
while todo:
    for j in adj[todo.pop()]:
        if j not in seen:seen.add(j);todo.append(j)
counts={str(f['level']):sum(i in seen for i in floor_nodes[f['level']]) for f in data['floors']}
print('EXIT CONNECTIVITY',counts, 'entries',[(k,a in seen,len(adj[a])) for k,a in entries.items()],flush=True)
assert all(v>20 for v in counts.values()),'Missing floor-to-exterior route; do not invent connection'
result={'version':1,'modelSha256':hashlib.sha256((ROOT/'models/f_tower_walk.glb').read_bytes()).hexdigest(),'floors':[{'level':f['level'],'z':f['z']} for f in data['floors']],'nodes':nodes,'edges':edges,'exits':exits,'reachable':sorted(seen),'coverage':counts,'radius':radius,'spacing':spacing,'assumptions':['Mesh sections at 0.35, 1.0 and 1.6 m with 0.24 m clearance; explicit entry doors held open','Generic two stairwells and repeated upper floors','Exterior endpoint only; no smoke/heat/toxicity simulation']}
(ROOT/'models/evac-graph.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf8')
