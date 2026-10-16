import fs from 'node:fs';import assert from 'node:assert/strict';
const{Evacuation}=await import('data:text/javascript;base64,'+fs.readFileSync(new URL('../evac-engine.js',import.meta.url)).toString('base64'));
const g=JSON.parse(fs.readFileSync(new URL('../models/evac-graph.json',import.meta.url)));
const empty=new Evacuation(g,{perFloor:1});empty.people=[];empty.occupancy.clear();
const landing=g.routes.find(r=>r.id==='stairs_1_2').nodes.at(-1);
const actor=()=>({id:999,node:landing,factor:1,route:null,routeIndex:-1,lastWell:1,passedDoor:false,lastDecision:-100,stuck:0,switches:0});
let a=actor();empty.chooseRoute(a);assert.equal(a.route.id,'door_right');assert(a.route.field[landing]<35);
let n=landing,minX=Infinity;while(n!==a.route.nodes[0]){minX=Math.min(minX,g.nodes[n].p[0]);const e=empty.adj[n].filter(e=>a.route.field[e.to]<a.route.field[n]).sort((x,y)=>a.route.field[x.to]+x.length/1.2-a.route.field[y.to]-y.length/1.2)[0];assert(e);n=e.to}assert(minX>-7,'left-end detour persists');
// Assigned-but-distant people must not cause an artificial equal split.
a.route.assigned=1000;const near=actor();empty.chooseRoute(near);assert.equal(near.route.id,'door_right');
// Actual waiting at the entry makes a reachable alternative competitive.
const r=a.route;empty.people=Array.from({length:12},(_,id)=>({id,node:r.nodes[0],route:r,routeIndex:0,status:'waiting'}));const alt=actor();empty.chooseRoute(alt);assert.notEqual(alt.route.id,'door_right');
empty.time=1;empty.chooseRoute(a,true);assert.equal(a.route.id,'door_right','cooldown ignored');empty.time=12;empty.chooseRoute(a,true);assert.notEqual(a.route.id,'door_right');assert.equal(a.decision.reason,'queue-delay-exceeds-detour');
const locked=actor();locked.route=r;locked.routeIndex=0;empty.chooseRoute(locked,true);assert.equal(locked.route,r);
// Every free-flow choice minimizes reachable full path cost, not assigned count.
const free=new Evacuation(g,{perFloor:20});for(const person of free.people){free.chooseRoute(person);const costs=free.choices(person).map(r=>free.travelTime(r,person));assert(Math.abs(free.travelTime(person.route,person)-Math.min(...costs))<1e-7)}
for(const blockedWell of [-1,0,1]){const s=new Evacuation(g,{blockedWell});while(!s.finished){s.step();if(s.stepCount%100===0){const active=s.people.filter(a=>a.status!=='exited');assert.equal(new Set(active.map(a=>a.node)).size,active.length);const moving=active.filter(a=>a.target!==null);assert.equal(new Set(moving.map(a=>a.target)).size,moving.length);assert(active.every(a=>!s.closed.has(a.node)&&!s.closed.has(a.target)))}}assert.equal(s.done,200);console.log('PASS scenario',blockedWell,s.time,'route changes',s.report().routeChanges)}
console.log('PASS nearest actual path, no left detour, no assigned-count bias, queue alternative, cooldown, in-flight lock and occupancy invariants');
