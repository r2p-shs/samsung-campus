// Deterministic hybrid route and continuous pedestrian model. Seconds/metres, fixed 0.1-second steps.
export class Evacuation {
 constructor(graph,options={}) {
  this.g=graph;this.options={perFloor:20,seed:42,fireFloor:3,blockedWell:-1,flatSpeed:1.2,stairSpeed:.65,delayMin:5,delayMax:30,balanced:true,guides:true,stoppedEscalators:true,stairLanes:2,...options};this.time=0;this.maxWait=0;this.done=0;this.finished=false;this.maxSeconds=1800;
  const o=this.options;this.adj=graph.nodes.map(()=>[]);this.exit=new Set(graph.exits);
  this.closed=new Set(graph.nodes.flatMap((n,i)=>n.kind==='stairs'&&(n.floor===o.fireFloor||(o.fireFloor===1&&n.floor===2))&&n.well===o.blockedWell?[i]:[]));
  for(const[a,b,length]of graph.edges){if([a,b].some(i=>graph.nodes[i].kind==='stairs'&&(graph.nodes[i].lane||0)>=o.stairLanes))continue;if(this.closed.has(a)||this.closed.has(b))continue;if(!o.stoppedEscalators&&[a,b].some(i=>graph.nodes[i].kind==='escalator'))continue;const stairs=[a,b].some(i=>['stairs','escalator'].includes(graph.nodes[i].kind));const e={length,stairs};this.adj[a].push({to:b,...e});this.adj[b].push({to:a,...e})}
  this.buildWalkCells();this.dist=this.field(graph.exits);
  this.routes=(graph.routes||[]).filter(r=>(r.kind!=='stairs'||(r.lane||0)<o.stairLanes)&&(o.stoppedEscalators||r.kind!=='escalator')&&!r.nodes.some(n=>this.closed.has(n))).map(r=>({...r,field:this.field([r.nodes[0]],n=>(n.kind==='floor'||n.kind==='entry')&&n.floor===r.fromFloor),transitSeconds:r.nodes.slice(1).reduce((sum,n,i)=>sum+Math.hypot(...graph.nodes[n].p.map((v,k)=>v-graph.nodes[r.nodes[i]].p[k]))/(r.kind==='exit'?o.flatSpeed:o.stairSpeed),0),assigned:0,entered:0,completed:0,waiting:0}));
  let seed=o.seed>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  // Identical spawn set for baseline and closure: never drop unreachable people.
  const reachable=new Set(graph.reachable);this.people=[];this.occupancy=new Map();this.reserved=new Map();this.coverage=[];
  for(const f of graph.floors){let pool=graph.nodes.flatMap((n,i)=>n.floor===f.level&&n.kind==='floor'&&n.p[1]>-20&&reachable.has(i)?[i]:[]);for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}this.coverage.push({floor:f.level,available:pool.length,requested:o.perFloor,spawned:Math.min(pool.length,o.perFloor)});for(const node of pool.slice(0,o.perFloor)){const a={id:this.people.length,node,fromFloor:f.level,delay:o.delayMin+random()*(o.delayMax-o.delayMin),factor:.85+random()*.3,target:null,progress:0,wait:0,status:'preparing',exitTime:null,passedDoor:false,route:null,routeIndex:-1,lastWell:null,stuck:0,distance:0,facing:0,lastDecision:-100,switches:0,decision:null};this.people.push(a);this.occupancy.set(node,a.id)}}
  // Clearance at short landing segments and floor merges; same-node reservation
  // alone is insufficient where distinct lane nodes are physically close.
  this.conflicts=graph.nodes.map(()=>[]);const buckets=new Map(),key=p=>[Math.floor(p[0]/.48),Math.floor(p[1]/.48),Math.floor(p[2]/1.6)];
  graph.nodes.forEach((n,i)=>{const k=key(n.p).join(',');if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i)});
  for(const r of this.routes.filter(r=>['stairs','escalator'].includes(r.kind)))for(const i of r.nodes){const p=graph.nodes[i].p,[x,y,z]=key(p);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const j of buckets.get([x+dx,y+dy,z+dz].join(','))||[]){if(i===j)continue;const q=graph.nodes[j].p;if(Math.abs(p[2]-q[2])<1.6&&Math.hypot(p[0]-q[0],p[1]-q[1])<.48-1e-6){this.conflicts[i].push(j);this.conflicts[j].push(i)}}}
  this.conflicts=this.conflicts.map(ids=>[...new Set(ids)]);
  for(const r of this.routes.filter(r=>r.kind==='stairs')){const c=r.center??(graph.nodes[r.nodes[1]].p[0]+graph.nodes[r.nodes.at(-2)].p[0])/2; r.motionStart=r.nodes[1];r.motionEnd=r.nodes.at(-2);const p=graph.nodes[r.motionStart].p,q=graph.nodes[r.motionEnd].p,offset=r.flightOffset??(.5+.6*(r.lane||0)),z=(p[2]+q[2])/2,radius=.2+.6*(r.lane||0);const points=[p,[c+offset,-5.9,p[2]],[c+offset,-1.1,z],[c+offset,-.9,z]];
   for(let i=1;i<=16;i++){const t=i*Math.PI/32;points.push([c+.3+radius*Math.cos(t),-.9+radius*Math.sin(t),z])}points.push([c-.3,-.9+radius,z]);
   for(let i=1;i<=16;i++){const t=Math.PI/2+i*Math.PI/32;points.push([c-.3+radius*Math.cos(t),-.9+radius*Math.sin(t),z])}points.push([c-offset,-1.1,z],[c-offset,-5.9,q[2]],q);
   const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(...points[i].map((v,k)=>v-points[i-1][k])));r.path={points,lengths,total:lengths.at(-1)};
  }
  this.guideMessages=[];this.lastGuideBroadcast=-100;this.initial=this.people.length;this.stepCount=0;this.wellChanges=0;this.lastReroute=null;
 }
 buildWalkCells(){this.walkCells=new Set();const grid=new Map(),key=(f,x,y)=>`${f}/${x}/${y}`;for(let i=0;i<this.g.nodes.length;i++){const n=this.g.nodes[i];if(n.kind==='floor')grid.set(key(n.floor,Math.round((n.p[0]+31.2)/.8),Math.round((n.p[1]+38)/.8)),i)}
  this.floorGrid=grid;for(const[k,a]of grid){const[f,x,y]=k.split('/').map(Number),b=grid.get(key(f,x+1,y)),c=grid.get(key(f,x,y+1)),d=grid.get(key(f,x+1,y+1));if([b,c,d].some(v=>v===undefined))continue;const linked=(i,j)=>this.adj[i].some(e=>e.to===j);if(linked(a,b)&&linked(a,c)&&linked(b,d)&&linked(c,d)&&linked(a,d)&&linked(b,c))this.walkCells.add(k);}
 }
 walkable(p,f){const x=(p[0]+31.2)/.8,y=(p[1]+38)/.8;for(const ix of [Math.floor(x-1e-7),Math.floor(x+1e-7)])for(const iy of [Math.floor(y-1e-7),Math.floor(y+1e-7)])if(this.walkCells.has(`${f}/${ix}/${iy}`))return true;return false;}
 visibleFloor(p,q,f){const count=Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/.12));for(let i=0;i<=count;i++){const t=i/count;if(!this.walkable([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t],f))return false;}return true;}
 floorShortcut(a,next){if(a.routeIndex>=0||this.g.nodes[a.node].kind!=='floor'||this.g.nodes[next.to].kind!=='floor')return next;const start=this.g.nodes[a.node],field=a.detour?.route===a.route?a.detour.field:(a.route?.field||this.dist);let node=next.to;const path=[];for(let i=0;i<128;i++){const n=this.g.nodes[node];if(n.kind!=='floor'||n.floor!==start.floor)break;path.push(node);const e=this.adj[node].filter(e=>field[e.to]<field[node]-1e-7).sort((a,b)=>field[a.to]+a.length/this.options.flatSpeed-field[b.to]-b.length/this.options.flatSpeed)[0];if(!e)break;node=e.to;}
  for(const id of path.reverse()){const n=this.g.nodes[id];if(!this.occupancy.has(id)&&!this.reserved.has(id)&&this.visibleFloor(start.p,n.p,n.floor))return {to:id,length:Math.hypot(n.p[0]-start.p[0],n.p[1]-start.p[1]),stairs:false};}return next;
 }
 replanFloor(a){const m=a.floorMotion,f=this.g.nodes[a.node].floor,field=a.route?.field||this.dist,ix=Math.round((m.p[0]+31.2)/.8),iy=Math.round((m.p[1]+38)/.8);let best=null,score=Infinity;
  for(let x=ix-4;x<=ix+4;x++)for(let y=iy-4;y<=iy+4;y++){const id=this.floorGrid.get(`${f}/${x}/${y}`);if(id==null||id===a.target||!Number.isFinite(field[id])||field[id]>=(field[this.floorGrid.get(`${f}/${ix}/${iy}`)]??field[a.node])+2||this.occupancy.has(id)||this.reserved.has(id))continue;const q=this.g.nodes[id].p,d=Math.hypot(q[0]-m.p[0],q[1]-m.p[1]);if(d<.35||!this.visibleFloor(m.p,q,f))continue;const near=this.people.filter(b=>b!==a&&b.status!=='exited'&&Math.abs(this.position(b)[2]-q[2])<1.6&&Math.hypot(this.position(b)[0]-q[0],this.position(b)[1]-q[1])<.8).length;if(near)continue;const value=field[id]+d/this.options.flatSpeed;if(value<score){score=value;best=id;}}
  if(best!=null){this.reserved.delete(a.target);a.target=best;this.reserved.set(best,a.id);}
 }
 moveFloor(a,dt){if(this.options.balanced&&a.routeIndex<0&&this.time-a.lastDecision>=5){const previous=a.route;this.chooseRoute(a,true);if(a.route!==previous)this.replanFloor(a);}if(a.stuck>1)a.yieldUntil=this.time+2;if(a.stuck>1&&this.time-(a.lastFloorPlan??-100)>2){a.lastFloorPlan=this.time;this.replanFloor(a);}const m=a.floorMotion,p=m.p,q=this.g.nodes[a.target].p,f=this.g.nodes[a.node].floor,dx=q[0]-p[0],dy=q[1]-p[1],distance=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),free=this.options.flatSpeed*a.factor;
  const neighbors=this.people.filter(b=>b!==a&&b.status!=='exited'&&Math.abs(this.position(b)[2]-p[2])<1.6&&Math.hypot(this.position(b)[0]-p[0],this.position(b)[1]-p[1])<3);
  let best=null,score=Infinity;for(const offset of [0,-.25,.25,-.5,.5,-.85,.85,-1.2,1.2,-1.57,1.57,-2.1,2.1,-2.7,2.7,Math.PI])for(const scale of [1,.5,0]){const speed=Math.min(free*scale,distance/dt),desired=[Math.cos(angle+offset)*speed,Math.sin(angle+offset)*speed],delta=[desired[0]-m.v[0],desired[1]-m.v[1]],gain=Math.min(1,2*dt/(Math.hypot(...delta)||1)),v=[m.v[0]+delta[0]*gain,m.v[1]+delta[1]*gain],end=[p[0]+v[0]*dt,p[1]+v[1]*dt,p[2]];
   if(!this.visibleFloor(p,end,f))continue;let risk=0,blocked=false;for(const b of neighbors){const bp=this.position(b),bv=b.floorMotion?.v||[0,0],rx=bp[0]-p[0],ry=bp[1]-p[1],vx=v[0]-bv[0],vy=v[1]-bv[1],t=Math.max(0,Math.min(1,(rx*vx+ry*vy)/(vx*vx+vy*vy||1))),gap=Math.hypot(rx-vx*t,ry-vy*t);const travel=[end[0]-p[0],end[1]-p[1]],u=Math.max(0,Math.min(1,(rx*travel[0]+ry*travel[1])/(travel[0]**2+travel[1]**2||1)));if(Math.hypot(rx-travel[0]*u,ry-travel[1]*u)<.48-1e-6){blocked=true;break;}risk+=Math.max(0,.62-gap)*(a.yieldUntil>this.time?.5:3);}
   if(blocked)continue;const value=Math.hypot(v[0]-Math.cos(angle)*free,v[1]-Math.sin(angle)*free)+risk+Math.abs(offset)*.05+(a.yieldUntil>this.time&&Math.hypot(...v)<.05?.8:0);if(value<score){score=value;best={v,end};}
  }
  if(best&&Math.hypot(...best.v)>.01){const step=Math.hypot(best.end[0]-p[0],best.end[1]-p[1]);m.p=best.end;m.v=best.v;a.distance+=step;a.stuck=0;a.status='moving';const target=Math.atan2(-best.v[0],best.v[1]),diff=Math.atan2(Math.sin(target-a.facing),Math.cos(target-a.facing));a.facing+=Math.max(-2.5*dt,Math.min(2.5*dt,diff));}else{m.v=[0,0];a.stuck+=dt;a.wait+=dt;a.status='waiting';}
  if(Math.hypot(m.p[0]-q[0],m.p[1]-q[1])<.12&&neighbors.every(b=>Math.hypot(this.position(b)[0]-q[0],this.position(b)[1]-q[1])>=.48)){a.distance+=Math.hypot(m.p[0]-q[0],m.p[1]-q[1]);this.reserved.delete(a.target);a.node=a.target;a.target=null;a.floorMotion=null;a.progress=0;this.occupancy.set(a.node,a.id);if(f===1){a.recentFloorNodes??=new Map();a.recentFloorNodes.set(a.node,this.time);}if(a.route&&a.node===a.route.nodes.at(-1)){a.route.assigned--;a.route.completed++;if(a.route.kind==='exit')a.passedDoor=a.route.id;a.route=null;a.routeIndex=-1;}if(this.exit.has(a.node)){a.status='exited';a.exitTime=this.time;this.done++;this.occupancy.delete(a.node);}}
 }
 field(sources,allowed=()=>true){const dist=new Float64Array(this.g.nodes.length);dist.fill(Infinity);const heap=[];
  const push=v=>{heap.push(v);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p][0]<=v[0])break;heap[i]=heap[p];i=p}heap[i]=v};
  const pop=()=>{const top=heap[0],v=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=v[0])break;heap[i]=heap[c];i=c}heap[i]=v}return top};
  for(const i of sources){dist[i]=0;push([0,i])}while(heap.length){const[d,i]=pop();if(d!==dist[i])continue;for(const e of this.adj[i]){if(!allowed(this.g.nodes[e.to],e.to,i))continue;const nd=d+e.length/(e.stairs?this.options.stairSpeed:this.options.flatSpeed);if(nd<dist[e.to]){dist[e.to]=nd;push([nd,e.to])}}}return dist;
 }
 pathPoint(r,d){const{points,lengths,total}=r.path;d=Math.max(0,Math.min(total,d));let i=1;while(i<lengths.length-1&&lengths[i]<d)i++;const t=(d-lengths[i-1])/(lengths[i]-lengths[i-1]);return points[i-1].map((v,k)=>v+(points[i][k]-v)*t)}
 clearAt(p,a){return this.people.every(b=>{if(b===a||b.status==='exited')return true;const body=this.position(b);if(Math.abs(p[2]-body[2])<1.6&&Math.hypot(p[0]-body[0],p[1]-body[1])<.48-1e-7)return false;
   const target=b.target??b.clearanceTarget;if(b.stairMotion||target==null)return true;const end=b.floorMotion?[body[0]+b.floorMotion.v[0]*.5,body[1]+b.floorMotion.v[1]*.5,body[2]]:this.g.nodes[target].p,dx=end[0]-body[0],dy=end[1]-body[1];const distance=v=>{const t=Math.max(0,Math.min(1,((v[0]-body[0])*dx+(v[1]-body[1])*dy)/(dx*dx+dy*dy||1)));return Math.abs(v[2]-(body[2]+(end[2]-body[2])*t))>=1.6?Infinity:Math.hypot(v[0]-body[0]-dx*t,v[1]-body[1]-dy*t)};
   const d=distance(p);if(d>=.52-1e-7)return true;
   // An uncommitted follower must not reserve the leader's current position.
   return b.target===null&&d>=distance(this.position(a))-1e-8;
  })}
 crossingReserved(node,a){const p=this.g.nodes[a.node],q=this.g.nodes[node];if(p.kind!=='floor'||q.kind!=='floor')return false;
  return this.people.some(b=>{if(b===a||b.target==null||b.floorMotion)return false;const u=this.g.nodes[b.node],v=this.g.nodes[b.target];if(u.kind!=='floor'||v.kind!=='floor'||u.floor!==p.floor)return false;
   const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);return cross(p.p,q.p,u.p)*cross(p.p,q.p,v.p)<-1e-8&&cross(u.p,v.p,p.p)*cross(u.p,v.p,q.p)<-1e-8;
  });
 }
 canEnter(node,a){if(this.crossingReserved(node,a))return false;return [node,...this.conflicts[node]].every(i=>(!this.occupancy.has(i)||this.occupancy.get(i)===a.id)&&(!this.reserved.has(i)||this.reserved.get(i)===a.id))&&this.people.every(b=>(!b.stairMotion&&!b.floorMotion)||b===a||Math.abs(this.g.nodes[node].p[2]-this.position(b)[2])>=1.6||Math.hypot(this.g.nodes[node].p[0]-this.position(b)[0],this.g.nodes[node].p[1]-this.position(b)[1])>=.48-1e-7)}
 moveStair(a,dt){const m=a.stairMotion,r=a.route;let limit=r.path.total;for(const b of this.people)if(b!==a&&b.stairMotion&&b.route===r&&b.stairMotion.s>m.s)limit=Math.min(limit,b.stairMotion.s-.62);
  const free=this.options.stairSpeed*a.factor,gap=Math.max(0,limit-m.s),desired=limit<r.path.total?Math.min(free,gap/.6):free;m.speed=Math.min(desired,m.speed+.8*dt);let delta=Math.min(gap,m.speed*dt);
  // Check continuous body clearance, including the other lane and floor merges.
  if(!this.clearAt(this.pathPoint(r,m.s+delta),a)){let lo=0,hi=delta;for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(this.clearAt(this.pathPoint(r,m.s+mid),a))lo=mid;else hi=mid}delta=lo}
  const end=r.motionEnd;if(m.s+delta>=r.path.total-1e-6&&!this.canEnter(end,a))delta=Math.max(0,r.path.total-m.s-.001);
  m.s+=delta;m.speed=delta/dt;a.distance+=delta;a.status=delta>.0001?'moving':'waiting';if(a.status==='waiting'){a.wait+=dt;a.stuck+=dt}else a.stuck=0;
  const p=this.pathPoint(r,m.s),q=this.pathPoint(r,Math.min(r.path.total,m.s+.08));if(Math.hypot(q[0]-p[0],q[1]-p[1])>.00001){const angle=Math.atan2(-(q[0]-p[0]),q[1]-p[1]),diff=Math.atan2(Math.sin(angle-a.facing),Math.cos(angle-a.facing));a.facing+=Math.max(-2.5*dt,Math.min(2.5*dt,diff))}
  if(m.s>=r.path.total-1e-6&&this.canEnter(end,a)){a.node=end;this.occupancy.set(end,a.id);a.stairMotion=null}
 }

 choices(a){const n=this.g.nodes[a.node];return this.routes.filter(r=>r.fromFloor===n.floor&&Number.isFinite(r.field[a.node])&&Number.isFinite(this.dist[r.nodes.at(-1)]))}
 // Choose the next accessible portal on this floor, not the final outdoor exit.
 travelTime(r,a){let node=a.node;if(a.floorMotion){const p=a.floorMotion.p,id=this.floorGrid.get(`${this.g.nodes[a.node].floor}/${Math.round((p[0]+31.2)/.8)}/${Math.round((p[1]+38)/.8)}`);if(id!=null&&Number.isFinite(r.field[id]))node=id;}return r.field[node]/a.factor;}
 expectedWait(r,a){if(!this.options.balanced)return 0;const ahead=this.people.filter(p=>p!==a&&p.route===r&&p.status==='waiting'&&(p.routeIndex>=0||r.field[p.node]<=Math.min(8,r.field[a.node]))).length;
  const speed=(r.kind==='exit'?this.options.flatSpeed:this.options.stairSpeed)*a.factor,headway=(r.kind==='stairs'?.62:2*this.g.spacing)/speed+.2;
  const entryOccupied=this.occupancy.has(r.nodes[0])&&this.occupancy.get(r.nodes[0])!==a.id;
  const approaching=r.kind==='stairs'?this.people.filter(p=>p!==a&&p.route===r&&p.routeIndex<0&&r.field[p.node]<=Math.min(8,r.field[a.node]+2)).length:0;const tail=r.kind==='stairs'?this.people.filter(p=>p!==a&&p.route===r&&p.stairMotion&&p.stairMotion.s<2.5).length:0;const sibling=r.family?this.routes.find(x=>x.family===r.family&&x!==r):null;const load=x=>this.people.filter(p=>p!==a&&p.route===x&&(p.routeIndex>=0||x.field[p.node]<=8)).length;const laneDelay=sibling?Math.max(0,load(r)-load(sibling)-1)*headway*1.2:0;return laneDelay+Math.max(ahead,approaching+Math.max(0,tail-1))*headway+(entryOccupied?headway:0)+(a.route===r?Math.min(30,a.stuck):0);
 }
 localDetour(a){const goal=a.route?.nodes[0];if(goal==null)return null;const floor=this.g.nodes[a.node].floor,blocked=new Set([...this.occupancy,...this.reserved].filter(([id,person])=>person!==a.id&&id!==goal).map(([id])=>id));const bodies=this.people.filter(b=>b!==a&&b.stairMotion&&Math.abs(this.position(b)[2]-this.g.nodes[a.node].p[2])<1.6).map(b=>this.position(b));
  for(const[id,time]of a.recentFloorNodes||[])if(id!==a.node&&id!==goal&&this.time-time<30)blocked.add(id);
  const field=this.field([goal],(n,id,from)=>{if(n.floor!==floor||!['floor','entry'].includes(n.kind)||blocked.has(id))return false;const p=n.p,q=this.g.nodes[from].p,dx=q[0]-p[0],dy=q[1]-p[1];return bodies.every(v=>{const t=Math.max(0,Math.min(1,((v[0]-p[0])*dx+(v[1]-p[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]+dx*t-v[0],p[1]+dy*t-v[1])>=.52})});return Number.isFinite(field[a.node])?{field,route:a.route,createdAt:this.time}:null;
 }
 // Observe actual queues, not assignment totals. A full pair of lanes is a
 // shared bottleneck even when their loads are equal.
 queueDelay(r,arrival=0){
  const family=r.family?this.routes.filter(x=>x.family===r.family):[r];
  const queued=this.people.filter(p=>p.status!=='exited'&&family.includes(p.route)&&
   (p.routeIndex>=0?p.status==='waiting':p.status==='waiting'&&p.route.field[p.node]<=12));
  const headway=(r.kind==='stairs'?.62:2*this.g.spacing)/(r.kind==='exit'?this.options.flatSpeed:this.options.stairSpeed)+.2;
  const stalled=queued.filter(p=>p.routeIndex>=0).length;
  // Slow discharge raises service time; bound this estimate to avoid permanent
  // avoidance after a temporary blockage. Queues can drain while approaching.
  const service=headway*(1+Math.min(2,stalled/Math.max(1,family.length*3)));
  return Math.max(0,queued.length*service/family.length-arrival);
 }
 congestionDelay(r,a){
  if(!this.options.balanced)return 0;
  const arrival=r.field[a.node]/a.factor;
  if(this.options.guides&&this.options.blockedWell<0&&r.kind!=='exit'&&a.stuck<3)return this.queueDelay(r,arrival)+Math.max(0,this.slowTransit(r)-arrival);
  return Math.max(this.expectedWait(r,a),this.queueDelay(r,arrival))+this.slowTransit(r);
 }
 // Measure motion including stop-and-go inside each flight. Counting only
 // people marked waiting misses dense streams that creep continuously.
 slowTransit(r){if(r.kind!=='stairs'||!r.observedSeconds)return 0;const speed=Math.max(.12,Math.min(this.options.stairSpeed,r.observedSpeed));return Math.max(0,r.path.total/speed-r.path.total/this.options.stairSpeed);}
 observeFlow(dt){for(const r of this.routes.filter(r=>r.kind==='stairs')){
  const movers=this.people.filter(a=>a.route===r&&a.stairMotion);
  const crowded=movers.length>=3;
  const speed=crowded?movers.reduce((n,a)=>n+a.stairMotion.speed,0)/movers.length:this.options.stairSpeed;
  const alpha=1-Math.exp(-dt/6);r.observedSpeed=(r.observedSpeed??this.options.stairSpeed)*(1-alpha)+speed*alpha;
  if(crowded)r.observedSeconds=(r.observedSeconds||0)+dt;
 }}
 // Paired guides broadcast measured conditions every simulation second. Only
 // downstream congestion is added, never total distance to the outdoor exit.
 broadcastGuides(){if(this.time-this.lastGuideBroadcast<1)return;this.lastGuideBroadcast=this.time;
  this.guideMessages=this.g.floors.flatMap(f=>[0,1].map(well=>{
   const lanes=this.routes.filter(r=>r.kind==='stairs'&&r.fromFloor===f.level&&r.well===well);
   const people=this.people.filter(a=>a.status!=='exited'&&(f.level===1?this.g.nodes[a.node].floor===1&&Math.hypot(this.position(a)[0]-(well?19.5:-16),this.position(a)[1]+9.2)<5:lanes.includes(a.route)));
   const waiting=people.filter(a=>a.status==='waiting').length;
   const approaching=people.filter(a=>a.route&&a.routeIndex<0&&a.route.field[a.node]/a.factor<=12&&this.time>=a.delay).length;
   const delay=lanes.length?Math.min(90,Math.max(...lanes.map(r=>this.queueDelay(r,0)+this.slowTransit(r)),approaching*(.62/this.options.stairSpeed+.2)/lanes.length)):0;
   return {floor:f.level,well,time:this.time,waiting,approaching,occupants:people.filter(a=>a.routeIndex>=0).length,closed:f.level>1&&!lanes.length,delay,lanes:lanes.length,incoming:people.filter(a=>a.route&&a.routeIndex<0&&this.time>=a.delay).map(a=>({person:a.id,eta:this.travelTime(a.route,a)})).filter(a=>a.eta<=25).sort((a,b)=>a.eta-b.eta),headway:.62/Math.max(.2,lanes.reduce((n,r)=>n+(r.observedSpeed??this.options.stairSpeed),0)/(lanes.length||1))+.2};
  }));
 }
 sharedGuideDelay(r,a){if(!this.options.guides||!this.options.balanced||r.kind!=='stairs')return 0;this.broadcastGuides();
  const below=this.guideMessages.filter(m=>m.well===r.well&&m.floor<r.fromFloor);
  // Forecast remaining downstream delay at this person's arrival. Use the
  // largest shared bottleneck rather than charging the same backlog on every floor.
  // A lower closed flight is a finite diversion cost, not an unreachable well.
  if(this.options.blockedWell>=0)return below.reduce((sum,m)=>sum+(m.closed?30:m.delay),0);
  let arrival=this.travelTime(r,a)+r.transitSeconds/a.factor;let worst=0;
 for(const m of below.sort((x,y)=>y.floor-x.floor)){worst=Math.max(worst,Math.max(0,m.delay-arrival));const flight=this.routes.find(x=>x.kind==='stairs'&&x.fromFloor===m.floor&&x.well===r.well);arrival+=(flight?.transitSeconds||25)/a.factor;}return worst;
 }
 guideEntryDelay(r,a){if(!this.options.guides||!this.options.balanced||r.kind!=='stairs')return 0;this.broadcastGuides();const message=this.guideMessages.find(m=>m.floor===r.fromFloor&&m.well===r.well);if(!message||!message.lanes)return 0;const arrival=this.travelTime(r,a),slots=Array(message.lanes).fill(0);for(const p of message.incoming){if(p.person===a.id||p.eta>arrival+1)continue;let i=slots.indexOf(Math.min(...slots));slots[i]=Math.max(slots[i],p.eta)+message.headway;}return Math.max(0,Math.min(...slots)-arrival);}
 routeCost(r,a){return this.travelTime(r,a)+Math.max(this.congestionDelay(r,a),this.guideEntryDelay(r,a))+this.sharedGuideDelay(r,a)}
 chooseRoute(a,reconsider=false){if(this.g.nodes[a.node].floor===1&&a.passedDoor)return;if(a.routeIndex>=0&&a.node!==a.route?.nodes[0])return;
  const choices=this.choices(a).sort((x,y)=>this.routeCost(x,a)-this.routeCost(y,a));if(!choices.length)return;const best=choices[0],current=a.route;
  if(reconsider){if(this.time-a.lastDecision<(this.options.guides?5:10))return;a.lastDecision=this.time;if(!current||best===current||this.routeCost(current,a)-this.routeCost(best,a)<Math.max(3,Math.min(8,current.field[a.node]/a.factor*.1)))return;}
  if(current===best)return;const previous=current?.id;const previousCost=current?this.routeCost(current,a):null;if(current?.kind==='stairs'&&best.kind==='stairs'&&current.well!==best.well)this.wellChanges++;if(current){current.assigned--;if(a.routeIndex===0)current.entered--;a.switches++}a.route=best;a.detour=null;best.assigned++;a.routeIndex=-1;a.lastDecision=this.time;
  a.decision={guideAssisted:this.options.guides&&this.options.balanced,sharedDownstreamDelaySeconds:this.sharedGuideDelay(best,a),predictedEntryDelaySeconds:this.guideEntryDelay(best,a),time:this.time,from:previous||null,to:best.id,reason:current?'queue-delay-exceeds-detour':'shortest-available-path',travelSeconds:this.travelTime(best,a),expectedWaitSeconds:this.congestionDelay(best,a),estimatedSeconds:this.routeCost(best,a),previousEstimatedSeconds:previousCost};if(current)this.lastReroute={person:a.id,...a.decision};
 }
 routeStats(){return this.routes.map(r=>({id:r.id,kind:r.kind,well:r.well,lane:r.lane??null,floor:r.fromFloor,assigned:r.assigned,entered:r.entered,completed:r.completed,slowdownSeconds:+this.slowTransit(r).toFixed(1),waiting:this.people.filter(a=>a.route===r&&a.status==='waiting').length}))}
 step(){if(this.finished)return;const dt=.1;this.time=+(this.time+dt).toFixed(6);this.stepCount++;let waiting=0;
  for(const a of this.people){a.previousPosition=[...this.position(a)];a.previousFacing=a.facing;a.previousDistance=a.distance;a.clearanceTarget=null;if(!a.stairMotion&&a.status!=='exited'&&a.target===null){if(a.routeIndex>=0&&a.route){a.clearanceTarget=a.route.nodes[a.route.nodes.indexOf(a.node)+1]??null}else{const field=a.route?.field||this.dist;const best=this.adj[a.node].filter(e=>field[e.to]<field[a.node]-1e-7).sort((x,y)=>(field[x.to]+x.length/this.options.flatSpeed)-(field[y.to]+y.length/this.options.flatSpeed))[0];a.clearanceTarget=best?.to??null}}}
  // Leaders advance first; followers respond to distance rather than vacant cells.
  const stairPeople=this.people.filter(a=>a.stairMotion).sort((a,b)=>b.stairMotion.s-a.stairMotion.s);const moved=new Set(stairPeople.map(a=>a.id));for(const a of stairPeople){this.moveStair(a,dt);if(a.status==='waiting')waiting++}
  // Rotate priority deterministically to avoid a persistent agent-ID advantage.
  for(let k=0;k<this.people.length;k++){const a=this.people[(k+this.stepCount)%this.people.length];if(a.status==='exited'||moved.has(a.id))continue;
   if(a.floorMotion){this.moveFloor(a,dt);if(a.status==='waiting')waiting++;continue;}
   if(a.target!==null){let delta=Math.min(dt*a.speed,a.length*(1-a.progress));const p=this.g.nodes[a.node].p,q=this.g.nodes[a.target].p,clear=d=>this.people.every(b=>{if((!b.stairMotion&&!b.floorMotion)||b===a)return true;const v=this.position(b),t=a.progress+d/a.length;return Math.abs(p[2]+(q[2]-p[2])*t-v[2])>=1.6||Math.hypot(p[0]+(q[0]-p[0])*t-v[0],p[1]+(q[1]-p[1])*t-v[1])>=.48-1e-7});if(!clear(delta)){let lo=0,hi=delta;for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(clear(mid))lo=mid;else hi=mid}delta=lo}if(delta>.0001){const turn=Math.atan2(-(q[0]-p[0]),q[1]-p[1])-a.facing;a.facing+=Math.max(-.25,Math.min(.25,Math.atan2(Math.sin(turn),Math.cos(turn))));}a.status=delta>.0001?'moving':'waiting';a.distance+=delta;a.progress+=delta/a.length;if(a.progress>=1){this.occupancy.delete(a.node);this.reserved.delete(a.target);a.node=a.target;if(this.g.nodes[a.node].floor===1){a.recentFloorNodes??=new Map();a.recentFloorNodes.set(a.node,this.time);}a.target=null;a.progress=0;this.occupancy.set(a.node,a.id);if(a.route&&a.node===a.route.nodes.at(-1)){a.route.assigned--;a.route.completed++;if(a.route.kind==='exit')a.passedDoor=a.route.id;a.lastWell=a.route.kind==='stairs'?a.route.well:null;a.route=null;a.routeIndex=-1}if(this.exit.has(a.node)){a.status='exited';a.exitTime=this.time;this.done++;this.occupancy.delete(a.node)}}continue}
   if(this.time<a.delay)continue;if(!Number.isFinite(this.dist[a.node])){a.status='unreachable';continue}
   if(!a.route)this.chooseRoute(a);else if((a.routeIndex<0||a.node===a.route.nodes[0])&&this.options.balanced&&this.time-a.lastDecision>=(this.options.guides?5:10))this.chooseRoute(a,true);
   // Commit to the lane portal actually reached; do not cross another queue to
   // reach the neighboring portal of the same stairwell.
   if(a.route?.kind==='stairs'&&a.routeIndex<0){const here=this.routes.find(r=>r.family===a.route.family&&r.nodes[0]===a.node);if(here&&here!==a.route&&this.expectedWait(here,a)<=this.expectedWait(a.route,a)){a.route.assigned--;here.assigned++;a.route=here;a.detour=null;a.switches++}}
   let candidates;
   if(a.route&&a.node===a.route.nodes[0]&&a.routeIndex<0){a.routeIndex=0;a.route.entered++}
   if(a.route?.kind==='stairs'&&a.node===a.route.motionStart){this.occupancy.delete(a.node);a.stairMotion={s:0,speed:this.options.stairSpeed*a.factor};continue}
   if(a.route&&a.routeIndex>=0){const index=a.route.nodes.indexOf(a.node);const target=a.route.nodes[index+1];candidates=this.adj[a.node].filter(e=>e.to===target)}
   else{if(a.stuck>=2&&this.time-(a.lastLocalPlan??-100)>=1){a.lastLocalPlan=this.time;const plan=this.localDetour(a);if(plan)a.detour=plan}const field=a.detour&&a.detour.route===a.route?a.detour.field:(a.route?a.route.field:this.dist);candidates=this.adj[a.node].filter(e=>field[e.to]<field[a.node]-1e-7).sort((x,y)=>(field[x.to]+x.length/this.options.flatSpeed)-(field[y.to]+y.length/this.options.flatSpeed));}
   let next=candidates.find(e=>this.canEnter(e.to,a)&&this.people.every(b=>{if((!b.stairMotion&&!b.floorMotion)||b===a)return true;const p=this.g.nodes[a.node].p,q=this.g.nodes[e.to].p,v=this.position(b),dx=q[0]-p[0],dy=q[1]-p[1],t=Math.max(0,Math.min(1,((v[0]-p[0])*dx+(v[1]-p[1])*dy)/(dx*dx+dy*dy||1)));return Math.abs(p[2]+(q[2]-p[2])*t-v[2])>=1.6||Math.hypot(p[0]+dx*t-v[0],p[1]+dy*t-v[1])>=.48-1e-7}));if(next){next=this.floorShortcut(a,next);a.stuck=0;const p=this.g.nodes[a.node].p,q=this.g.nodes[next.to].p;if(Math.hypot(q[0]-p[0],q[1]-p[1])>.01&&!this.visibleFloor(p,q,this.g.nodes[a.node].floor)){const turn=Math.atan2(-(q[0]-p[0]),q[1]-p[1])-a.facing;a.facing+=Math.max(-.25,Math.min(.25,Math.atan2(Math.sin(turn),Math.cos(turn))));}a.target=next.to;a.length=next.length;a.progress=0;a.speed=(next.stairs?this.options.stairSpeed:this.options.flatSpeed)*a.factor;a.status='moving';this.reserved.set(next.to,a.id);if(this.g.nodes[a.node].kind==='floor'&&this.g.nodes[next.to].kind==='floor'&&this.visibleFloor(p,q,this.g.nodes[a.node].floor)){a.floorMotion={p:[...p],v:[0,0]};this.occupancy.delete(a.node);}}else{a.status='waiting';a.wait+=dt;a.stuck+=dt;waiting++}
  }
  this.observeFlow(dt);this.maxWait=Math.max(this.maxWait,waiting);if(this.done===this.initial||this.time>=this.maxSeconds||this.people.every(a=>['exited','unreachable'].includes(a.status)))this.finished=true;
 }
 position(a){if(a.floorMotion)return a.floorMotion.p;if(a.stairMotion)return this.pathPoint(a.route,a.stairMotion.s);const p=this.g.nodes[a.node].p;if(a.target===null)return p;const q=this.g.nodes[a.target].p;return p.map((v,i)=>v+(q[i]-v)*a.progress)}
 report(){this.broadcastGuides();const exited=this.people.filter(a=>a.exitTime!==null).map(a=>a.exitTime).sort((a,b)=>a-b);return {schema:14,guideMessages:this.guideMessages,guideCommunication:{enabled:this.options.guides&&this.options.balanced,intervalSeconds:1,guidesPerFloor:2,forecast:this.options.blockedWell>=0?'closure-response (validated legacy policy)':'remaining delay at individual arrival; maximum downstream bottleneck; measured waits after 3s stuck'},wellChanges:this.wellChanges,lastReroute:this.lastReroute,behavior:'nearest-current-floor-portal-first; current-passage queue and observed slow transit; guides forecast remaining downstream bottleneck at individual arrival every 1s; reconsider every 5s with guides on floors even while progressing; 3-8s improvement threshold; no in-flight switching',routeChanges:this.people.reduce((sum,a)=>sum+a.switches,0),routes:this.routeStats(),options:this.options,elapsed:this.time,total:this.initial,exited:this.done,remaining:this.initial-this.done,unreachable:this.people.filter(a=>a.status==='unreachable').length,maxWaiting:this.maxWait,completionSeconds:this.done===this.initial?this.time:null,p95Seconds:this.done>=Math.ceil(this.initial*.95)?exited[Math.ceil(this.initial*.95)-1]:null,coverage:this.coverage,floors:this.g.floors.map(f=>({floor:f.level,total:this.people.filter(a=>a.fromFloor===f.level).length,exited:this.people.filter(a=>a.fromFloor===f.level&&a.status==='exited').length})),limitations:['Assumed occupancy, speeds and reaction delay; no fire/smoke physics','Continuous floor steering inside certified clear cells, graph portal connections; continuous distance-following stair lanes with rounded landings and body clearance; stopped escalators assumed walkable downward in both lanes','Only model-connected floor cells sampled; disconnected rooms are not populated','Exterior endpoint is not a verified safe assembly point','Upper floors and stair dimensions are assumed; not a safety certification']}}
}
