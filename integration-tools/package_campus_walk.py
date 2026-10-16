"""Build campus walking adapter from the accepted SWM controller."""
from pathlib import Path
import shutil
R=Path(__file__).resolve().parents[1]
C=R/'data/campus-integration'
for src,dest in [('viewer/assets/ftower-plans/ftower-with-plans.glb','models/f_tower_walk.glb'),('viewer/assets/ftower-plans/walk-layout.json','models/walk-layout.json'),('viewer/gen/umyeon_integrated/building.json','models/building-walk.json'),('viewer/ftower-level-nav.js','ftower-level-nav.js')]:
    shutil.copyfile(R/src,C/dest)
bundle=C/'assets/index-LuUZAC8N.js'
s=bundle.read_text(encoding='utf8')
needle='window.__umyeon={viewer:u9,'
assert s.count(needle)==1
bridge='''window.__umyeon={async attachWalkModel(url){
 const placement=Gr.headingPitchRollToFixedFrame(c.fromDegrees(j9.lon,j9.lat,j9.h),new fr(L9(j9.yaw),0,0));
 const local=F.fromArray([.7441652433144595,-.6679955768137475,0,0,.6679955768137475,.7441652433144595,0,0,0,0,1,0,1.13317611772,-.4035371367,0,1]);
 const matrix=F.multiply(placement,local,new F());
 const model=await gM.fromGltfAsync({url,modelMatrix:matrix,upAxis:ay.Z,forwardAxis:ay.X,shadows:zm.DISABLED});
 d9.primitives.add(model);window.__campusWalking=true;K9(true);if(M9)M9.show=false;
 d9.screenSpaceCameraController.enableInputs=false;u9.camera.frustum.near=.05;
 return {model,point:p=>F.multiplyByPoint(matrix,new c(...p),new c()),vector:p=>F.multiplyByPointAsVector(matrix,new c(...p),new c()),
 setNode:(name,elements)=>{const node=model.getNode(name);if(node)node.matrix=F.fromArray(elements)},
 setCamera(position,direction,up,fov,aspect){u9.camera.frustum.fov=aspect>1?2*Math.atan(Math.tan(fov/2)*aspect):fov;u9.camera.setView({destination:this.point(position),orientation:{direction:this.vector(direction),up:this.vector(up)}});f9()}};
},viewer:u9,'''
s=s.replace(needle,bridge)
s=s.replace('...F9?p9.f.hide_ids??[]:[]','...window.__campusWalking?[`0b44f831-3cda-5ce2-8910-b2acd0c426e5`,`7a60ad04-3709-583b-ae29-7381f167fa9e`]:[],...F9?p9.f.hide_ids??[]:[]')
bundle.write_text(s,encoding='utf8',newline='\n')
html=(R/'viewer/ftower_levels_walk.html').read_text(encoding='utf8')
html=html.replace('통합 모델 1~11층 걷기(4층 없음)','캠퍼스에서 F동 내부 걷기')
html=html.replace('href="compare_ftower_plans.html"','href="compare-ftower.html"')
html=html.replace('src="ftower-levels-walk.js"','src="campus-walk.js"')
html=html.replace('<main id="view">','<main id="view"><iframe id="campusScene" title="캠퍼스 지형" src="./?replace=1&tower=1&lite=1&r5=0" style="position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none"></iframe>')
html=html.replace('canvas{display:block;','canvas{position:relative;display:block;')
(C/'walk-ftower.html').write_text(html,encoding='utf8',newline='\n')
s=(R/'viewer/ftower-levels-walk.js').read_text(encoding='utf8')
s=s.replace('new T.WebGLRenderer({antialias:true})','new T.WebGLRenderer({antialias:true,alpha:true})')
s=s.replace("host.prepend(renderer.domElement)","host.insertBefore(renderer.domElement,document.querySelector('#hud'))")
s=s.replace("renderer.setClearColor('#b7cbd5')","renderer.setClearColor(0,0)")
s=s.replace("'assets/ftower-plans/walk-layout.json'","'models/walk-layout.json'").replace("'gen/umyeon_integrated/building.json'","'models/building-walk.json'").replace("'assets/ftower-plans/ftower-with-plans.glb'","'models/f_tower_walk.glb'")
s=s.replace('try{const data=', '''try{
const frame=document.querySelector('#campusScene');
let campus;for(let i=0;i<1200;i++){campus=frame.contentWindow?.__umyeon;if(campus)break;await new Promise(r=>setTimeout(r,100))}
if(!campus)throw Error('캠퍼스 로딩 시간 초과');await campus.ready;
const style=frame.contentDocument.createElement('style');style.textContent='#panel,#side{display:none!important}';frame.contentDocument.head.append(style);
const bridge=await campus.attachWalkModel('models/f_tower_walk.glb');
const direction=new T.Vector3(),up=new T.Vector3();
function renderCampus(){camera.updateMatrixWorld();camera.getWorldDirection(direction);up.setFromMatrixColumn(camera.matrixWorld,1);bridge.setCamera(camera.position.toArray(),direction.toArray(),up.toArray(),camera.fov*Math.PI/180,camera.aspect);}
const data=''' )
s=s.replace('root.updateMatrixWorld(true);for(let c of colliders)', 'root.updateMatrixWorld(true);for(const d of doors)d.group.traverse(o=>{if(o.isMesh)bridge.setNode(o.name,o.matrixWorld.elements)});for(let c of colliders)')
s=s.replace('renderer.render(scene,camera)','renderCampus()')
s=s.replace('window.levelWalk={loaded:true,','window.levelWalk={loaded:true,campus,bridge,doorToggle,')
(C/'campus-walk.js').write_text(s,encoding='utf8',newline='\n')
for name in ['index.html','compare-ftower.html']:
 p=C/name;s=p.read_text(encoding='utf8')
 if name=='index.html':s=s.replace('<aside id="panel">','<aside id="panel"><p><a href="./walk-ftower.html" style="color:#9dd5ff">F동 내부 걷기 · 계단·에스컬레이터</a></p>')
 else:s=s.replace('<header>','<header><a href="./walk-ftower.html">F동 내부 걷기</a>')
 p.write_text(s,encoding='utf8',newline='\n')
print('Campus walking integration generated')
from campus_walk_glb import prepare
prepare()
