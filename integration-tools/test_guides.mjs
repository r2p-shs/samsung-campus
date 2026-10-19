import fs from 'node:fs';import assert from 'node:assert/strict';
const {Evacuation}=await import('data:text/javascript;base64,'+fs.readFileSync(new URL('../evac-engine.js',import.meta.url)).toString('base64'));
const g=JSON.parse(fs.readFileSync(new URL('../models/evac-graph.json',import.meta.url)));
const sim=new Evacuation(g,{perFloor:1});sim.broadcastGuides();assert.equal(sim.guideMessages.length,20);
const route=sim.routes.find(r=>r.kind==='stairs'&&r.fromFloor===5&&r.well===0);
const actor={id:999,node:route.nodes[0],factor:1,route:null,routeIndex:-1,lastDecision:-100,stuck:0,switches:0};
const msg=sim.guideMessages.find(m=>m.floor===3&&m.well===0);msg.delay=5;
assert.equal(sim.sharedGuideDelay(route,actor),0,'queue drained before arrival must not divert');
msg.delay=500;
assert(sim.sharedGuideDelay(route,actor)>0,'persistent downstream bottleneck must affect upper guide');
assert.equal(sim.sharedGuideDelay(sim.routes.find(r=>r.kind==='stairs'&&r.fromFloor===5&&r.well===1),actor),0);
sim.people=[];sim.occupancy.clear();sim.chooseRoute(actor);assert.equal(actor.route.well,1,'upper floor must avoid large reported lower left backlog');
sim.options.guides=false;assert.equal(sim.sharedGuideDelay(route,actor),0);sim.options.guides=true;sim.time=2;sim.broadcastGuides();assert.equal(sim.sharedGuideDelay(route,actor),0);
const forecast=new Evacuation(g,{perFloor:0});forecast.broadcastGuides();const left=forecast.routes.find(r=>r.fromFloor===3&&r.kind==='stairs'&&r.well===0),right=forecast.routes.find(r=>r.fromFloor===3&&r.kind==='stairs'&&r.well===1);const mid=g.nodes.map((n,i)=>({n,i})).filter(v=>v.n.floor===3&&v.n.kind==='floor'&&Number.isFinite(left.field[v.i])&&Number.isFinite(right.field[v.i])).sort((a,b)=>Math.abs(left.field[a.i]-right.field[a.i])-Math.abs(left.field[b.i]-right.field[b.i]))[0].i;const person={...actor,node:mid,route:null};forecast.guideMessages.find(m=>m.floor===3&&m.well===0).incoming=Array.from({length:80},(_,i)=>({person:i,eta:0}));assert(forecast.guideEntryDelay(left,person)>0);forecast.chooseRoute(person);assert.equal(person.route.well,1,'approaching crowd must redirect to the other reachable stair');
for(const blockedWell of [-1,0,1]){const s=new Evacuation(g,{perFloor:20,blockedWell});while(!s.finished)s.step();assert.equal(s.done,s.initial);console.log(JSON.stringify({blockedWell,done:s.done,seconds:s.time,wellChanges:s.wellChanges}));}
console.log('guide broadcasts, downstream penalties, disable, expiry and completion passed');
