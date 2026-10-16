from playwright.sync_api import sync_playwright
import base64
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page();page.goto('http://localhost:8000/_probe/visitor-preview.html')
 data=page.evaluate('''async()=>{const T=await import('three'),{GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');const {makeVisitor}=await import('/ftower-visitor.js');const v=makeVisitor();await v.ready;v.root.position.set(0,0,0);v.root.rotation.set(0,0,0);const output=new T.Group();
function capture(name){v.root.updateMatrixWorld(true);v.state.model.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();const g=o.geometry.clone(),a=g.attributes.position,p=new T.Vector3();for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i);o.applyBoneTransform(i,p);p.applyMatrix4(o.matrixWorld);a.setXYZ(i,p.x,p.y,p.z)}g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');g.computeVertexNormals();const mesh=new T.Mesh(g,o.material);mesh.name=name;output.add(mesh)})}
for(let i=0;i<30;i++)v.update(0,false,1/60);capture('Idle');for(let i=0;i<30;i++)v.update(.03,false,1/60);for(let i=0;i<24;i++){v.update(.078,false,1/23);capture('Walk_'+i)}
const buffer=await new GLTFExporter().parseAsync(output,{binary:true});return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob([buffer]))})}''')
 open('data/campus-integration/assets/visitor/campus-visitor.glb','wb').write(base64.b64decode(data));b.close()
