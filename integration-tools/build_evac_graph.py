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
openings=json.loads((ROOT/'models/evac-openings.json').read_text(encoding='utf8'))['openings']
meshes=[]
for name in scene.graph.nodes_geometry:
    if name.startswith(('stairs_','accepted_camera_rotor_leaf_','accepted_camera_rotor_stile_')) or any(name.startswith('accepted_'+d+'_') for d in doors):continue
    transform,geom=scene.graph[name]
    m=scene.geometry[geom].copy();m.apply_transform(transform)
    opening=next((o for o in openings if name.startswith(o['prefix'])),None)
    if opening:
        lo,hi=m.bounds
        for ymin,ymax,zmin,zmax in [(lo[1],opening['yMin'],lo[2],hi[2]),(opening['yMax'],hi[1],lo[2],hi[2]),(opening['yMin'],opening['yMax'],opening['zMax'],hi[2])]:
            if ymax>ymin and zmax>zmin:
                part=trimesh.creation.box(extents=[hi[0]-lo[0],ymax-ymin,zmax-zmin]);part.apply_translation([(lo[0]+hi[0])/2,(ymin+ymax)/2,(zmin+zmax)/2]);meshes.append(part)
    else:meshes.append(m)
mesh=trimesh.util.concatenate(meshes)
nodes=[];edges=[];routes=[];floor_nodes={};spacing=.8;radius=.24

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
# Two nested, non-crossing lanes within each 1.4m-wide stair flight.
# Centers are 0.60m apart, with 0.40m clearance from flight edges.
entries={}
for f,obs,_ in floor_info:
    for wi,w in enumerate(data['stairwells']):
        for lane,offset in enumerate([.5,1.1]):
            for side in [-1,1]:
                p=[w['center']+side*offset,-6.7,f['z']];a=add(p,f['level'],'entry',wi);entries[f['level'],wi,side,lane]=a
                attached=0
                for b in floor_nodes[f['level']]:
                    q=nodes[b]['p']
                    if math.dist(p,q)<1.4 and all(floor_clear(p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,f,obs) for t in np.linspace(0,1,15)):edge(a,b);attached+=1
                assert attached, f'Stair lane entry not connected: {f["level"]}/{wi}/{side}/{lane}'
for lower,upper in zip(data['floors'],data['floors'][1:]):
    for wi,w in enumerate(data['stairwells']):
      for lane,offset in enumerate([.5,1.1]):
        c=w['center'];z0=lower['z'];z1=upper['z'];zm=(z0+z1)/2;turn=-.7 if lane==0 else -.1
        points=[[c+offset,-6.7,z1],[c+offset,-5.9,z1],[c+offset,-1.1,zm],[c+offset,turn,zm],[c-offset,turn,zm],[c-offset,-1.1,zm],[c-offset,-5.9,z0],[c-offset,-6.7,z0]]
        previous=entries[upper['level'],wi,1,lane];route_nodes=[previous]
        for k,(p,q) in enumerate(zip(points,points[1:])):
            count=max(1,round(math.dist(p,q)/.8))
            for j in range(1,count+1):
                last=k==len(points)-2 and j==count
                b=entries[lower['level'],wi,-1,lane] if last else add([p[t]+(q[t]-p[t])*j/count for t in range(3)],upper['level'],'stairs',wi)
                nodes[b]['lane']=lane;edge(previous,b);previous=b;route_nodes.append(b)
        family=f"stairs_{wi}_{upper['level']}"
        routes.append({'id':family+('_lane1' if lane else ''),'family':family,'lane':lane,'kind':'stairs','well':wi,'fromFloor':upper['level'],'toFloor':lower['level'],'nodes':route_nodes})
# Both existing escalators stopped, walked downward. Connect exact landings only
# through mesh-checked floor space; never connect the sloped run to floor grid.
for lane,x in enumerate([-20.8,-18.8]):
    endpoints=[]
    for f,obs,_ in floor_info[:2]:
        y=-16.3 if f['level']==1 else -8.25
        a=add([x,y,f['z']],f['level'],'entry',-1);endpoints.append(a)
        attached=0
        for b in floor_nodes[f['level']]:
            q=nodes[b]['p'];p=nodes[a]['p']
            if math.dist(p,q)<1.5 and all(floor_clear(p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,f,obs) for t in np.linspace(0,1,20)):
                edge(a,b);attached+=1
        assert attached, f'Escalator landing {lane}/{f["level"]} has no verified floor connection'
    z0=data['floors'][0]['z'];z1=data['floors'][1]['z']
    points=[[x,-8.25,z1],[x,-8.9,z1],[x,-15.5,z0],[x,-16.3,z0]]
    previous=endpoints[1];route_nodes=[previous]
    for k,(p,q) in enumerate(zip(points,points[1:])):
        count=max(1,round(math.dist(p,q)/.8))
        for j in range(1,count+1):
            last=k==2 and j==count
            b=endpoints[0] if last else add([p[t]+(q[t]-p[t])*j/count for t in range(3)],2,'escalator',lane)
            edge(previous,b);previous=b;route_nodes.append(b)
    routes.append({'id':f'escalator_{lane}','kind':'escalator','well':lane,'fromFloor':2,'toFloor':1,'nodes':route_nodes})
# Explicit door corridors. Keep enclosure, fixed glass and central spindle.
from collections import deque
local_adj={i:[] for i in floor_nodes[1]}
for a,b,d in edges:
    if a in local_adj and b in local_adj:local_adj[a].append(b);local_adj[b].append(a)
for key,x,band in [('left',-13.8,(-14.7,-12.9)),('center',-10.4,(-10.7,-8.4)),('right',-5.3,(-6.2,-4.4))]:
    allowed={i for i in floor_nodes[1] if band[0]<=nodes[i]['p'][0]<=band[1] and -25<=nodes[i]['p'][1]<=-19}
    start=min(allowed,key=lambda i:math.dist(nodes[i]['p'][:2],[x,-20.4]));end=min(allowed,key=lambda i:math.dist(nodes[i]['p'][:2],[x,-24.4]))
    todo=deque([start]);parents={start:None}
    while todo:
        a=todo.popleft()
        for b in local_adj[a]:
            if b in allowed and b not in parents:parents[b]=a;todo.append(b)
    assert end in parents, f'{key} door not connected; do not infer a glass opening'
    route_nodes=[];a=end
    while a is not None:route_nodes.append(a);a=parents[a]
    route_nodes.reverse();routes.append({'id':'door_'+key,'kind':'exit','well':-1,'fromFloor':1,'toFloor':1,'nodes':route_nodes})
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
result={'version':4,'stairLaneCount':2,'stairLaneSpacing':0.6,'openings':openings,'routes':routes,'modelSha256':hashlib.sha256((ROOT/'models/f_tower_walk.glb').read_bytes()).hexdigest(),'floors':[{'level':f['level'],'z':f['z']} for f in data['floors']],'nodes':nodes,'edges':edges,'exits':exits,'reachable':sorted(seen),'coverage':counts,'radius':radius,'spacing':spacing,'assumptions':['Mesh sections at 0.35, 1.0 and 1.6 m with 0.24 m clearance; explicit entry doors held open','Generic two stairwells and repeated upper floors','Exterior endpoint only; no smoke/heat/toxicity simulation']}
(ROOT/'models/evac-graph.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf8')
