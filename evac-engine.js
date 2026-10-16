// Deterministic graph occupancy model. Seconds/metres, fixed 0.1-second steps.
export class Evacuation {
 constructor(graph,options={}) {
  this.g=graph;this.options={perFloor:20,seed:42,fireFloor:3,blockedWell:-1,flatSpeed:1.2,stairSpeed:.65,delayMin:5,delayMax:30,...options};this.time=0;this.maxWait=0;this.done=0;this.finished=false;this.maxSeconds=1800;
  const o=this.options;this.adj=graph.nodes.map(()=>[]);this.exit=new Set(graph.exits);
  this.closed=new Set(graph.nodes.flatMap((n,i)=>n.kind==='stairs'&&(n.floor===o.fireFloor||(o.fireFloor===1&&n.floor===2))&&n.well===o.blockedWell?[i]:[]));
  for(const[a,b,length]of graph.edges){if(this.closed.has(a)||this.closed.has(b))continue;const stairs=graph.nodes[a].kind==='stairs'||graph.nodes[b].kind==='stairs';const e={length,stairs};this.adj[a].push({to:b,...e});this.adj[b].push({to:a,...e})}
  const dist=this.dist=graph.nodes.map(()=>Infinity),heap=[];
  function push(v){heap.push(v);let i=heap.length-1;while(i){let p=(i-1)>>1;if(heap[p][0]<=v[0])break;heap[i]=heap[p];i=p}heap[i]=v}
  function pop(){const top=heap[0],v=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=v[0])break;heap[i]=heap[c];i=c}heap[i]=v}return top}
  for(const i of graph.exits){dist[i]=0;push([0,i])}while(heap.length){const[d,i]=pop();if(d!==dist[i])continue;for(const e of this.adj[i]){const nd=d+e.length/(e.stairs?o.stairSpeed:o.flatSpeed);if(nd<dist[e.to]){dist[e.to]=nd;push([nd,e.to])}}}
  let seed=o.seed>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  // Identical spawn set for baseline and closure: never drop unreachable people.
  const reachable=new Set(graph.reachable);this.people=[];this.occupancy=new Map();this.reserved=new Map();this.coverage=[];
  for(const f of graph.floors){let pool=graph.nodes.flatMap((n,i)=>n.floor===f.level&&n.kind==='floor'&&n.p[1]>-20&&reachable.has(i)?[i]:[]);for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}this.coverage.push({floor:f.level,available:pool.length,requested:o.perFloor,spawned:Math.min(pool.length,o.perFloor)});for(const node of pool.slice(0,o.perFloor)){const a={id:this.people.length,node,fromFloor:f.level,delay:o.delayMin+random()*(o.delayMax-o.delayMin),factor:.85+random()*.3,target:null,progress:0,wait:0,status:'preparing',exitTime:null};this.people.push(a);this.occupancy.set(node,a.id)}}
  this.initial=this.people.length;this.stepCount=0;
 }
 step(){if(this.finished)return;const dt=.1;this.time=+(this.time+dt).toFixed(6);this.stepCount++;let waiting=0;
  // Rotate priority deterministically to avoid a persistent agent-ID advantage.
  for(let k=0;k<this.people.length;k++){const a=this.people[(k+this.stepCount)%this.people.length];if(a.status==='exited')continue;
   if(a.target!==null){a.progress+=dt*a.speed/a.length;if(a.progress>=1){this.occupancy.delete(a.node);this.reserved.delete(a.target);a.node=a.target;a.target=null;a.progress=0;this.occupancy.set(a.node,a.id);if(this.exit.has(a.node)){a.status='exited';a.exitTime=this.time;this.done++;this.occupancy.delete(a.node)}}continue}
   if(this.time<a.delay)continue;if(!Number.isFinite(this.dist[a.node])){a.status='unreachable';continue}
   const candidates=this.adj[a.node].filter(e=>this.dist[e.to]<this.dist[a.node]-1e-7).sort((x,y)=>(this.dist[x.to]+x.length/(x.stairs?this.options.stairSpeed:this.options.flatSpeed))-(this.dist[y.to]+y.length/(y.stairs?this.options.stairSpeed:this.options.flatSpeed)));
   const next=candidates.find(e=>!this.occupancy.has(e.to)&&!this.reserved.has(e.to));if(next){a.target=next.to;a.length=next.length;a.progress=0;a.speed=(next.stairs?this.options.stairSpeed:this.options.flatSpeed)*a.factor;a.status='moving';this.reserved.set(next.to,a.id)}else{a.status='waiting';a.wait+=dt;waiting++}
  }
  this.maxWait=Math.max(this.maxWait,waiting);if(this.done===this.initial||this.time>=this.maxSeconds||this.people.every(a=>['exited','unreachable'].includes(a.status)))this.finished=true;
 }
 position(a){const p=this.g.nodes[a.node].p;if(a.target===null)return p;const q=this.g.nodes[a.target].p;return p.map((v,i)=>v+(q[i]-v)*a.progress)}
 report(){const exited=this.people.filter(a=>a.exitTime!==null).map(a=>a.exitTime).sort((a,b)=>a-b);return {schema:1,options:this.options,elapsed:this.time,total:this.initial,exited:this.done,remaining:this.initial-this.done,unreachable:this.people.filter(a=>a.status==='unreachable').length,maxWaiting:this.maxWait,completionSeconds:this.done===this.initial?this.time:null,p95Seconds:this.done>=Math.ceil(this.initial*.95)?exited[Math.ceil(this.initial*.95)-1]:null,coverage:this.coverage,floors:this.g.floors.map(f=>({floor:f.level,total:this.people.filter(a=>a.fromFloor===f.level).length,exited:this.people.filter(a=>a.fromFloor===f.level&&a.status==='exited').length})),limitations:['Assumed occupancy, speeds and reaction delay; no fire/smoke physics','One-person graph cell with target reservation; conservative single-file stairs','Only model-connected floor cells sampled; disconnected rooms are not populated','Exterior endpoint is not a verified safe assembly point','Upper floors and stair dimensions are assumed; not a safety certification']}}
}
