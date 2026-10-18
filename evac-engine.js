// Deterministic graph occupancy model. Seconds/metres, fixed 0.1-second steps.
export class Evacuation {
 constructor(graph,options={}) {
  this.g=graph;this.options={perFloor:20,seed:42,fireFloor:3,blockedWell:-1,flatSpeed:1.2,stairSpeed:.65,delayMin:5,delayMax:30,balanced:true,stoppedEscalators:true,stairLanes:2,...options};this.time=0;this.maxWait=0;this.done=0;this.finished=false;this.maxSeconds=1800;
  const o=this.options;this.adj=graph.nodes.map(()=>[]);this.exit=new Set(graph.exits);
  this.closed=new Set(graph.nodes.flatMap((n,i)=>n.kind==='stairs'&&(n.floor===o.fireFloor||(o.fireFloor===1&&n.floor===2))&&n.well===o.blockedWell?[i]:[]));
  for(const[a,b,length]of graph.edges){if([a,b].some(i=>graph.nodes[i].kind==='stairs'&&(graph.nodes[i].lane||0)>=o.stairLanes))continue;if(this.closed.has(a)||this.closed.has(b))continue;if(!o.stoppedEscalators&&[a,b].some(i=>graph.nodes[i].kind==='escalator'))continue;const stairs=[a,b].some(i=>['stairs','escalator'].includes(graph.nodes[i].kind));const e={length,stairs};this.adj[a].push({to:b,...e});this.adj[b].push({to:a,...e})}
  this.dist=this.field(graph.exits);
  this.routes=(graph.routes||[]).filter(r=>(r.kind!=='stairs'||(r.lane||0)<o.stairLanes)&&(o.stoppedEscalators||r.kind!=='escalator')&&!r.nodes.some(n=>this.closed.has(n))).map(r=>({...r,field:this.field([r.nodes[0]],n=>(n.kind==='floor'||n.kind==='entry')&&n.floor===r.fromFloor),transitSeconds:r.nodes.slice(1).reduce((sum,n,i)=>sum+Math.hypot(...graph.nodes[n].p.map((v,k)=>v-graph.nodes[r.nodes[i]].p[k]))/(r.kind==='exit'?o.flatSpeed:o.stairSpeed),0),assigned:0,entered:0,completed:0,waiting:0}));
  let seed=o.seed>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  // Identical spawn set for baseline and closure: never drop unreachable people.
  const reachable=new Set(graph.reachable);this.people=[];this.occupancy=new Map();this.reserved=new Map();this.coverage=[];
  for(const f of graph.floors){let pool=graph.nodes.flatMap((n,i)=>n.floor===f.level&&n.kind==='floor'&&n.p[1]>-20&&reachable.has(i)?[i]:[]);for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}this.coverage.push({floor:f.level,available:pool.length,requested:o.perFloor,spawned:Math.min(pool.length,o.perFloor)});for(const node of pool.slice(0,o.perFloor)){const a={id:this.people.length,node,fromFloor:f.level,delay:o.delayMin+random()*(o.delayMax-o.delayMin),factor:.85+random()*.3,target:null,progress:0,wait:0,status:'preparing',exitTime:null,passedDoor:false,route:null,routeIndex:-1,lastWell:null,stuck:0,distance:0,facing:0,lastDecision:-100,switches:0,decision:null};this.people.push(a);this.occupancy.set(node,a.id)}}
  // Clearance at short landing segments and floor merges; same-node reservation
  // alone is insufficient where distinct lane nodes are physically close.
  this.conflicts=graph.nodes.map(()=>[]);const buckets=new Map(),key=p=>[Math.floor(p[0]/.48),Math.floor(p[1]/.48),Math.floor(p[2]/1.6)];
  graph.nodes.forEach((n,i)=>{const k=key(n.p).join(',');if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i)});
  for(const r of this.routes.filter(r=>r.kind==='stairs'))for(const i of r.nodes){const p=graph.nodes[i].p,[x,y,z]=key(p);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const j of buckets.get([x+dx,y+dy,z+dz].join(','))||[]){if(i===j)continue;const q=graph.nodes[j].p;if(Math.abs(p[2]-q[2])<1.6&&Math.hypot(p[0]-q[0],p[1]-q[1])<.48-1e-6){this.conflicts[i].push(j);this.conflicts[j].push(i)}}}
  this.conflicts=this.conflicts.map(ids=>[...new Set(ids)]);
  for(const r of this.routes.filter(r=>r.kind==='stairs')){const c=r.center??(graph.nodes[r.nodes[1]].p[0]+graph.nodes[r.nodes.at(-2)].p[0])/2; r.motionStart=r.nodes[1];r.motionEnd=r.nodes.at(-2);const p=graph.nodes[r.motionStart].p,q=graph.nodes[r.motionEnd].p,offset=r.flightOffset??(.5+.6*(r.lane||0)),z=(p[2]+q[2])/2,radius=.2+.6*(r.lane||0);const points=[p,[c+offset,-5.9,p[2]],[c+offset,-1.1,z],[c+offset,-.9,z]];
   for(let i=1;i<=16;i++){const t=i*Math.PI/32;points.push([c+.3+radius*Math.cos(t),-.9+radius*Math.sin(t),z])}points.push([c-.3,-.9+radius,z]);
   for(let i=1;i<=16;i++){const t=Math.PI/2+i*Math.PI/32;points.push([c-.3+radius*Math.cos(t),-.9+radius*Math.sin(t),z])}points.push([c-offset,-1.1,z],[c-offset,-5.9,q[2]],q);
   const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(...points[i].map((v,k)=>v-points[i-1][k])));r.path={points,lengths,total:lengths.at(-1)};
  }
  this.initial=this.people.length;this.stepCount=0;
 }
 field(sources,allowed=()=>true){const dist=new Float64Array(this.g.nodes.length);dist.fill(Infinity);const heap=[];
  const push=v=>{heap.push(v);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p][0]<=v[0])break;heap[i]=heap[p];i=p}heap[i]=v};
  const pop=()=>{const top=heap[0],v=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=v[0])break;heap[i]=heap[c];i=c}heap[i]=v}return top};
  for(const i of sources){dist[i]=0;push([0,i])}while(heap.length){const[d,i]=pop();if(d!==dist[i])continue;for(const e of this.adj[i]){if(!allowed(this.g.nodes[e.to],e.to,i))continue;const nd=d+e.length/(e.stairs?this.options.stairSpeed:this.options.flatSpeed);if(nd<dist[e.to]){dist[e.to]=nd;push([nd,e.to])}}}return dist;
 }
 pathPoint(r,d){const{points,lengths,total}=r.path;d=Math.max(0,Math.min(total,d));let i=1;while(i<lengths.length-1&&lengths[i]<d)i++;const t=(d-lengths[i-1])/(lengths[i]-lengths[i-1]);return points[i-1].map((v,k)=>v+(points[i][k]-v)*t)}
 clearAt(p,a){return this.people.every(b=>{if(b===a||b.status==='exited')return true;const body=this.position(b);if(Math.abs(p[2]-body[2])<1.6&&Math.hypot(p[0]-body[0],p[1]-body[1])<.48-1e-7)return false;
   const target=b.target??b.clearanceTarget;if(b.stairMotion||target==null)return true;const end=this.g.nodes[target].p,dx=end[0]-body[0],dy=end[1]-body[1];const distance=v=>{const t=Math.max(0,Math.min(1,((v[0]-body[0])*dx+(v[1]-body[1])*dy)/(dx*dx+dy*dy||1)));return Math.abs(v[2]-(body[2]+(end[2]-body[2])*t))>=1.6?Infinity:Math.hypot(v[0]-body[0]-dx*t,v[1]-body[1]-dy*t)};
   const d=distance(p);if(d>=.52-1e-7)return true;
   // An uncommitted follower must not reserve the leader's current position.
   return b.target===null&&d>=distance(this.position(a))-1e-8;
  })}
 canEnter(node,a){return [node,...this.conflicts[node]].every(i=>(!this.occupancy.has(i)||this.occupancy.get(i)===a.id)&&(!this.reserved.has(i)||this.reserved.get(i)===a.id))&&this.people.every(b=>!b.stairMotion||b===a||Math.abs(this.g.nodes[node].p[2]-this.position(b)[2])>=1.6||Math.hypot(this.g.nodes[node].p[0]-this.position(b)[0],this.g.nodes[node].p[1]-this.position(b)[1])>=.48-1e-7)}
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
 travelTime(r,a){return (r.field[a.node]+r.transitSeconds+(r.kind==='exit'?0:this.dist[r.nodes.at(-1)]))/a.factor}
 expectedWait(r,a){if(!this.options.balanced)return 0;const ahead=this.people.filter(p=>p!==a&&p.route===r&&p.status==='waiting'&&(p.routeIndex>=0||r.field[p.node]<=Math.min(8,r.field[a.node]))).length;
  const speed=(r.kind==='exit'?this.options.flatSpeed:this.options.stairSpeed)*a.factor,headway=(r.kind==='stairs'?.62:2*this.g.spacing)/speed+.2;
  const entryOccupied=this.occupancy.has(r.nodes[0])&&this.occupancy.get(r.nodes[0])!==a.id;
  const approaching=r.kind==='stairs'?this.people.filter(p=>p!==a&&p.route===r&&p.routeIndex<0&&r.field[p.node]<=Math.min(8,r.field[a.node]+2)).length:0;const tail=r.kind==='stairs'?this.people.filter(p=>p!==a&&p.route===r&&p.stairMotion&&p.stairMotion.s<2.5).length:0;const sibling=r.family?this.routes.find(x=>x.family===r.family&&x!==r):null;const load=x=>this.people.filter(p=>p!==a&&p.route===x&&(p.routeIndex>=0||x.field[p.node]<=8)).length;const laneDelay=sibling?Math.max(0,load(r)-load(sibling)-1)*headway*1.2:0;return laneDelay+Math.max(ahead,approaching+Math.max(0,tail-1))*headway+(entryOccupied?headway:0)+(a.route===r?Math.min(30,a.stuck):0);
 }
 localDetour(a){const goal=a.route?.nodes[0];if(goal==null)return null;const floor=this.g.nodes[a.node].floor,blocked=new Set([...this.occupancy,...this.reserved].filter(([id,person])=>person!==a.id&&id!==goal).map(([id])=>id));const bodies=this.people.filter(b=>b!==a&&b.stairMotion&&Math.abs(this.position(b)[2]-this.g.nodes[a.node].p[2])<1.6).map(b=>this.position(b));
  const field=this.field([goal],(n,id,from)=>{if(n.floor!==floor||!['floor','entry'].includes(n.kind)||blocked.has(id))return false;const p=n.p,q=this.g.nodes[from].p,dx=q[0]-p[0],dy=q[1]-p[1];return bodies.every(v=>{const t=Math.max(0,Math.min(1,((v[0]-p[0])*dx+(v[1]-p[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]+dx*t-v[0],p[1]+dy*t-v[1])>=.52})});return Number.isFinite(field[a.node])?{field,route:a.route,until:this.time+6}:null;
 }
 routeCost(r,a){return this.travelTime(r,a)+this.expectedWait(r,a)}
 chooseRoute(a,reconsider=false){if(this.g.nodes[a.node].floor===1&&a.passedDoor)return;if(a.routeIndex>=0)return;
  const choices=this.choices(a).sort((x,y)=>this.routeCost(x,a)-this.routeCost(y,a));if(!choices.length)return;const best=choices[0],current=a.route;
  if(reconsider){if(this.time-a.lastDecision<10)return;a.lastDecision=this.time;if(!current||best===current||this.routeCost(current,a)-this.routeCost(best,a)<Math.max(3,this.travelTime(current,a)*.1))return;}
  if(current===best)return;const previous=current?.id;if(current){current.assigned--;a.switches++}a.route=best;best.assigned++;a.routeIndex=-1;a.lastDecision=this.time;
  a.decision={time:this.time,from:previous||null,to:best.id,reason:current?'queue-delay-exceeds-detour':'shortest-available-path',travelSeconds:this.travelTime(best,a),expectedWaitSeconds:this.expectedWait(best,a)};
 }
 routeStats(){return this.routes.map(r=>({id:r.id,kind:r.kind,well:r.well,lane:r.lane??null,floor:r.fromFloor,assigned:r.assigned,entered:r.entered,completed:r.completed,waiting:this.people.filter(a=>a.route===r&&a.status==='waiting').length}))}
 step(){if(this.finished)return;const dt=.1;this.time=+(this.time+dt).toFixed(6);this.stepCount++;let waiting=0;
  for(const a of this.people){a.previousPosition=[...this.position(a)];a.previousFacing=a.facing;a.previousDistance=a.distance;a.clearanceTarget=null;if(!a.stairMotion&&a.status!=='exited'&&a.target===null){if(a.routeIndex>=0&&a.route){a.clearanceTarget=a.route.nodes[a.route.nodes.indexOf(a.node)+1]??null}else{const field=a.route?.field||this.dist;const best=this.adj[a.node].filter(e=>field[e.to]<field[a.node]-1e-7).sort((x,y)=>(field[x.to]+x.length/this.options.flatSpeed)-(field[y.to]+y.length/this.options.flatSpeed))[0];a.clearanceTarget=best?.to??null}}}
  // Leaders advance first; followers respond to distance rather than vacant cells.
  const stairPeople=this.people.filter(a=>a.stairMotion).sort((a,b)=>b.stairMotion.s-a.stairMotion.s);const moved=new Set(stairPeople.map(a=>a.id));for(const a of stairPeople){this.moveStair(a,dt);if(a.status==='waiting')waiting++}
  // Rotate priority deterministically to avoid a persistent agent-ID advantage.
  for(let k=0;k<this.people.length;k++){const a=this.people[(k+this.stepCount)%this.people.length];if(a.status==='exited'||moved.has(a.id))continue;
   if(a.target!==null){let delta=Math.min(dt*a.speed,a.length*(1-a.progress));const p=this.g.nodes[a.node].p,q=this.g.nodes[a.target].p,clear=d=>this.people.every(b=>{if(!b.stairMotion||b===a)return true;const v=this.position(b),t=a.progress+d/a.length;return Math.abs(p[2]+(q[2]-p[2])*t-v[2])>=1.6||Math.hypot(p[0]+(q[0]-p[0])*t-v[0],p[1]+(q[1]-p[1])*t-v[1])>=.48-1e-7});if(!clear(delta)){let lo=0,hi=delta;for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(clear(mid))lo=mid;else hi=mid}delta=lo}a.status=delta>.0001?'moving':'waiting';a.distance+=delta;a.progress+=delta/a.length;if(a.progress>=1){this.occupancy.delete(a.node);this.reserved.delete(a.target);a.node=a.target;a.target=null;a.progress=0;this.occupancy.set(a.node,a.id);if(a.route&&a.node===a.route.nodes.at(-1)){a.route.assigned--;a.route.completed++;if(a.route.kind==='exit')a.passedDoor=a.route.id;a.lastWell=a.route.kind==='stairs'?a.route.well:null;a.route=null;a.routeIndex=-1}if(this.exit.has(a.node)){a.status='exited';a.exitTime=this.time;this.done++;this.occupancy.delete(a.node)}}continue}
   if(this.time<a.delay)continue;if(!Number.isFinite(this.dist[a.node])){a.status='unreachable';continue}
   if(!a.route)this.chooseRoute(a);else if(a.routeIndex<0&&this.options.balanced&&a.stuck>=2)this.chooseRoute(a,true);
   // Commit to the lane portal actually reached; do not cross another queue to
   // reach the neighboring portal of the same stairwell.
   if(a.route?.kind==='stairs'&&a.routeIndex<0){const here=this.routes.find(r=>r.family===a.route.family&&r.nodes[0]===a.node);if(here&&here!==a.route&&this.expectedWait(here,a)<=this.expectedWait(a.route,a)){a.route.assigned--;here.assigned++;a.route=here;a.detour=null;a.switches++}}
   let candidates;
   if(a.route&&a.node===a.route.nodes[0]&&a.routeIndex<0){a.routeIndex=0;a.route.entered++}
   if(a.route?.kind==='stairs'&&a.node===a.route.motionStart){this.occupancy.delete(a.node);a.stairMotion={s:0,speed:this.options.stairSpeed*a.factor};continue}
   if(a.route&&a.routeIndex>=0){const index=a.route.nodes.indexOf(a.node);const target=a.route.nodes[index+1];candidates=this.adj[a.node].filter(e=>e.to===target)}
   else{if(a.stuck>=2&&this.time-(a.lastLocalPlan??-100)>=1){a.lastLocalPlan=this.time;a.detour=this.localDetour(a)}const field=a.detour&&a.detour.route===a.route&&a.detour.until>this.time?a.detour.field:(a.route?a.route.field:this.dist);candidates=this.adj[a.node].filter(e=>field[e.to]<field[a.node]-1e-7).sort((x,y)=>(field[x.to]+x.length/this.options.flatSpeed)-(field[y.to]+y.length/this.options.flatSpeed));}
   const next=candidates.find(e=>this.canEnter(e.to,a)&&this.people.every(b=>{if(!b.stairMotion||b===a)return true;const p=this.g.nodes[a.node].p,q=this.g.nodes[e.to].p,v=this.position(b),dx=q[0]-p[0],dy=q[1]-p[1],t=Math.max(0,Math.min(1,((v[0]-p[0])*dx+(v[1]-p[1])*dy)/(dx*dx+dy*dy||1)));return Math.abs(p[2]+(q[2]-p[2])*t-v[2])>=1.6||Math.hypot(p[0]+dx*t-v[0],p[1]+dy*t-v[1])>=.48-1e-7}));if(next){a.stuck=0;const p=this.g.nodes[a.node].p,q=this.g.nodes[next.to].p;if(Math.hypot(q[0]-p[0],q[1]-p[1])>.01)a.facing=Math.atan2(-(q[0]-p[0]),q[1]-p[1]);a.target=next.to;a.length=next.length;a.progress=0;a.speed=(next.stairs?this.options.stairSpeed:this.options.flatSpeed)*a.factor;a.status='moving';this.reserved.set(next.to,a.id)}else{a.status='waiting';a.wait+=dt;a.stuck+=dt;waiting++}
  }
  this.maxWait=Math.max(this.maxWait,waiting);if(this.done===this.initial||this.time>=this.maxSeconds||this.people.every(a=>['exited','unreachable'].includes(a.status)))this.finished=true;
 }
 position(a){if(a.stairMotion)return this.pathPoint(a.route,a.stairMotion.s);const p=this.g.nodes[a.node].p;if(a.target===null)return p;const q=this.g.nodes[a.target].p;return p.map((v,i)=>v+(q[i]-v)*a.progress)}
 report(){const exited=this.people.filter(a=>a.exitTime!==null).map(a=>a.exitTime).sort((a,b)=>a-b);return {schema:6,behavior:'shortest-path-first; observed-queue-delay alternative; 10s cooldown and 3s/10% improvement threshold',routeChanges:this.people.reduce((sum,a)=>sum+a.switches,0),routes:this.routeStats(),options:this.options,elapsed:this.time,total:this.initial,exited:this.done,remaining:this.initial-this.done,unreachable:this.people.filter(a=>a.status==='unreachable').length,maxWaiting:this.maxWait,completionSeconds:this.done===this.initial?this.time:null,p95Seconds:this.done>=Math.ceil(this.initial*.95)?exited[Math.ceil(this.initial*.95)-1]:null,coverage:this.coverage,floors:this.g.floors.map(f=>({floor:f.level,total:this.people.filter(a=>a.fromFloor===f.level).length,exited:this.people.filter(a=>a.fromFloor===f.level&&a.status==='exited').length})),limitations:['Assumed occupancy, speeds and reaction delay; no fire/smoke physics','Floor graph occupancy; continuous distance-following stair lanes with rounded landings and body clearance; stopped escalators assumed walkable downward in both lanes','Only model-connected floor cells sampled; disconnected rooms are not populated','Exterior endpoint is not a verified safe assembly point','Upper floors and stair dimensions are assumed; not a safety certification']}}
}
