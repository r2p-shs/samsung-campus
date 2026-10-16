export function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
export function validFloor(p,level,data,r=.24){const floor=data.floors.find(f=>f.level===level);if(!floor)return false;const [xmin,xmax,ymin,ymax]=data.bounds;let probes=[[0,0],[r,0],[-r,0],[0,r],[0,-r],[r*.707,r*.707],[-r*.707,r*.707],[r*.707,-r*.707],[-r*.707,-r*.707]];return probes.every(([dx,dy])=>{let q=[p[0]+dx,p[1]+dy];let within=q[0]>=xmin&&q[0]<=xmax&&q[1]>=ymin&&q[1]<=ymax;if(level===1)within=within||(q[0]>=-17&&q[0]<=-2&&q[1]>=-38&&q[1]<=-19);if(level===2&&[-20.8,-18.8].some(x=>q[0]>x-.7&&q[0]<x+.7&&q[1]>-16&&q[1]<-8.65))return false;return within&&!floor.regions.some(x=>x.kind==='void'&&inside(q,x.localXY))})}
export function travel(path,t){const lengths=path.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-path[i][j]))),total=lengths.reduce((a,b)=>a+b,0);let left=Math.max(0,Math.min(1,t))*total;for(let i=0;i<lengths.length;i++){if(left<=lengths[i]||i===lengths.length-1){let f=lengths[i]?left/lengths[i]:1;return path[i].map((v,j)=>v+(path[i+1][j]-v)*f)}left-=lengths[i]}}
export function pathLength(path){return path.slice(1).reduce((s,p,i)=>s+Math.hypot(...p.map((v,j)=>v-path[i][j])),0)}

// Find a connected walking surface near the current foot height. Individual
// treads use a smooth ramp for the camera; a floor above cannot capture a walker.
export function surfaceAt(p,data,r=.24){
 const candidates=(x,y,z)=>{
  let result=[];
  for(const f of data.floors){
   if(Math.abs(f.z-z)>.32)continue;
   const inShaft=(data.stairwells||[]).some(w=>{let a=w.opening;return x>a[0]&&x<a[2]&&y>a[1]&&y<a[3]});
   if(!inShaft&&validFloor([x,y,z],f.level,data,0))result.push({z:f.z,level:f.level,stairs:false});
  }
  for(const s of data.stairSurfaces||[]){
   const [x0,y0,x1,y1]=s.rect;if(x<x0||x>x1||y<y0||y>y1)continue;
   const h=s.zStart+(s.zEnd-s.zStart)*(y-s.yStart)/(s.yEnd-s.yStart);
   if(Math.abs(h-z)<=.32)result.push({z:h,level:s.fromFloor,stairs:true,link:s.id});
  }
  return result.sort((a,b)=>Math.abs(a.z-z)-Math.abs(b.z-z));
 };
 const found=candidates(p[0],p[1],p[2])[0];if(!found)return null;
 for(const [dx,dy]of [[r,0],[-r,0],[0,r],[0,-r],[r*.707,r*.707],[-r*.707,r*.707],[r*.707,-r*.707],[-r*.707,-r*.707]])if(!candidates(p[0]+dx,p[1]+dy,found.z).length)return null;
 return found;
}
