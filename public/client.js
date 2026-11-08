import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const socket=io(),$=id=>document.getElementById(id);
let roomCode="",myId="",inGame=false,scene,camera,renderer,clock,yaw=0,pitch=0,health=100,phase="LOBBY",round=1,keys={},remote=new Map(),colliders=[],weapon,weaponKick=0,walkTime=0,lastShot=0,aiming=false,crouched=false,lastUpdate=0,magazine=30,reserveAmmo=150,reloading=false;
const raycaster=new THREE.Raycaster(),M=(c,r=.85,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const mats={concrete:M(0x77766e),dark:M(0x414743),steel:M(0x65706d,.35,.7),black:M(0x171c1b,.5,.6),wood:M(0x66503a),olive:M(0x4b5948),red:M(0x793d32)};
function status(t){$("menu-status").textContent=t}
socket.on("connect",()=>status("SECURE LINK ESTABLISHED // SERVER ONLINE"));socket.on("disconnect",()=>status("LINK LOST // RECONNECTING"));
function playerName(){return $("name").value.trim().slice(0,16)||"ROOKIE"}
function enterLobby(r){if(!r||!r.ok){status(r?.error||"Unable to join.");return}roomCode=r.code;myId=r.playerId;$("menu").classList.add("hidden");$("lobby").classList.remove("hidden");$("code-display").textContent=roomCode}
$("quick").onclick=()=>socket.emit("quick-join",{name:playerName()},enterLobby);
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
 scene.background=new THREE.Color(0x89918b);scene.fog=new THREE.FogExp2(0x7b847e,.018);scene.add(new THREE.HemisphereLight(0xd3ddd4,0x252a27,1.3));
 const sun=new THREE.DirectionalLight(0xffe8c9,2);sun.position.set(-18,26,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-34;sun.shadow.camera.right=34;sun.shadow.camera.top=34;sun.shadow.camera.bottom=-34;scene.add(sun);
 box(0,-.25,0,56,.5,44,concrete,false);box(0,5.5,0,56,.4,44,mats.dark,false);
 box(0,2.7,-22,56,5.5,.65,concrete);box(0,2.7,22,56,5.5,.65,concrete);box(-28,2.7,0,.65,5.5,44,concrete);box(28,2.7,0,.65,5.5,44,concrete);
 for(let x=-24;x<=24;x+=8){for(let z of [-18,0,18]){box(x,2.65,z,.65,5.3,.65,mats.dark);box(x,5.15,z,.95,.2,.95,mats.steel,false)}box(x,5.15,0,.16,.18,43,mats.black,false)}
 for(let z=-18;z<=18;z+=6)box(0,5.18,z,55,.16,.16,mats.black,false);
 box(-9,2.4,-10,.35,4.8,17,concrete);box(9,2.4,10,.35,4.8,17,concrete);box(-18,2.4,0,10,.35,4.8,concrete);box(18,2.4,0,10,.35,4.8,concrete);box(0,2.4,-8,16,.35,4.8,concrete);box(0,2.4,8,16,.35,4.8,concrete);
 box(0,.65,0,3.8,1.3,2.2,mats.black);box(0,1.35,0,3.2,.12,1.7,mats.steel,false);
 for(let x of [-1.25,1.25]){box(x,1.62,0,.1,.4,.1,mats.olive,false);box(x,1.62,.5,.1,.4,.1,mats.olive,false)}
 crate(-15,-12,2.2,1.7,1.6);crate(-18,12);crate(15,12,2,1.6,1.5);crate(18,-12);crate(-5,-15,1.4,1.1,1.1);crate(5,15,1.4,1.1,1.1);
 barrel(-12,-4);barrel(-13,-5);barrel(13,4);barrel(14,5);
 for(let x of [-19,19])for(let i=0;i<4;i++){const b=new THREE.Mesh(new THREE.SphereGeometry(.42,12,8),mats.olive);b.scale.set(1,.55,.7);b.position.set(x+(i-1.5)*.65,.3,x<0?-2:2);scene.add(b)}
 for(let x of [-23,23])for(let z of [-12,-6,6,12]){box(x,1.2,z,.6,2.4,2.4,mats.black);for(let y of [.45,1.25,2.05])box(x+(x<0?.38:-.38),y,z,1.1,.08,2.2,mats.steel,false)}
 for(let x=-20;x<=20;x+=10)for(let z of [-12,0,12]){box(x,5.02,z,2.1,.1,.7,mats.black,false);const l=new THREE.PointLight(0xffdfb0,48,11,2);l.position.set(x,4.7,z);scene.add(l);const glow=new THREE.Mesh(new THREE.BoxGeometry(1.6,.03,.4),new THREE.MeshBasicMaterial({color:0xffe7c4}));glow.position.set(x,4.95,z);scene.add(glow)}
 for(let x=-24;x<=24;x+=4){const l=new THREE.Mesh(new THREE.BoxGeometry(.025,.008,40),new THREE.MeshBasicMaterial({color:0x95896c}));l.position.set(x,.012,0);scene.add(l)}
 // Extra interior cover creates staggered lanes instead of one long open shooting gallery.
 for(const z of [-14,14]){
  box(-10,1.15,z,5.2,2.3,.55,mats.dark);box(10,1.15,-z,5.2,2.3,.55,mats.dark);
  for(const x of [-12,-8,8,12])box(x,2.35,z,.12,.12,1.2,mats.steel,false);
 }
 // Offset chest-high barriers leave deliberate doorways between each lane.
 for(const x of [-15,-5,5,15]){
  const z=x<0?5:-5;
  box(x,0.72,z,3.8,1.44,.48,mats.steel);
  box(x+(x<0?2.4:-2.4),0.72,-z,2.4,1.44,.48,mats.dark);
 }
 // Cargo stacks, pallet piles and waist-high concrete blocks provide close-range cover.
 crate(-11,0,2.1,1.35,1.35);crate(11,0,2.1,1.35,1.35);
 crate(-3,-13,1.8,1.2,1.2);crate(3,13,1.8,1.2,1.2);
 for(const x of [-19,-7,7,19])for(const z of [-8,8]){
  box(x,.48,z,1.5,.96,1.1,mats.concrete);
  box(x,.99,z,1.35,.06,.96,mats.steel,false);
 }
 // Short divider walls create several connected rooms with offset entries.
 box(-3,1.35,-4,.35,2.7,7,concrete);box(3,1.35,4,.35,2.7,7,concrete);
 box(-12,1.35,3,5,.35,2.7,concrete);box(12,1.35,-3,5,.35,2.7,concrete);

}
function add(parent,geo,mat,pos,rot){const o=new THREE.Mesh(geo,mat);o.position.set(...pos);if(rot)o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
let weaponModels={},activeWeapon="M4";
function loadWeaponModel(url,name){
 const loader=new GLTFLoader();
 loader.load(url,gltf=>{
  const root=gltf.scene;root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const dims=[size.x,size.y,size.z],axis=dims.indexOf(Math.max(...dims));
  const length=dims[axis];if(!Number.isFinite(length)||length<.001)return;
  const normalized=new THREE.Group();normalized.add(root);root.position.sub(center);root.scale.setScalar(1.18/length);
  if(axis===0)normalized.rotation.y=Math.PI/2;
  else if(axis===1)normalized.rotation.x=Math.PI/2;
  root.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true}});
  weaponModels[name]=normalized;
  if(activeWeapon===name)showWeaponModel(name);
  console.info("Loaded weapon asset:",name);
 },undefined,e=>console.warn("Could not load "+name+" model; fallback remains active.",e));
}
function showWeaponModel(name){
 const old=weapon.getObjectByName("loaded-weapon");if(old)weapon.remove(old);
 const model=weaponModels[name];if(model){const holder=new THREE.Group();holder.name="loaded-weapon";holder.position.set(.34,-.34,-.94);holder.add(model);weapon.add(holder)}
 const fallback=weapon.getObjectByName("procedural-fallback");if(fallback)fallback.visible=!model;
 if($( "weapon-name"))$("weapon-name").textContent=name==="M4"?"M4 CARBINE":"MP5";
}
function makeWeapon(){
 weapon=new THREE.Group();weapon.frustumCulled=false;weapon.renderOrder=10;camera.add(weapon);
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
 const g=new THREE.Group(),team=p.team==="ATTACK";
 let seed=0;for(const ch of String(p.id||p.name||"unit"))seed=(seed*31+ch.charCodeAt(0))>>>0;
 const variant=seed%4,colors=team?[0x515b4a,0x59604b,0x3f5148,0x625b49]:[0x444e55,0x394852,0x50545a,0x35434a];
 const cloth=M(colors[variant]),armor=M([0x303a32,0x293238,0x343b3d,0x252e2b][variant]),skin=M(0x665747),helmet=M([0x30392f,0x242d33,0x3c423b,0x252b30][variant]),gear=M([0x171d1a,0x4b5147,0x292e32,0x5a5143][variant]);
 add(g,new THREE.CapsuleGeometry(.34,.65,5,10),cloth,[0,1.08,0]);
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
 for(let s of [-1,1]){
  add(g,new THREE.SphereGeometry(.17,12,10),gear,[s*.43,1.48,0]);
  add(g,new THREE.CapsuleGeometry(.095,.45,4,8),cloth,[s*.48,1.14,-.02],[0,0,s*.12]);
  add(g,new THREE.CapsuleGeometry(.13,.38,4,8),cloth,[s*.19,.48,0]);
  add(g,new THREE.BoxGeometry(.28,.17,.22),gear,[s*.19,.38,-.01]);
  add(g,new THREE.BoxGeometry(.26,.16,.42),M(0x191e1c),[s*.19,.12,-.05]);
 }
 add(g,new THREE.BoxGeometry(.12,.12,.9),M(0x171c1a,.45,.6),[.28,1.25,-.38]);
 return g
}
function updateRemotes(players){for(const p of players){if(p.id===myId)continue;let g=remote.get(p.id);if(!g){g=makeOperator(p);remote.set(p.id,g)}g.visible=p.alive;g.position.set(p.x,0,p.z);g.rotation.y=p.yaw}const ids=new Set(players.map(p=>p.id));for(const [id,g] of remote)if(!ids.has(id)){scene.remove(g);remote.delete(id)}}
function initThree(){scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.08,140);camera.rotation.order="YXZ";camera.position.set(12,3.4,17);scene.add(camera);renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;$("game").appendChild(renderer.domElement);clock=new THREE.Clock();buildMap();makeWeapon();weapon.visible=false;
 addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});renderer.domElement.tabIndex=0;renderer.domElement.addEventListener("click",()=>{if(inGame&&!document.pointerLockElement){renderer.domElement.focus();renderer.domElement.requestPointerLock()}});
 document.addEventListener("mousemove",e=>{if(document.pointerLockElement===renderer.domElement){yaw-=e.movementX*.0019;pitch-=e.movementY*.0019;pitch=THREE.MathUtils.clamp(pitch,-1.48,1.48);camera.rotation.set(pitch,yaw,0,"YXZ")}});
 document.addEventListener("keydown",e=>{const typing=e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement;if(inGame&&!typing&&["KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","KeyC","Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();if(!typing)keys[e.code]=true;if(e.code==="Enter"&&inGame){e.preventDefault();$("chatinput").focus()}if(e.code==="KeyR"&&inGame&&!e.repeat&&!typing)reload();if(inGame&&!typing&&!e.repeat&&e.code==="Digit1")selectWeapon("M4");if(inGame&&!typing&&!e.repeat&&e.code==="Digit2")selectWeapon("MP5");if(e.code==="KeyC"&&inGame)crouched=true});document.addEventListener("keyup",e=>{keys[e.code]=false;if(e.code==="KeyC")crouched=false});
 document.addEventListener("mousedown",e=>{if(e.button===2){aiming=true;e.preventDefault()}if(e.button===0&&inGame)shoot()});document.addEventListener("mouseup",e=>{if(e.button===2)aiming=false});document.addEventListener("contextmenu",e=>e.preventDefault());animate()}
function collides(x,z,r=.34){for(const c of colliders){const a=THREE.MathUtils.clamp(x,c.min.x,c.max.x),b=THREE.MathUtils.clamp(z,c.min.z,c.max.z);if((x-a)**2+(z-b)**2<r*r)return true}return false}
function move(dt){if(!inGame)return;const locked=document.pointerLockElement===renderer.domElement,f=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),r=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),d=new THREE.Vector3();if(keys.KeyW)d.add(f);if(keys.KeyS)d.sub(f);if(keys.KeyD)d.add(r);if(keys.KeyA)d.sub(r);if(d.lengthSq())d.normalize();const sprint=keys.ShiftLeft||keys.ShiftRight,speed=crouched?2.1:sprint?7.1:4.1;
 if(inGame){const nx=camera.position.x+d.x*speed*dt,nz=camera.position.z+d.z*speed*dt;if(!collides(nx,camera.position.z))camera.position.x=nx;if(!collides(camera.position.x,nz))camera.position.z=nz}camera.position.y=THREE.MathUtils.damp(camera.position.y,crouched?1.18:1.68,13,dt);if(d.lengthSq()&&locked)walkTime+=dt*(sprint?13:8);
 weaponKick=Math.max(0,weaponKick-dt*3.5);weapon.position.set(Math.sin(walkTime)*.008,-weaponKick*.08+Math.abs(Math.cos(walkTime*2))*.009,-weaponKick*.13);weapon.rotation.set(-weaponKick*.12,Math.sin(walkTime)*.012,Math.sin(walkTime*.5)*.012);camera.fov=THREE.MathUtils.damp(camera.fov,aiming?55:76,10,dt);camera.updateProjectionMatrix();
 if(locked&&performance.now()-lastUpdate>50){lastUpdate=performance.now();socket.emit("player-update",{x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw,pitch})}}
function updateAmmo(){const a=$("ammo-mag"),b=$("ammo-reserve");if(a)a.textContent=String(magazine).padStart(2,"0");if(b)b.textContent=String(reserveAmmo).padStart(3,"0")}
function reload(){if(!inGame||reloading||magazine===30||reserveAmmo<=0)return;reloading=true;feed("RELOADING");setTimeout(()=>{const n=Math.min(30-magazine,reserveAmmo);magazine+=n;reserveAmmo-=n;reloading=false;updateAmmo();feed("RELOAD COMPLETE")},1650)}
function shoot(){if(!inGame||phase!=="ACTION"||!document.pointerLockElement||reloading||performance.now()-lastShot<145)return;if(magazine<=0){feed("MAGAZINE EMPTY // PRESS R TO RELOAD");return}lastShot=performance.now();magazine--;updateAmmo();weaponKick=Math.min(1,weaponKick+.7);const dir=new THREE.Vector3();camera.getWorldDirection(dir);const origin=camera.position.clone(),end=origin.clone().add(dir.clone().multiplyScalar(55)),geo=new THREE.BufferGeometry().setFromPoints([origin,end]),line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffd58b,transparent:true,opacity:.8}));scene.add(line);setTimeout(()=>{scene.remove(line);geo.dispose()},65);raycaster.set(origin,dir);raycaster.far=55;const hits=raycaster.intersectObjects([...remote.values()],true);if(hits.length){let o=hits[0].object;while(o.parent&&!remoteHas(o))o=o.parent;const id=[...remote.entries()].find(([,g])=>g===o)?.[0];if(id)socket.emit("fire",{origin:origin.toArray(),direction:dir.toArray(),targetId:id})}}
function remoteHas(o){return [...remote.values()].includes(o)}
function feed(t){const d=document.createElement("div");d.className="feedline";d.textContent=t;$("feed").prepend(d);setTimeout(()=>d.remove(),2500)}
socket.on("shot-result",r=>{if(r.targetId===myId){health=r.health;$("health").textContent=health;feed("DAMAGE TAKEN")}if(r.shooterId===myId)feed(r.alive?"HIT CONFIRMED":"TARGET NEUTRALIZED")});
socket.on("player-moved",p=>{const g=remote.get(p.id);if(g){g.position.set(p.x,0,p.z);g.rotation.y=p.yaw}});socket.on("player-left",({id})=>{const g=remote.get(id);if(g){scene.remove(g);remote.delete(id)}});
socket.on("room-state",s=>{if(s.code!==roomCode)return;phase=s.phase;round=s.round;$("players").innerHTML=s.players.map(p=>'<div class="player '+(p.team==="DEFEND"?"def":"")+'">'+esc(p.name)+'<small>'+(p.team==="ATTACK"?"ASSAULT":"DEFENSE")+' · '+(p.alive?"READY":"DOWN")+'</small></div>').join("");if(s.phase!=="LOBBY"&&!inGame)startGame(s);if(inGame){$("phase").textContent=s.phase;$("round").textContent="ROUND "+String(s.round).padStart(2,"0");$("timer").textContent=String(Math.floor(s.timeLeft/60)).padStart(2,"0")+":"+String(s.timeLeft%60).padStart(2,"0");const me=s.players.find(p=>p.id===myId);if(me){health=me.health;$("health").textContent=health}updateRemotes(s.players);$("end-screen").classList.toggle("hidden",s.phase!=="END")}});
function startGame(s){inGame=true;magazine=30;reserveAmmo=150;reloading=false;updateAmmo();$("lobby").classList.add("hidden");$("hud").classList.remove("hidden");$("chatbox").classList.remove("hidden");const me=s.players.find(p=>p.id===myId);if(me){camera.position.set(me.x,1.68,me.z);yaw=me.yaw;camera.rotation.set(0,yaw,0,"YXZ")}weapon.visible=true;weapon.position.set(0,0,0);updateRemotes(s.players);$("notice").textContent="WASD MOVE · CLICK GAME TO CAPTURE MOUSE · SHIFT SPRINT · C CROUCH · RMB AIM · LMB FIRE · ENTER CHAT"}
$("reload-btn").addEventListener("click",reload);$("chatform").addEventListener("submit",e=>{e.preventDefault();const m=$("chatinput").value.trim();if(!m)return;socket.emit("chat",{code:roomCode,message:m});$("chatinput").value="";$("chatinput").blur()});socket.on("chat",m=>{const d=document.createElement("div");d.textContent=m.name+": "+m.message;$("chatlog").appendChild(d);$("chatlog").scrollTop=$("chatlog").scrollHeight});
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(!inGame){camera.position.x=12+Math.sin(performance.now()*.00012)*1.2;camera.position.y=3.1+Math.sin(performance.now()*.0002)*.12;camera.lookAt(0,1.2,0)}else move(dt);renderer.render(scene,camera)}
initThree();