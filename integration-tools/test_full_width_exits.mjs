import fs from 'node:fs';import assert from 'node:assert/strict';
const{Evacuation}=await import('data:text/javascript;base64,'+fs.readFileSync(new URL('../evac-engine.js',import.meta.url)).toString('base64'));const g=JSON.parse(fs.readFileSync(new URL('../models/evac-graph.json',import.meta.url)));
const s=new Evacuation(g,{perFloor:2}),doors=s.routes.filter(r=>r.kind==='exit');assert.equal(doors.length,13);assert.equal(new Set(doors.flatMap(r=>r.nodes)).size,doors.reduce((n,r)=>n+r.nodes.length,0),'exit routes merge into one cell');
const template=s.people[0];s.people=doors.map((r,id)=>({...template,id,node:r.nodes[0],fromFloor:1,delay:0,factor:1,route:r,routeIndex:-1,status:'preparing'}));s.initial=13;s.occupancy.clear();for(const a of s.people){s.occupancy.set(a.node,a.id);a.route.assigned=1}
let peak=0;const passed=new Map();while(!s.finished){s.step();peak=Math.max(peak,s.people.filter(a=>a.route?.kind==='exit'&&a.routeIndex>=0&&a.status==='moving').length);for(const a of s.people)if(a.passedDoor&&!passed.has(a.id))passed.set(a.id,s.time)}
assert.equal(s.done,13);assert.equal(peak,13);assert.equal(passed.size,13);assert(Math.max(...passed.values())-Math.min(...passed.values())<.2);console.log('PASS 13 simultaneous independent door lanes, all reach exterior',s.time);
const r=s.routes.find(r=>r.kind==='stairs');r.observedSeconds=20;r.observedSpeed=.2;assert(s.slowTransit(r)>30,'creeping stream must count as delay');
// Interior flight nodes remain locked, but an occupied floor portal may reroute.
const t=new Evacuation(g,{perFloor:1});const a=t.people[0];const left=t.routes.find(r=>r.id==='stairs_0_3');a.node=left.nodes[0];a.route=left;a.routeIndex=0;a.lastDecision=-100;left.assigned=1;left.entered=1;
for(const x of t.routes.filter(r=>r.kind==='stairs'&&r.well===0)){x.observedSeconds=30;x.observedSpeed=.12}
t.people=[a];t.chooseRoute(a,true);assert.equal(a.route.well,1);assert.equal(left.entered,0);assert.equal(a.routeIndex,-1);
console.log('PASS slow transit ETA and floor portal escape');
