const frames=[document.querySelector('#before'),document.querySelector('#after')];
const status=document.querySelector('#status');
async function api(frame){
  for(let i=0;i<600;i++){
    const app=frame.contentWindow?.__umyeon;
    if(app){await app.ready;return app}
    await new Promise(r=>setTimeout(r,100));
  }throw Error('캠퍼스 로딩 시간 초과');
}
try{
 const apps=await Promise.all(frames.map(api));
 for(const [i,frame] of frames.entries()){
   const style=frame.contentDocument.createElement('style');
   style.textContent='#panel,#side,#campus-ctl{display:none!important}';
   frame.contentDocument.head.append(style);
   apps[i].setAfter(false);apps[i].setTower(i===1);apps[i].setShadows(false);
 }
 let syncing=false;
 function copy(a,b){if(syncing)return;syncing=true;const c=a.viewer.camera;b.viewer.camera.setView({destination:c.positionWC.clone(),orientation:{direction:c.directionWC.clone(),up:c.upWC.clone()}});b.viewer.scene.requestRender();syncing=false}
 apps.forEach((a,i)=>{a.viewer.camera.percentageChanged=.001;a.viewer.camera.changed.addEventListener(()=>copy(a,apps[1-i]));});
 function view(top){
   const C=apps[0].qaClip.Cartesian3;
   apps[0].viewer.camera.setView({destination:C.fromDegrees(top?127.0243:127.02355,top?37.4662:37.46540,top?280:115),orientation:{heading:top?0:36*Math.PI/180,pitch:(top?-88:-28)*Math.PI/180,roll:0}});
   copy(apps[0],apps[1]);
 }
 document.querySelector('#front').onclick=()=>view(false);
 document.querySelector('#top').onclick=()=>view(true);
 view(false);
 status.textContent=apps[1].campus.modelVisible?'드래그·휠로 양쪽 시점을 함께 조작할 수 있습니다.':'새 모델 로드 실패 — 기존 F동을 유지했습니다.';
 window.campusComparison={apps,view,copy};
}catch(error){status.textContent=error.message;console.error(error)}
