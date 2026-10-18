import fs from 'node:fs';import assert from 'node:assert/strict';
const{Evacuation}=await import('data:text/javascript;base64,'+fs.readFileSync(new URL('../evac-engine.js',import.meta.url)).toString('base64'));const g=JSON.parse(fs.readFileSync(new URL('../models/evac-graph.json',import.meta.url)));
const results=[];
for(const balanced of [false,true]){const s=new Evacuation(g,{perFloor:40,balanced});let snapshot;while(!s.finished){s.step();if(s.time===200)snapshot=[0,1].map(w=>s.people.filter(a=>a.route?.kind==='stairs'&&a.route.well===w).length)}assert.equal(s.done,400);if(balanced){assert(s.wellChanges>0);assert(snapshot[1]>snapshot[0]*.3,'empty right well while left stream congests')}const result={balanced,seconds:s.time,wellChanges:s.wellChanges,activeAt200:snapshot};results.push(result);console.log(result)}
console.log('PASS 400-person nearest versus congestion routing on identical 13-lane geometry',results);
