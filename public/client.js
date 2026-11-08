import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
const socket=io(),$=id=>document.getElementById(id);
let roomCode="",myId="",inGame=false,scene,camera,renderer,clock,yaw=0,pitch=0,health=100,phase="LOBBY",round=1,keys={},remote=new Map(),colliders=[],weapon,weaponKick=0,walkTime=0,lastShot=0,fireHeld=false,recoilOffset=0,recoilPattern=0,aiming=false,crouched=false,lastUpdate=0,magazine=30,reserveAmmo=150,reloading=false,actionAnim="",actionStart=0,actionDuration=0,knifeGroup=null,knifeActive=false,planting=false,weaponBasePos=new THREE.Vector3();
const raycaster=new THREE.Raycaster(),M=(c,r=.85,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const mats={concrete:M(0x77766e),dark:M(0x414743),steel:M(0x65706d,.35,.7),black:M(0x171c1b,.5,.6),wood:M(0x66503a),olive:M(0x4b5948),red:M(0x793d32)};
function status(t){$("menu-status").textContent=t}
socket.on("connect",()=>status("SECURE LINK ESTABLISHED // SERVER ONLINE"));socket.on("disconnect",()=>status("LINK LOST // RECONNECTING"));
function playerName(){return $("name").value.trim().slice(0,16)||"ROOKIE"}
function enterLobby(r){if(!r||!r.ok){status(r?.error||"Unable to join.");return}roomCode=r.code;myId=r.playerId;$("menu").classList.add("hidden");$("lobby").classList.remove("hidden");$("code-display").textContent=roomCode}
$("quick").onclick=()=>socket.emit("quick-join",{name:playerName()},enterLobby);
$("practice").onclick=()=>socket.emit("practice-room",{name:playerName()},enterLobby);
$("create").onclick=()=>socket.emit("create-room",{name:playerName(),isPrivate:true},enterLobby);
$("join").onclick=()=>socket.emit("join-room",{name:playerName(),code:$("room-code").value},enterLobby);
$("copy-code").onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);$("copy-code").textContent="COPIED"}catch{}};
$("start").onclick=()=>socket.emit("start-match",{code:roomCode});$("back").onclick=()=>location.reload();$("continue").onclick=()=>$("end-screen").classList.add("hidden");
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function tex(base,wood=false){const c=document.createElement("canvas");c.width=c.height=512;const x=c.getContext("2d");x.fillStyle=base;x.fillRect(0,0,512,512);for(let i=0;i<8000;i++){const v=Math.random()*30;x.fillStyle="rgba(255,255,255,"+(v/900)+")";const s=Math.random()*3+1;x.fillRect(Math.random()*512,Math.random()*512,s,s)}if(wood){for(let i=0;i<50;i++){x.strokeStyle="rgba(20,12,6,.14)";x.beginPath();let y=Math.random()*512;x.moveTo(0,y);x.lineTo(512,y+(Math.random()-.5)*12);x.stroke()}}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t}
const concrete=new THREE.MeshStandardMaterial({map:tex("#77766e"),roughness:.97}),wood=new THREE.MeshStandardMaterial({map:tex("#66503a",true),roughness:.9});
function box(x,y,z,w,h,d,mat,solid=true){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);if(solid)colliders.push({min:new THREE.Vector3(x-w/2,y-h/2,z-d/2),max:new THREE.Vector3(x+w/2,y+h/2,z+d/2)});return o}
function cyl(x,y,z,r,h,mat){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,18),mat);o.position.set(x,y,z);o.castShadow=true;scene.add(o);return o}
function crate(x,z,w=1.7,h=1.3,d=1.4){box(x,h/2,z,w,h,d,wood);for(let y=.2;y<h;y+=.28)box(x,y,z-d/2-.02,w*.92,.035,.035,mats.steel,false)}
function barrel(x,z){cyl(x,.55,z,.38,1.1,mats.red);for(const y of [.2,.88])cyl(x,y,z,.395,.045,mats.steel)}
function buildMap(){
 scene.background=new THREE.Color(0x89918b);scene.fog=new THREE.FogExp2(0x7b847e,.019);
 scene.add(new THREE.HemisphereLight(0xd3ddd4,0x252a27,1.15));
 const sun=new THREE.DirectionalLight(0xffe8c9,1.65);sun.position.set(-18,26,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-34;sun.shadow.camera.right=34;sun.shadow.camera.top=34;sun.shadow.camera.bottom=-34;scene.add(sun);
 // Warehouse shell.
 box(0,-.25,0,56,.5,44,concrete,false);box(0,5.5,0,56,.4,44,mats.dark,false);
 box(0,2.7,-22,56,5.5,.65,concrete);box(0,2.7,22,56,5.5,.65,concrete);box(-28,2.7,0,.65,5.5,44,concrete);box(28,2.7,0,.65,5.5,44,concrete);
 // Three staggered cross-partitions create west, central and east combat sectors.
 // Each partition deliberately leaves an offset doorway, preventing a single long sightline.
 const partition=(x,gapZ)=>{for(const [a,b] of [[-20,gapZ-2.1],[gapZ+2.1,20]]){const len=b-a;if(len>0)box(x,1.85,(a+b)/2,.42,3.7,len,concrete)}box(x,3.8,gapZ,.5,.25,4.2,mats.steel,false)};
 partition(-13,-8);partition(0,8);partition(13,-8);
 // Cross-walls split each side into connected rooms; openings alternate to form an S-shaped route.
 const cross=(z,gapX)=>{for(const [a,b] of [[-27,gapX-2.2],[gapX+2.2,27]]){const len=b-a;if(len>0)box((a+b)/2,1.75,z,len,3.5,.42,concrete)}box(gapX,3.55,z,4.4,.22,.5,mats.steel,false)};
 cross(-11,-5);cross(11,5);
 // Reinforced door jambs and overhead lintels make openings read as actual doorways.
 for(const [x,z] of [[-13,-8],[0,8],[13,-8]])for(const side of [-1,1]){
  box(x,1.75,z+side*2.15,.48,3.5,.32,mats.dark);
  box(x,3.52,z+side*2.15,.72,.18,.42,mats.steel,false);
 }
 // Central objective / loading island with multiple approach angles.
 box(0,.85,0,5.2,1.7,3.6,mats.black);box(0,1.74,0,4.6,.12,3.1,mats.steel,false);
 const siteRing=new THREE.Mesh(new THREE.RingGeometry(2.65,2.82,64),new THREE.MeshBasicMaterial({color:0xc8dc8b,side:THREE.DoubleSide,transparent:true,opacity:.72}));siteRing.rotation.x=-Math.PI/2;siteRing.position.set(0,.035,0);scene.add(siteRing);
 const siteLabel=new THREE.Mesh(new THREE.BoxGeometry(1.4,.025,.12),new THREE.MeshBasicMaterial({color:0xc8dc8b}));siteLabel.position.set(0,.045,-2.95);scene.add(siteLabel);
 for(const x of [-1.8,1.8])for(const z of [-1.1,1.1])box(x,2.02,z,.12,.5,.12,mats.olive,false);
 // Storage racks against walls, with shelves and upright supports.
 for(const x of [-24,24])for(const z of [-15,-5,5,15]){
  box(x,1.55,z,.55,3.1,3.4,mats.black);
  for(const y of [.65,1.55,2.45])box(x+(x<0?.34:-.34),y,z,1.1,.09,3.2,mats.steel,false);
 }
 // Palletized cargo and chest-high cover in each sector; gaps preserve flanking routes.
 crate(-20,-15,2.2,1.8,1.8);crate(-19,1,2,1.4,1.6);crate(-7,-16,2.1,1.55,1.7);
 crate(7,16,2.1,1.55,1.7);crate(19,-1,2,1.4,1.6);crate(20,15,2.2,1.8,1.8);
 for(const [x,z] of [[-17,-6],[-9,5],[-4,-3],[5,3],[9,-5],[17,6]]){
  box(x,.72,z,2.4,1.44,1.1,mats.steel);
  box(x,.78,z+(z<0?2.2:-2.2),1.35,1.56,.85,mats.dark);
 }
 // Forklift-like industrial props and barrels add visual landmarks.
 for(const [x,z] of [[-22,8],[22,-8]]){
  box(x,.65,z,2.5,1.3,1.45,mats.olive);box(x,1.45,z-.48,1.8,.3,.45,mats.black);
  for(const side of [-1,1]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.2,16),mats.black);wheel.rotation.z=Math.PI/2;wheel.position.set(x+side*1.05,.32,z+.35);scene.add(wheel)}
  box(x+ (x<0?1.45:-1.45),1.25,z-.65,.12,2.5,.12,mats.steel);
 }
 for(const [x,z] of [[-22,-2],[-16,15],[16,-15],[22,2]]){barrel(x,z);barrel(x+.85,z+.15)}
 // Ceiling trusses kept high and sparse so they don't visually cut through combat lanes.
 for(const x of [-20,-10,0,10,20])box(x,5.15,0,.12,.18,42,mats.black,false);
 for(const z of [-18,-9,0,9,18])box(0,5.15,z,54,.16,.12,mats.black,false);
 for(const x of [-20,-8,8,20])for(const z of [-16,0,16]){
  const light=new THREE.PointLight(0xffdfb0,24,9,2);light.position.set(x,4.65,z);scene.add(light);
  const glow=new THREE.Mesh(new THREE.BoxGeometry(1.5,.035,.38),new THREE.MeshBasicMaterial({color:0xffe7c4}));glow.position.set(x,5.23,z);scene.add(glow);
 }
 // Floor lane markings, broken at walls/doors for subtle industrial navigation.
 for(const z of [-20,-11,0,11,20]){const line=new THREE.Mesh(new THREE.BoxGeometry(52,.012,.025),new THREE.MeshBasicMaterial({color:0x95896c}));line.position.set(0,.012,z);scene.add(line)}
}
function add(parent,geo,mat,pos,rot){const o=new THREE.Mesh(geo,mat);o.position.set(...pos);if(rot)o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
let weaponModels={},activeWeapon="M4";
function loadWeaponModel(url,name){
 const loader=new GLTFLoader();
 loader.load(url,gltf=>{
  const source=gltf.scene;source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source);
  const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const dims=[size.x,size.y,size.z],axis=dims.indexOf(Math.max(...dims)),length=dims[axis];
  if(!Number.isFinite(length)||length<.001){console.warn("Invalid dimensions for",name);return}
  // Center and scale the asset, then align its longest dimension with screen-horizontal X.
  const normalized=new THREE.Group();normalized.add(source);
  source.position.sub(center);source.scale.setScalar(1.08/length);
  const longAxis=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)][axis];
  normalized.quaternion.setFromUnitVectors(longAxis,new THREE.Vector3(0,0,-1));
  normalized.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;if(o.material){o.material.side=THREE.DoubleSide}}});
  normalized.updateMatrixWorld(true);
  const finalBounds=new THREE.Box3().setFromObject(normalized);
  const finalCenter=finalBounds.getCenter(new THREE.Vector3());
  normalized.position.sub(finalCenter);
  weaponModels[name]=normalized;
  if(activeWeapon===name)showWeaponModel(name);
  console.info("Loaded weapon asset:",name,"source axis",axis,"bounds",finalBounds.getSize(new THREE.Vector3()));
 },undefined,e=>console.warn("Could not load "+name+" model; fallback remains active.",e));
}
function makeWeaponHands(holder){
 const glove=M(0x34393b,.88,.02),sleeve=M(0x242a2d,.95,0),cuff=M(0x41474a,.9,0);
 const part=(geo,mat,pos,rot)=>{const o=new THREE.Mesh(geo,mat);o.position.set(...pos);if(rot)o.rotation.set(...rot);o.frustumCulled=false;o.castShadow=true;holder.add(o);return o};
 // Sleeves and cuffs remain separate from the hands.
 part(new THREE.CapsuleGeometry(.075,.43,5,9),sleeve,[.12,-.57,-.88],[.18,0,-.22]);
 part(new THREE.CapsuleGeometry(.075,.43,5,9),sleeve,[.49,-.56,-.58],[-.18,0,.32]);
 part(new THREE.CylinderGeometry(.079,.079,.09,12),cuff,[.12,-.38,-.98],[.18,0,-.22]);
 part(new THREE.CylinderGeometry(.079,.079,.09,12),cuff,[.49,-.37,-.68],[-.18,0,.32]);
 // Build each glove as ONE merged BufferGeometry mesh, not a pile of visible primitives.
 const buildHand=(side)=>{
  const pieces=[];
  const add=(geo,pos,rot=[0,0,0],scale=[1,1,1])=>{
   const g=geo;g.scale(...scale);g.rotateX(rot[0]);g.rotateY(rot[1]);g.rotateZ(rot[2]);g.translate(...pos);pieces.push(g);
  };
  const palm=side==="support"?[.16,-.34,-1.02]:[.43,-.36,-.68];
  add(new THREE.SphereGeometry(.09,16,12),palm,[0,0,0],side==="support"?[1.08,.82,1.25]:[1,.88,1.16]);
  for(let i=0;i<4;i++){
   const x=(side==="support"?.085:.36)+i*(side==="support"?.045:.032);
   const y=side==="support"?-.29:-.29,z=side==="support"?-1.11:-.72;
   add(new THREE.CapsuleGeometry(.022,.105,5,8),[x,y,z],[side==="support"?.28:.22,0,side==="support"?-.18:.2]);
  }
  add(new THREE.CapsuleGeometry(.024,.085,5,8),side==="support"?[.25,-.35,-.96]:[.49,-.35,-.59],[0,0,side==="support"?-.75:.7]);
  const merged=mergeGeometries(pieces,false);merged.computeVertexNormals();
  const mesh=new THREE.Mesh(merged,glove);mesh.frustumCulled=false;mesh.castShadow=true;mesh.name=side+"-glove-mesh";holder.add(mesh);
 };
 buildHand("support");buildHand("grip");
}
function showWeaponModel(name){
 const old=weapon.getObjectByName("loaded-weapon");if(old)weapon.remove(old);
 const model=weaponModels[name];if(model){
  const holder=new THREE.Group();holder.name="loaded-weapon";holder.position.set(.30,-.27,-.88);holder.userData.hipPosition=new THREE.Vector3(.30,-.27,-.88);holder.userData.adsPosition=new THREE.Vector3(-.035,-.19,-.63);
  model.traverse(o=>{if(o.isMesh&&o.material){
   const darken=m=>{const mat=m.clone();if(mat.color)mat.color.set(0x303538);if(mat.emissive)mat.emissive.set(0x101315);mat.roughness=.76;mat.metalness=Math.min(mat.metalness??0,.28);return mat};
   o.material=Array.isArray(o.material)?o.material.map(darken):darken(o.material);o.frustumCulled=false;o.castShadow=true;
  }});
  holder.add(model);weapon.add(holder);
 }
 const fallback=weapon.getObjectByName("procedural-fallback");if(fallback)fallback.visible=!model;
 if($("weapon-name"))$("weapon-name").textContent=name==="M4"?"M4 CARBINE":"MP5";
}
function makeKnife(){
 knifeGroup=new THREE.Group();knifeGroup.visible=false;knifeGroup.position.set(.48,-.38,-.72);camera.add(knifeGroup);
 const dark=M(0x252b2c,.35,.65),blade=new THREE.MeshStandardMaterial({color:0xb9c4c5,metalness:.9,roughness:.2});
 add(knifeGroup,new THREE.BoxGeometry(.09,.16,.27),dark,[0,-.02,0],[0,0,-.18]);
 add(knifeGroup,new THREE.BoxGeometry(.045,.08,.1),M(0x111718),[0,.095,0]);
 const edge=add(knifeGroup,new THREE.BoxGeometry(.055,.035,.43),blade,[0,.18,-.27],[.04,0,0]);
 edge.rotation.x=-.08;
 const guard=add(knifeGroup,new THREE.BoxGeometry(.16,.035,.055),dark,[0,.105,-.04]);
 knifeGroup.userData.rest={position:knifeGroup.position.clone(),rotation:new THREE.Euler(-.25,-.18,-.2)};
}
function playAction(name,duration){actionAnim=name;actionStart=performance.now();actionDuration=duration}
function makeWeapon(){
 weapon=new THREE.Group();weapon.frustumCulled=false;weapon.renderOrder=10;camera.add(weapon);
 const weaponFill=new THREE.PointLight(0xd9e2e6,1.35,3.8,2);weaponFill.position.set(.25,.15,-1.35);camera.add(weaponFill);
 const weaponRim=new THREE.PointLight(0x87959b,.65,2.8,2);weaponRim.position.set(-.65,-.35,-1.05);camera.add(weaponRim);
 const fallback=new THREE.Group();fallback.name="procedural-fallback";weapon.add(fallback);
 const metal=M(0x171d1b,.35,.75),poly=M(0x343b35,.75,.1),steel=M(0x69716d,.3,.8),rubber=M(0x151918);
 const put=(geo,mat,pos,rot)=>{const o=new THREE.Mesh(geo,mat);o.position.set(...pos);if(rot)o.rotation.set(...rot);o.frustumCulled=false;fallback.add(o);return o};
 put(new THREE.BoxGeometry(.17,.19,.72),metal,[.34,-.29,-.57]);put(new THREE.BoxGeometry(.18,.23,.24),poly,[.34,-.31,-.25]);put(new THREE.BoxGeometry(.14,.32,.22),rubber,[.34,-.48,-.36],[.18,0,0]);put(new THREE.BoxGeometry(.14,.15,.36),poly,[.34,-.29,-1.02]);put(new THREE.CylinderGeometry(.035,.035,.55,12),steel,[.34,-.27,-1.42],[Math.PI/2,0,0]);put(new THREE.CylinderGeometry(.055,.055,.08,12),metal,[.34,-.27,-1.7],[Math.PI/2,0,0]);put(new THREE.BoxGeometry(.14,.23,.28),metal,[.34,-.48,-.62]);put(new THREE.BoxGeometry(.07,.08,.2),steel,[.34,-.17,-.83]);
 for(let i=0;i<8;i++)put(new THREE.BoxGeometry(.19,.018,.035),steel,[.34,-.16,-.91-i*.055]);put(new THREE.BoxGeometry(.12,.16,.16),metal,[.34,-.075,-.83]);
 const lens=new THREE.Mesh(new THREE.CircleGeometry(.045,16),new THREE.MeshBasicMaterial({color:0x577d77}));lens.position.set(.34,-.075,-.933);fallback.add(lens);
 loadWeaponModel("/assets/M4%2Bcarbine.glb","M4");
 loadWeaponModel("/assets/MP-5.glb","MP5");
 showWeaponModel(activeWeapon);
}
function selectWeapon(name){if(!weapon||!["M4","MP5"].includes(name))return;activeWeapon=name;weaponKick=0;showWeaponModel(name);feed(name+" SELECTED");}
function makeOperator(p){
 const g=new THREE.Group(),team=p.team==="ATTACK";g.userData.team=p.team;g.userData.phase=Math.random()*Math.PI*2;
 let seed=0;for(const ch of String(p.id||p.name||"unit"))seed=(seed*31+ch.charCodeAt(0))>>>0;
 const variant=seed%4,colors=team?[0x515b4a,0x59604b,0x3f5148,0x625b49]:[0x444e55,0x394852,0x50545a,0x35434a];
 const cloth=M(colors[variant]),armor=M([0x303a32,0x293238,0x343b3d,0x252e2b][variant]),skin=M(0x665747),helmet=M([0x30392f,0x242d33,0x3c423b,0x252b30][variant]),gear=M([0x171d1a,0x4b5147,0x292e32,0x5a5143][variant]);
 const torso=add(g,new THREE.CapsuleGeometry(.34,.65,5,10),cloth,[0,1.08,0]);g.userData.torso=torso;
 const teamStripe=new THREE.Mesh(new THREE.BoxGeometry(.48,.075,.365),new THREE.MeshStandardMaterial({color:team?0xe0a34e:0x55b9e8,emissive:team?0x6b2e08:0x07334a,emissiveIntensity:.55,roughness:.55}));teamStripe.position.set(0,1.48,-.025);g.add(teamStripe);
 const shoulderMark=new THREE.Mesh(new THREE.BoxGeometry(.19,.2,.035),new THREE.MeshBasicMaterial({color:team?0xffb14a:0x59caff}));shoulderMark.position.set(team?-.43:.43,1.49,-.03);g.add(shoulderMark);
 add(g,new THREE.BoxGeometry(.72,.58,.34),armor,[0,1.22,-.03]);
 add(g,new THREE.SphereGeometry(.22,16,12),skin,[0,1.82,0]);
 if(variant===1)add(g,new THREE.BoxGeometry(.43,.12,.35),helmet,[0,2.02,0]);
 else add(g,new THREE.SphereGeometry(.25,16,12),helmet,[0,1.98,0]);
 add(g,new THREE.BoxGeometry(.34,.075,.09),M(0x101718),[0,1.83,-.2]);
 add(g,new THREE.BoxGeometry(.35,.38,.18),armor,[0,1.35,.22]);
 // Distinct operator silhouettes: packs, radio aerial, shoulder protection and chest rig.
 if(variant!==2)add(g,new THREE.BoxGeometry(.38,.48,.2),gear,[0,1.28,.31]);
 if(variant===0||variant===3)add(g,new THREE.BoxGeometry(.12,.62,.18),gear,[.28,1.34,.18]);
 for(let i=0;i<4;i++)add(g,new THREE.BoxGeometry(.12,.13,.09),gear,[-.22+i*.145,1.38,-.225]);
 if(variant===1||variant===3){const aerial=add(g,new THREE.CylinderGeometry(.012,.012,.48,6),M(0x171d1a),[.2,2.12,.12]);aerial.rotation.z=-.12}
 g.userData.limbs=[];
 for(let s of [-1,1]){
  add(g,new THREE.SphereGeometry(.17,12,10),gear,[s*.43,1.48,0]);
  const arm=new THREE.Group();arm.position.set(s*.48,1.38,-.02);g.add(arm);
  add(arm,new THREE.CapsuleGeometry(.095,.45,4,8),cloth,[0,-.22,0],[0,0,s*.12]);
  add(arm,new THREE.BoxGeometry(.16,.16,.17),gear,[0,-.46,-.015]);
  g.userData.limbs.push({node:arm,side:s,kind:"arm"});
  const leg=new THREE.Group();leg.position.set(s*.19,.66,0);g.add(leg);
  add(leg,new THREE.CapsuleGeometry(.13,.38,4,8),cloth,[0,-.18,0]);
  add(leg,new THREE.BoxGeometry(.28,.17,.22),gear,[0,-.38,-.01]);
  add(leg,new THREE.BoxGeometry(.26,.16,.42),M(0x191e1c),[0,-.56,-.05]);
  g.userData.limbs.push({node:leg,side:s,kind:"leg"});
 }
 add(g,new THREE.BoxGeometry(.12,.12,.9),M(0x171c1a,.45,.6),[.28,1.25,-.38]);
 return g
}
function updateRemotes(players){for(const p of players){if(p.id===myId)continue;let g=remote.get(p.id);if(!g){g=makeOperator(p);remote.set(p.id,g);scene.add(g)}g.visible=p.alive;g.position.set(p.x,0,p.z);g.rotation.y=p.yaw;g.userData.moving=!!g.userData.lastPos&&Math.hypot(p.x-g.userData.lastPos.x,p.z-g.userData.lastPos.z)>.025;g.userData.lastPos={x:p.x,z:p.z}}const ids=new Set(players.map(p=>p.id));for(const [id,g] of remote)if(!ids.has(id)){scene.remove(g);remote.delete(id)}}
let defuserDevice,defuserLight,bombPlanted=false,bombAnim=0;
function makeDefuser(){
 const g=new THREE.Group();g.name="SITE_A_DEFUSER";
 const caseMat=M(0x242b29,.52,.55),edgeMat=M(0x69746c,.35,.7),screenMat=new THREE.MeshStandardMaterial({color:0x8ed9a0,emissive:0x1b8b49,emissiveIntensity:1.5,roughness:.25});
 const body=add(g,new THREE.BoxGeometry(.72,.22,.48),caseMat,[0,0,0]);
 add(g,new THREE.BoxGeometry(.62,.035,.4),edgeMat,[0,.13,0]);
 add(g,new THREE.BoxGeometry(.32,.018,.16),screenMat,[0,.153,-.055]);
 for(let i=0;i<4;i++)add(g,new THREE.CylinderGeometry(.025,.025,.035,10),edgeMat,[-.25+i*.16,.15,.13]);
 const antenna=add(g,new THREE.CylinderGeometry(.012,.012,.3,8),edgeMat,[.27,.28,.13]);antenna.rotation.z=-.18;
 for(let i=0;i<3;i++)add(g,new THREE.BoxGeometry(.12,.025,.035),M(0xb58a43),[-.2+i*.2,-.13,.08]);
 g.position.set(0,1.84,0);g.visible=false;scene.add(g);defuserDevice=g;defuserLight=new THREE.PointLight(0x4cff85,0,4,2);defuserLight.position.set(0,2.2,0);scene.add(defuserLight);
}
function initThree(){scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.08,140);camera.rotation.order="YXZ";camera.position.set(12,3.4,17);scene.add(camera);renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;$("game").appendChild(renderer.domElement);clock=new THREE.Clock();buildMap();makeDefuser();makeWeapon();makeKnife();weapon.visible=false;
 addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});renderer.domElement.tabIndex=0;renderer.domElement.addEventListener("click",()=>{if(inGame&&!document.pointerLockElement){renderer.domElement.focus();renderer.domElement.requestPointerLock()}});
 document.addEventListener("mousemove",e=>{if(document.pointerLockElement===renderer.domElement){yaw-=e.movementX*.0019;pitch-=e.movementY*.0019;pitch=THREE.MathUtils.clamp(pitch,-1.48,1.48);camera.rotation.set(pitch-recoilOffset,yaw,0,"YXZ")}});
 document.addEventListener("keydown",e=>{const typing=e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement;if(inGame&&!typing&&["KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","KeyC","Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();if(!typing)keys[e.code]=true;if(e.code==="Enter"&&inGame){e.preventDefault();$("chatinput").focus()}if(e.code==="KeyR"&&inGame&&!e.repeat&&!typing)reload();if(e.code==="KeyE"&&inGame&&!e.repeat&&!typing){planting=true;playAction("plant",1900);socket.emit("bomb-interact")}if(e.code==="KeyV"&&inGame&&!e.repeat&&!typing)melee();if(inGame&&!typing&&!e.repeat&&e.code==="Digit1")selectWeapon("M4");if(inGame&&!typing&&!e.repeat&&e.code==="Digit2")selectWeapon("MP5");if(e.code==="KeyC"&&inGame)crouched=true});document.addEventListener("keyup",e=>{keys[e.code]=false;if(e.code==="KeyC")crouched=false});
 document.addEventListener("mousedown",e=>{if(e.button===2){aiming=true;e.preventDefault()}if(e.button===0&&inGame){fireHeld=true;shoot()}});document.addEventListener("mouseup",e=>{if(e.button===0)fireHeld=false;if(e.button===2)aiming=false});window.addEventListener("blur",()=>{fireHeld=false;aiming=false});document.addEventListener("contextmenu",e=>e.preventDefault());animate()}
function collides(x,z,r=.34){for(const c of colliders){const a=THREE.MathUtils.clamp(x,c.min.x,c.max.x),b=THREE.MathUtils.clamp(z,c.min.z,c.max.z);if((x-a)**2+(z-b)**2<r*r)return true}return false}
function move(dt){if(!inGame)return;const locked=document.pointerLockElement===renderer.domElement,f=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),r=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),d=new THREE.Vector3();if(keys.KeyW)d.add(f);if(keys.KeyS)d.sub(f);if(keys.KeyD)d.add(r);if(keys.KeyA)d.sub(r);if(d.lengthSq())d.normalize();const sprint=keys.ShiftLeft||keys.ShiftRight,speed=crouched?2.1:sprint?7.1:4.1;
 if(inGame){const nx=camera.position.x+d.x*speed*dt,nz=camera.position.z+d.z*speed*dt;if(!collides(nx,camera.position.z))camera.position.x=nx;if(!collides(camera.position.x,nz))camera.position.z=nz}camera.position.y=THREE.MathUtils.damp(camera.position.y,crouched?1.18:1.68,13,dt);if(d.lengthSq()&&locked)walkTime+=dt*(sprint?13:8);
 if(fireHeld)shoot();weaponKick=Math.max(0,weaponKick-dt*3.5);
 const elapsed=actionAnim?performance.now()-actionStart:99999,progress=actionDuration?THREE.MathUtils.clamp(elapsed/actionDuration,0,1):1;
 if(actionAnim&&progress>=1){if(actionAnim==="plant"&&!bombPlanted)planting=false;if(actionAnim!=="reload")actionAnim=""}
 if(knifeGroup&&knifeActive){const p=THREE.MathUtils.clamp(elapsed/560,0,1),stab=Math.sin(Math.min(1,p*1.7)*Math.PI/2);knifeGroup.position.set(.48-stab*.48,-.38+stab*.17,-.72-stab*.7);knifeGroup.rotation.set(-.25-stab*.95,-.18+stab*.18,-.2-stab*.42)}
 if(knifeGroup&&!knifeActive){knifeGroup.position.lerp(knifeGroup.userData.rest.position,1-Math.exp(-18*dt));knifeGroup.rotation.x=THREE.MathUtils.damp(knifeGroup.rotation.x,knifeGroup.userData.rest.rotation.x,16,dt);knifeGroup.rotation.y=THREE.MathUtils.damp(knifeGroup.rotation.y,knifeGroup.userData.rest.rotation.y,16,dt);knifeGroup.rotation.z=THREE.MathUtils.damp(knifeGroup.rotation.z,knifeGroup.userData.rest.rotation.z,16,dt)}
 recoilOffset=THREE.MathUtils.damp(recoilOffset,0,5.2,dt);const reloadDip=actionAnim==="reload"?Math.sin(Math.PI*progress)*.34:0,plantDip=actionAnim==="plant"?Math.sin(Math.PI*progress)*.55:0;
 weapon.position.set(Math.sin(walkTime)*.008,-weaponKick*.08+Math.abs(Math.cos(walkTime*2))*.009-reloadDip-plantDip,-weaponKick*.13+(actionAnim==="reload"?Math.sin(progress*Math.PI*2)*.12:0));
 weapon.rotation.set(-weaponKick*.12+(actionAnim==="reload"?Math.sin(progress*Math.PI*2)*.35:0)+(actionAnim==="plant"?progress*.65:0),Math.sin(walkTime)*.012,Math.sin(walkTime*.5)*.012+(actionAnim==="reload"?Math.sin(progress*Math.PI)*.28:0));const viewWeapon=weapon.getObjectByName("loaded-weapon");if(viewWeapon){const target=aiming?viewWeapon.userData.adsPosition:viewWeapon.userData.hipPosition;if(target)viewWeapon.position.lerp(target,1-Math.exp(-12*dt));viewWeapon.scale.setScalar(THREE.MathUtils.damp(viewWeapon.scale.x,aiming?.92:1,12,dt));}camera.rotation.set(pitch-recoilOffset,yaw,0,"YXZ");camera.fov=THREE.MathUtils.damp(camera.fov,aiming?58:76,10,dt);camera.updateProjectionMatrix();
 if(locked&&performance.now()-lastUpdate>50){lastUpdate=performance.now();socket.emit("player-update",{x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw,pitch})}}
function updateAmmo(){const a=$("ammo-mag"),b=$("ammo-reserve");if(a)a.textContent=String(magazine).padStart(2,"0");if(b)b.textContent=String(reserveAmmo).padStart(3,"0")}
function reload(){if(!inGame||reloading||magazine===30||reserveAmmo<=0||knifeActive)return;reloading=true;playAction("reload",1650);feed("RELOADING");setTimeout(()=>{const n=Math.min(30-magazine,reserveAmmo);magazine+=n;reserveAmmo-=n;reloading=false;if(actionAnim==="reload")actionAnim="";updateAmmo();feed("RELOAD COMPLETE")},1650)}
function melee(){if(!inGame||knifeActive||reloading)return;knifeActive=true;knifeGroup.visible=true;playAction("melee",560);feed("KNIFE // QUICK STRIKE");setTimeout(()=>{knifeActive=false;knifeGroup.visible=false;if(actionAnim==="melee")actionAnim=""},560)}
function shoot(){if(!inGame||phase!=="ACTION"||!document.pointerLockElement||reloading||knifeActive||planting||performance.now()-lastShot<145)return;if(magazine<=0){feed("MAGAZINE EMPTY // PRESS R TO RELOAD");return}lastShot=performance.now();magazine--;updateAmmo();weaponKick=Math.min(1,weaponKick+.42);recoilPattern++;recoilOffset=Math.min(.19,recoilOffset+.018+(recoilPattern%5===0?.006:0));yaw+=Math.sin(recoilPattern*1.7)*.0018;const dir=new THREE.Vector3();camera.getWorldDirection(dir);const origin=camera.position.clone(),end=origin.clone().add(dir.clone().multiplyScalar(55)),geo=new THREE.BufferGeometry().setFromPoints([origin,end]),line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffd58b,transparent:true,opacity:.8}));scene.add(line);setTimeout(()=>{scene.remove(line);geo.dispose()},65);raycaster.set(origin,dir);raycaster.far=55;const hits=raycaster.intersectObjects([...remote.values()],true);if(hits.length){let o=hits[0].object;while(o.parent&&!remoteHas(o))o=o.parent;const id=[...remote.entries()].find(([,g])=>g===o)?.[0];if(id)socket.emit("fire",{origin:origin.toArray(),direction:dir.toArray(),targetId:id})}}
function remoteHas(o){return [...remote.values()].includes(o)}
function feed(t){const d=document.createElement("div");d.className="feedline";d.textContent=t;$("feed").prepend(d);setTimeout(()=>d.remove(),2500)}
socket.on("bomb-event",b=>{bombPlanted=b.status==="PLANTED";if(b.status==="PLANTED"){planting=false;playAction("plant-finish",500);feed("DEVICE ARMED // SITE A")}if(b.status==="DEFUSED"||b.status==="DETONATED")planting=false;const el=$("bomb-status");if(!el)return;el.textContent=b.status==="PLANTED"?"BOMB PLANTED // DEFUSE SITE A":b.status==="DEFUSED"?"BOMB DEFUSED // SITE SECURE":b.status==="DETONATED"?"BOMB DETONATED // ROUND LOST":"OBJECTIVE // SITE A"});
socket.on("shot-result",r=>{if(r.targetId===myId){health=r.health;$("health").textContent=health;feed("DAMAGE TAKEN")}const hit=remote.get(r.targetId);if(hit){hit.userData.hitUntil=performance.now()+220;if(!r.alive)hit.userData.dead=true}if(r.shooterId===myId)feed(r.alive?"HIT CONFIRMED":"TARGET NEUTRALIZED")});
socket.on("player-moved",p=>{const g=remote.get(p.id);if(g){g.position.set(p.x,0,p.z);g.rotation.y=p.yaw}});socket.on("player-left",({id})=>{const g=remote.get(id);if(g){scene.remove(g);remote.delete(id)}});
socket.on("room-state",s=>{if(s.code!==roomCode)return;phase=s.phase;round=s.round;$("players").innerHTML=s.players.map(p=>'<div class="player '+(p.team==="DEFEND"?"def":"")+'">'+esc(p.name)+'<small>'+(p.team==="ATTACK"?"ASSAULT":"DEFENSE")+' · '+(p.alive?"READY":"DOWN")+'</small></div>').join("");if(s.phase!=="LOBBY"&&!inGame)startGame(s);if(inGame){if(s.bomb){bombPlanted=!!s.bomb.planted;if($("bomb-status"))$("bomb-status").textContent=s.bomb.planted?"BOMB PLANTED // "+s.bomb.time+"s REMAINING":s.bomb.defused?"BOMB DEFUSED // SITE SECURE":"OBJECTIVE // ATTACKERS PLANT AT SITE A"}$("phase").textContent=s.phase;$("round").textContent="ROUND "+String(s.round).padStart(2,"0");$("timer").textContent=String(Math.floor(s.timeLeft/60)).padStart(2,"0")+":"+String(s.timeLeft%60).padStart(2,"0");const me=s.players.find(p=>p.id===myId);if(me){health=me.health;$("health").textContent=health}updateRemotes(s.players);$("end-screen").classList.toggle("hidden",s.phase!=="END")}});
function startGame(s){inGame=true;magazine=30;reserveAmmo=150;reloading=false;updateAmmo();$("lobby").classList.add("hidden");$("hud").classList.remove("hidden");$("chatbox").classList.remove("hidden");const me=s.players.find(p=>p.id===myId);if(me){camera.position.set(me.x,1.68,me.z);yaw=me.yaw;camera.rotation.set(0,yaw,0,"YXZ")}weapon.visible=true;weapon.position.set(0,0,0);updateRemotes(s.players);$("notice").textContent="WASD MOVE · SHIFT SPRINT · C CROUCH · RMB AIM · LMB FIRE · E PLANT / DEFUSE · R RELOAD · V MELEE"}
$("reload-btn").addEventListener("click",reload);$("bomb-btn").addEventListener("click",()=>socket.emit("bomb-interact"));$("chatform").addEventListener("submit",e=>{e.preventDefault();const m=$("chatinput").value.trim();if(!m)return;socket.emit("chat",{code:roomCode,message:m});$("chatinput").value="";$("chatinput").blur()});socket.on("chat",m=>{const d=document.createElement("div");d.textContent=m.name+": "+m.message;$("chatlog").appendChild(d);$("chatlog").scrollTop=$("chatlog").scrollHeight});
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);bombAnim+=dt;
 if(defuserDevice){defuserDevice.visible=bombPlanted;defuserDevice.rotation.y=Math.sin(bombAnim*1.5)*.045;defuserDevice.position.y=1.84+Math.sin(bombAnim*2.4)*.025;if(defuserLight){defuserLight.intensity=bombPlanted?(Math.sin(bombAnim*7)>0?3.2:.25):0;defuserLight.color.setHex(Math.sin(bombAnim*7)>0?0x4cff85:0xffb34c)}}
 for(const g of remote.values()){const moving=g.userData.moving,t=bombAnim*(moving?9:1.4)+(g.userData.phase||0),flinch=(g.userData.hitUntil||0)>performance.now()?Math.sin((g.userData.hitUntil-performance.now())/220*Math.PI)*.22:0;for(const limb of g.userData.limbs||[]){const swing=moving?Math.sin(t+(limb.side<0?Math.PI:0))*(limb.kind==="leg"?.58:.38):Math.sin(t)*.025;limb.node.rotation.x=(limb.kind==="leg"?swing:-swing*.75)+(limb.kind==="arm"?flinch:0)}if(g.userData.torso){g.userData.torso.position.y=1.08+(moving?Math.abs(Math.sin(t*2))*.035:Math.sin(t)*.012);g.userData.torso.rotation.z=flinch*.45}if(g.userData.dead){g.rotation.z=THREE.MathUtils.damp(g.rotation.z,.9,5,.016);g.position.y=THREE.MathUtils.damp(g.position.y,-.85,5,.016)}}
 if(!inGame){camera.position.x=12+Math.sin(performance.now()*.00012)*1.2;camera.position.y=3.1+Math.sin(performance.now()*.0002)*.12;camera.lookAt(0,1.2,0)}else move(dt);renderer.render(scene,camera)}
initThree();