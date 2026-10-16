// Deterministic graph occupancy model. Seconds/metres, fixed 0.1-second steps.
export class Evacuation {
 constructor(graph,options={}) {
  this.g=graph;this.options={perFloor:20,seed:42,fireFloor:3,blockedWell:-1,flatSpeed:1.2,stairSpeed:.65,delayMin:5,delayMax:30,balanced:true,stoppedEscalators:true,...options};this.time=0;this.maxWait=0;this.done=0;this.finished=false;this.maxSeconds=1800;
  const o=this.options;this.adj=graph.nodes.map(()=>[]);this.exit=new Set(graph.exits);
  this.closed=new Set(graph.nodes.flatMap((n,i)=>n.kind==='stairs'&&(n.floor===o.fireFloor||(o.fireFloor===1&&n.floor===2))&&n.well===o.blockedWell?[i]:[]));
  for(const[a,b,length]of graph.edges){if(this.closed.has(a)||this.closed.has(b))continue;if(!o.stoppedEscalators&&[a,b].some(i=>graph.nodes[i].kind==='escalator'))continue;const stairs=[a,b].some(i=>['stairs','escalator'].includes(graph.nodes[i].kind));const e={length,stairs};this.adj[a].push({to:b,...e});this.adj[b].push({to:a,...e})}
  this.dist=this.field(graph.exits);
  this.routes=(graph.routes||[]).filter(r=>(o.stoppedEscalators||r.kind!=='escalator')&&!r.nodes.some(n=>this.closed.has(n))).map(r=>({...r,field:this.field([r.nodes[0]],n=>(n.kind==='floor'||n.kind==='entry')&&n.floor===r.fromFloor),transitSeconds:r.nodes.slice(1).reduce((sum,n,i)=>sum+Math.hypot(...graph.nodes[n].p.map((v,k)=>v-graph.nodes[r.nodes[i]].p[k]))/(r.kind==='exit'?o.flatSpeed:o.stairSpeed),0),assigned:0,entered:0,completed:0,waiting:0}));
  let seed=o.seed>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  // Identical spawn set for baseline and closure: never drop unreachable people.
  const reachable=new Set(graph.reachable);this.people=[];this.occupancy=new Map();this.reserved=new Map();this.coverage=[];
  for(const f of graph.floors){let pool=graph.nodes.flatMap((n,i)=>n.floor===f.level&&n.kind==='floor'&&n.p[1]>-20&&reachable.has(i)?[i]:[]);for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}this.coverage.push({floor:f.level,available:pool.length,requested:o.perFloor,spawned:Math.min(pool.length,o.perFloor)});for(const node of pool.slice(0,o.perFloor)){const a={id:this.people.length,node,fromFloor:f.level,delay:o.delayMin+random()*(o.delayMax-o.delayMin),factor:.85+random()*.3,target:null,progress:0,wait:0,status:'preparing',exitTime:null,passedDoor:false,route:null,routeIndex:-1,lastWell:null,stuck:0,distance:0,facing:0,lastDecision:-100,switches:0,decision:null};this.people.push(a);this.occupancy.set(node,a.id)}}
  this.initial=this.people.length;this.stepCount=0;
 }
 field(sources,allowed=()=>true){const dist=new Float64Array(this.g.nodes.length);dist.fill(Infinity);const heap=[];
  const push=v=>{heap.push(v);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p][0]<=v[0])break;heap[i]=heap[p];i=p}heap[i]=v};
  const pop=()=>{const top=heap[0],v=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=v[0])break;heap[i]=heap[c];i=c}heap[i]=v}return top};
  for(const i of sources){dist[i]=0;push([0,i])}while(heap.length){const[d,i]=pop();if(d!==dist[i])continue;for(const e of this.adj[i]){if(!allowed(this.g.nodes[e.to]))continue;const nd=d+e.length/(e.stairs?this.options.stairSpeed:this.options.flatSpeed);if(nd<dist[e.to]){dist[e.to]=nd;push([nd,e.to])}}}return dist;
 }
 choices(a){const n=this.g.nodes[a.node];return this.routes.filter(r=>r.fromFloor===n.floor&&Number.isFinite(r.field[a.node])&&Number.isFinite(this.dist[r.nodes.at(-1)]))}
 travelTime(r,a){return (r.field[a.node]+r.transitSeconds+(r.kind==='exit'?0:this.dist[r.nodes.at(-1)]))/a.factor}
 expectedWait(r,a){if(!this.options.balanced)return 0;const ahead=this.people.filter(p=>p!==a&&p.route===r&&p.status==='waiting'&&(p.routeIndex>=0||r.field[p.node]<=Math.min(8,r.field[a.node]))).length;
  const speed=(r.kind==='exit'?this.options.flatSpeed:this.options.stairSpeed)*a.factor,headway=2*this.g.spacing/speed+.2;
  const entryOccupied=this.occupancy.has(r.nodes[0])&&this.occupancy.get(r.nodes[0])!==a.id;
  return ahead*headway+(entryOccupied?headway:0)+(a.route===r?Math.min(30,a.stuck):0);
 }
 routeCost(r,a){return this.travelTime(r,a)+this.expectedWait(r,a)}
 chooseRoute(a,reconsider=false){if(this.g.nodes[a.node].floor===1&&a.passedDoor)return;if(a.routeIndex>=0)return;
  const choices=this.choices(a).sort((x,y)=>this.routeCost(x,a)-this.routeCost(y,a));if(!choices.length)return;const best=choices[0],current=a.route;
  if(reconsider){if(this.time-a.lastDecision<10)return;a.lastDecision=this.time;if(!current||best===current||this.routeCost(current,a)-this.routeCost(best,a)<Math.max(3,this.travelTime(current,a)*.1))return;}
  if(current===best)return;const previous=current?.id;if(current){current.assigned--;a.switches++}a.route=best;best.assigned++;a.routeIndex=-1;a.lastDecision=this.time;
  a.decision={time:this.time,from:previous||null,to:best.id,reason:current?'queue-delay-exceeds-detour':'shortest-available-path',travelSeconds:this.travelTime(best,a),expectedWaitSeconds:this.expectedWait(best,a)};
 }
 routeStats(){return this.routes.map(r=>({id:r.id,kind:r.kind,well:r.well,floor:r.fromFloor,assigned:r.assigned,entered:r.entered,completed:r.completed,waiting:this.people.filter(a=>a.route===r&&a.status==='waiting').length}))}
 step(){if(this.finished)return;const dt=.1;this.time=+(this.time+dt).toFixed(6);this.stepCount++;let waiting=0;
  // Rotate priority deterministically to avoid a persistent agent-ID advantage.
  for(let k=0;k<this.people.length;k++){const a=this.people[(k+this.stepCount)%this.people.length];if(a.status==='exited')continue;
   if(a.target!==null){const delta=Math.min(dt*a.speed,a.length*(1-a.progress));a.distance+=delta;a.progress+=delta/a.length;if(a.progress>=1){this.occupancy.delete(a.node);this.reserved.delete(a.target);a.node=a.target;a.target=null;a.progress=0;this.occupancy.set(a.node,a.id);if(a.route&&a.node===a.route.nodes.at(-1)){a.route.assigned--;a.route.completed++;if(a.route.kind==='exit')a.passedDoor=a.route.id;a.lastWell=a.route.kind==='stairs'?a.route.well:null;a.route=null;a.routeIndex=-1}if(this.exit.has(a.node)){a.status='exited';a.exitTime=this.time;this.done++;this.occupancy.delete(a.node)}}continue}
   if(this.time<a.delay)continue;if(!Number.isFinite(this.dist[a.node])){a.status='unreachable';continue}
   if(!a.route)this.chooseRoute(a);else if(a.routeIndex<0&&this.options.balanced&&a.stuck>=2)this.chooseRoute(a,true);
   let candidates;
   if(a.route&&a.node===a.route.nodes[0]&&a.routeIndex<0){a.routeIndex=0;a.route.entered++}
   if(a.route&&a.routeIndex>=0){const index=a.route.nodes.indexOf(a.node);const target=a.route.nodes[index+1];candidates=this.adj[a.node].filter(e=>e.to===target)}
   else{const field=a.route?a.route.field:this.dist;candidates=this.adj[a.node].filter(e=>field[e.to]<field[a.node]-1e-7).sort((x,y)=>(field[x.to]+x.length/this.options.flatSpeed)-(field[y.to]+y.length/this.options.flatSpeed));}
   const next=candidates.find(e=>!this.occupancy.has(e.to)&&!this.reserved.has(e.to));if(next){a.stuck=0;const p=this.g.nodes[a.node].p,q=this.g.nodes[next.to].p;if(Math.hypot(q[0]-p[0],q[1]-p[1])>.01)a.facing=Math.atan2(-(q[0]-p[0]),q[1]-p[1]);a.target=next.to;a.length=next.length;a.progress=0;a.speed=(next.stairs?this.options.stairSpeed:this.options.flatSpeed)*a.factor;a.status='moving';this.reserved.set(next.to,a.id)}else{a.status='waiting';a.wait+=dt;a.stuck+=dt;waiting++}
  }
  this.maxWait=Math.max(this.maxWait,waiting);if(this.done===this.initial||this.time>=this.maxSeconds||this.people.every(a=>['exited','unreachable'].includes(a.status)))this.finished=true;
 }
 position(a){const p=this.g.nodes[a.node].p;if(a.target===null)return p;const q=this.g.nodes[a.target].p;return p.map((v,i)=>v+(q[i]-v)*a.progress)}
 report(){const exited=this.people.filter(a=>a.exitTime!==null).map(a=>a.exitTime).sort((a,b)=>a-b);return {schema:3,behavior:'shortest-path-first; observed-queue-delay alternative; 10s cooldown and 3s/10% improvement threshold',routeChanges:this.people.reduce((sum,a)=>sum+a.switches,0),routes:this.routeStats(),options:this.options,elapsed:this.time,total:this.initial,exited:this.done,remaining:this.initial-this.done,unreachable:this.people.filter(a=>a.status==='unreachable').length,maxWaiting:this.maxWait,completionSeconds:this.done===this.initial?this.time:null,p95Seconds:this.done>=Math.ceil(this.initial*.95)?exited[Math.ceil(this.initial*.95)-1]:null,coverage:this.coverage,floors:this.g.floors.map(f=>({floor:f.level,total:this.people.filter(a=>a.fromFloor===f.level).length,exited:this.people.filter(a=>a.fromFloor===f.level&&a.status==='exited').length})),limitations:['Assumed occupancy, speeds and reaction delay; no fire/smoke physics','One-person graph cell with target reservation; single-file stairs; stopped escalators assumed walkable downward in both lanes','Only model-connected floor cells sampled; disconnected rooms are not populated','Exterior endpoint is not a verified safe assembly point','Upper floors and stair dimensions are assumed; not a safety certification']}}
}
