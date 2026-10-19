import fs from 'node:fs';import assert from 'node:assert/strict';
const{Evacuation}=await import('data:text/javascript;base64,'+fs.readFileSync(new URL('../evac-engine.js',import.meta.url)).toString('base64'));const g=JSON.parse(fs.readFileSync(new URL('../models/evac-graph.json',import.meta.url)));
const s=new Evacuation(g,{balanced:false});
for(const a of s.people){s.chooseRoute(a);assert.equal(a.route.field[a.node],Math.min(...s.choices(a).map(r=>r.field[a.node])))}
const a={...s.people[0],node:g.nodes.findIndex(n=>n.floor===3&&n.p[0]===8.8&&n.p[1]===-8.4),route:null,routeIndex:-1,passedDoor:false};s.chooseRoute(a);assert.equal(a.route.well,1);
const original=a.route;for(const r of s.routes.filter(r=>r.well===1))s.dist[r.nodes.at(-1)]=100000;a.route=null;s.chooseRoute(a);assert.equal(a.route,original,'outdoor exit distance biased local choice');
console.log('PASS every initial choice uses nearest current-floor portal; right-near example; distant exit cost independence');
