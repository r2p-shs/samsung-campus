import fs from 'node:fs';import assert from 'node:assert/strict';
const {Evacuation}=await import('data:text/javascript;base64,'+fs.readFileSync(new URL('../evac-engine.js',import.meta.url)).toString('base64'));
const g=JSON.parse(fs.readFileSync(new URL('../models/evac-graph.json',import.meta.url)));
const sim=new Evacuation(g,{perFloor:0});const route=sim.routes.find(r=>r.id==='stairs_1_3');
for(let i=0;i<3;i++)sim.people.push({id:i,node:route.nodes[0],route,routeIndex:0,stairMotion:{s:2-i*.7,speed:.65},factor:1,status:'moving',distance:0,wait:0,stuck:0,facing:0,target:null});
let stops=0,maxTurn=0,minGap=Infinity;for(let k=0;k<160;k++){for(const a of sim.people){const before=a.facing;sim.moveStair(a,.1);assert(a.stairMotion);if(k>10&&a.stairMotion.speed<.05)stops++;maxTurn=Math.max(maxTurn,Math.abs(a.facing-before));}for(let i=1;i<3;i++){const p=sim.position(sim.people[i-1]),q=sim.position(sim.people[i]);minGap=Math.min(minGap,Math.hypot(p[0]-q[0],p[1]-q[1]));}}
assert.equal(stops,0,'followers stop at route samples');assert(maxTurn<=.25+1e-6);assert(minGap>=.48-1e-6);console.log('PASS continuous three-person following through landing',{stops,maxTurn,minGap});
