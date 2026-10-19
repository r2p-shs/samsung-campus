import fs from 'node:fs';
import assert from 'node:assert/strict';
process.on('uncaughtException',e=>{console.error(e.message);process.exit(1)});
const {Evacuation}=await import('data:text/javascript;base64,'+fs.readFileSync(new URL('../evac-engine.js',import.meta.url)).toString('base64'));
const g=JSON.parse(fs.readFileSync(new URL('../models/evac-graph.json',import.meta.url)));
const s=new Evacuation(g);assert.equal(s.initial,220);assert.equal(s.guideRoster.length,20);
const released=new Set();while(!s.finished){
 s.step();for(const station of s.guideRoster){if(station.personId===null||released.has(station.personId))continue;
 const z=g.floors.find(f=>f.level===station.floor).z;
 assert(!s.people.some(a=>a.id!==station.personId&&a.status!=='exited'&&s.position(a)[2]>=z-.25),'guide left someone above or on assigned floor');
 assert(!s.guideRoster.some(g=>g.floor>station.floor&&g.state==='guiding'),'upper guides still stationed');released.add(station.personId);}
 const before=JSON.stringify(s.guideMessages);s.report();s.report();assert.equal(JSON.stringify(s.guideMessages),before,'rendering must not change guidance');
}
assert.equal(s.done,220);assert.equal(released.size,20);assert.equal(s.report().guides.exited,20);assert.equal(s.report().residents.exited,200);
assert(s.guideRoster.every(g=>g.releasedAt!==null));
const disabled=new Evacuation(g,{perFloor:0,guides:false});assert.equal(disabled.guideRoster.length,0);
console.log(JSON.stringify({total:s.initial,exited:s.done,seconds:s.time,guides:s.report().guides}));
