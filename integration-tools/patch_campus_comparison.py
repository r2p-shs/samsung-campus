"""Small audited app patch for upstream's compiled-only distribution."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'data/campus-integration'
p=ROOT/'assets/index-LuUZAC8N.js'
s=p.read_text(encoding='utf8')
def replace(a,b):
    global s
    assert s.count(a)==1,(a,s.count(a))
    s=s.replace(a,b)
replace('function K9(e){I9=e,e&&!F9&&G9(!0),',
    'function campusReplace(){return s9.get(`replace`)===`1`}function K9(e){if(campusReplace()&&e&&(!M9||P9!==`glb`)){console.warn(`F동 모델 로드 실패: 기존 모델 유지`);return}I9=e,e&&!F9&&!campusReplace()&&G9(!0),')
replace('n&&(n.checked=e),f9()}async function C3e', 'n&&(n.checked=e),W9(),f9()}async function C3e')
replace('t=F9||!!y9?.show&&R9.has(p9.f.entity_id)', 't=F9||(campusReplace()&&I9&&!!M9)||!!y9?.show&&R9.has(p9.f.entity_id)')
replace('y9.show=!F9&&Q9(`landmarks`)','y9.show=!F9&&!(campusReplace()&&I9&&!!M9)&&Q9(`landmarks`)')
replace('v9.tileset.style=F9&&!y9?', 'v9.tileset.style=(F9&&!y9||campusReplace()&&I9&&!!M9)?')
start=s.index('async function x3e()');end=s.index('async function S3e()',start)
s=s[:start]+'''async function x3e(){try{let r=await fetch(p9.layers.f_tower,{cache:`no-cache`});if(!r.ok)return false;let b=await r.arrayBuffer();return b.byteLength>12&&new DataView(b).getUint32(0,true)===0x46546c67}catch{return false}}'''+s[end:]
replace('get campus(){return{after:F9,', 'get campus(){return{replacement:campusReplace(),modelReady:!!M9,modelVisible:!!M9?.show,originalFVisible:!!y9?.show,beforeImagery:!!D9?.show,afterImagery:!!O9?.show,grass:!!k9?.show,after:F9,')
replace('url:p9.layers.f_tower,modelMatrix:', 'url:p9.layers.f_tower,forwardAxis:ay.X,modelMatrix:')
p.write_text(s,encoding='utf8',newline='\n')
print('Patched replacement mode, direct GLB verification, and QA state')
