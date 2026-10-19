import fs from 'node:fs';import assert from 'node:assert/strict';
const {Evacuation}=await import('data:text/javascript;base64,'+fs.readFileSync(new URL('../evac-engine.js',import.meta.url)).toString('base64'));
const g=JSON.parse(fs.readFileSync(new URL('../models/evac-graph.json',import.meta.url)));
const sim=new Evacuation(g,{perFloor:1});sim.broadcastGuides();assert.equal(sim.guideMessages.length,18);
const route=sim.routes.find(r=>r.kind==='stairs'&&r.fromFloor===5&&r.well===0);
const msg=sim.guideMessages.find(m=>m.floor===3&&m.well===0);msg.delay=45;
assert.equal(sim.sharedGuideDelay(route),45);assert.equal(sim.sharedGuideDelay(sim.routes.find(r=>r.kind==='stairs'&&r.fromFloor===5&&r.well===1)),0);
sim.options.guides=false;assert.equal(sim.sharedGuideDelay(route),0);sim.options.guides=true;sim.time=2;sim.broadcastGuides();assert.equal(sim.sharedGuideDelay(route),0);
for(const blockedWell of [-1,0,1]){const s=new Evacuation(g,{perFloor:20,blockedWell});while(!s.finished)s.step();assert.equal(s.done,s.initial);console.log(JSON.stringify({blockedWell,done:s.done,seconds:s.time,wellChanges:s.wellChanges}));}
console.log('guide broadcasts, downstream penalties, disable, expiry and completion passed');
