import fs from 'node:fs';import assert from 'node:assert/strict';
const {Evacuation}=await import('data:text/javascript;base64,'+fs.readFileSync(new URL('../evac-engine.js',import.meta.url)).toString('base64'));
const g=JSON.parse(fs.readFileSync(new URL('../models/evac-graph.json',import.meta.url)));
const s=new Evacuation(g,{perFloor:1});s.people=[];s.occupancy.clear();s.time=100;
const left=s.routes.filter(r=>r.kind==='stairs'&&r.well===0&&r.fromFloor===3);
const node=left[0].nodes[0];
const actor=()=>({id:999,node,factor:1,route:null,routeIndex:-1,lastDecision:-100,stuck:0,switches:0,passedDoor:false,status:'moving',target:null,delay:0,distance:0,facing:0,wait:0});
const a=actor();s.chooseRoute(a);assert.equal(a.route.well,0,'free flow should choose nearest left well');
const queue=n=>Array.from({length:n},(_,id)=>({id,node:left[id%2].nodes[0],route:left[id%2],routeIndex:0,status:'waiting',factor:1,target:null}));
s.people=queue(2);const small=actor();s.chooseRoute(small);assert.equal(small.route.well,0,'small queue must not justify long detour');
s.people=queue(80);assert(s.queueDelay(left[0])>0);assert.equal(s.queueDelay(left[0]),s.queueDelay(left[1]),'both lanes share well congestion');
const costs=s.choices(a).map(r=>({id:r.id,travel:s.travelTime(r,a),delay:s.congestionDelay(r,a),total:s.routeCost(r,a)}));
s.time=112;s.chooseRoute(a,true);assert.equal(a.route.well,1,'equal congestion in both left lanes must cause beneficial right-well detour');assert(a.decision.previousEstimatedSeconds>a.decision.estimatedSeconds+3);assert.equal(s.wellChanges,1);
const kept=a.route;s.people=[];s.time=113;s.chooseRoute(a,true);assert.equal(a.route,kept,'cooldown');
a.routeIndex=1;s.time=140;s.chooseRoute(a,true);assert.equal(a.route,kept,'no in-flight switch');
// Later-floor queues must not affect current-floor portal ranking.
s.people=[];const upper=s.routes.find(r=>r.id==='stairs_0_5');
const upstream={...actor(),node:upper.nodes[0]};
const freeCost=s.routeCost(upper,upstream);s.people=queue(160);
assert.equal(s.routeCost(upper,upstream),freeCost,'later-floor backlog must not bias the current portal');
assert(s.queueDelay(left[0],10000)===0,'queue cannot drain while approaching');
// Exercise the step scheduler: a moving queue follower with stuck=0 must reconsider.
const b=actor();s.people=[];s.chooseRoute(b);b.lastDecision=0;s.people=[...queue(80),b];
for(const p of s.people)if(p!==b){p.status='exited'} // exclude synthetic actors from physics below
let called=false;const choose=s.chooseRoute.bind(s);s.chooseRoute=(p,reconsider)=>{if(p===b&&reconsider)called=true;return choose(p,reconsider)};
s.occupancy.set(b.node,b.id);s.step();assert(called,'moving floor actor never reconsidered');
console.log('PASS shared-well congestion, beneficial cross-well detour, small queue, cooldown, in-flight lock, periodic moving-queue decision',costs);

