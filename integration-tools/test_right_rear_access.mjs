import fs from 'node:fs';import assert from 'node:assert/strict';
const{Evacuation}=await import('data:text/javascript;base64,'+fs.readFileSync(new URL('../evac-engine.js',import.meta.url)).toString('base64'));const g=JSON.parse(fs.readFileSync(new URL('../models/evac-graph.json',import.meta.url)));const s=new Evacuation(g,{balanced:false});
for(const f of g.floors.filter(f=>f.level>=3)){
 const node=g.nodes.findIndex(n=>n.floor===f.level&&n.kind==='floor'&&n.p[0]===20&&n.p[1]===10);assert(node>=0);const a={...s.people[0],node,route:null,routeIndex:-1,passedDoor:false};s.chooseRoute(a);assert.equal(a.route.well,1);
 for(const r of s.routes.filter(r=>r.kind==='stairs'&&r.well===1&&r.fromFloor===f.level)){
  assert(r.field[node]*s.options.flatSpeed<26);let n=node;const path=[n];while(n!==r.nodes[0]){const e=s.adj[n].filter(e=>r.field[e.to]<r.field[n]).sort((a,b)=>r.field[a.to]-r.field[b.to])[0];assert(e);n=e.to;path.push(n);assert(path.length<100)}
  assert(path.every(i=>g.nodes[i].p[0]>=19.5),'central detour remains');
  assert(path.every(i=>{const [x,y]=g.nodes[i].p;return !(x>17.9&&x<21.1&&y>-5.9&&y<.3)}),'path crosses stair shaft');
 }
 console.log('PASS direct right-side approach',f.level,a.route.field[node]*s.options.flatSpeed);
}
assert.equal(g.exitLaneCount,13);assert.equal(g.descentConnections2F.length,4);
