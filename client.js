import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

const socket = io();
const $ = id => document.getElementById(id);
let roomCode = "", myId = "", isOwner = false, inGame = false;
let scene, camera, renderer, clock, yaw = 0, pitch = 0;
let velocity = new THREE.Vector3(), keys = {}, remote = new Map(), world = [];
let health = 100, phase = "LOBBY", round = 1, timeLeft = 180, lastUpdate = 0;
const raycaster = new THREE.Raycaster();
const playerHeight = 1.7;
const mat = (color, roughness=.9) => new THREE.MeshStandardMaterial({color, roughness});
const mats = {
  wall: mat(0x59615c), dark: mat(0x242c2b), floor: mat(0x343a36),
  metal: mat(0x6e7770), wood: mat(0x8a5b35), lime: mat(0xc8f169),
  red: mat(0xa94d38), glass: new THREE.MeshStandardMaterial({color:0x87a4a0,transparent:true,opacity:.25})
};

function setStatus(s){ $("menu-status").textContent = s; }
socket.on("connect", () => setStatus("CONNECTED // MULTIPLAYER SERVER READY"));
socket.on("disconnect", () => setStatus("CONNECTION LOST // RECONNECTING..."));

function enterLobby(result) {
  if (!result.ok) { setStatus(result.error || "Could not join."); return; }
  roomCode = result.code; myId = result.playerId; isOwner = true;
  $("menu").classList.add("hidden"); $("lobby").classList.remove("hidden");
  $("code-display").textContent = roomCode;
}
function playerName(){ return $("name").value.trim() || "Rookie"; }
$("quick").onclick = () => socket.emit("quick-join",{name:playerName()},res=>{isOwner=false;enterLobby(res);});
$("create").onclick = () => socket.emit("create-room",{name:playerName(),isPrivate:true},enterLobby);
$("join").onclick = () => socket.emit("join-room",{name:playerName(),code:$("room-code").value},res=>{isOwner=false;enterLobby(res);});
$("copy-code").onclick = async () => { try { await navigator.clipboard.writeText(roomCode); $("copy-code").textContent="COPIED"; } catch {} };
$("start").onclick = () => socket.emit("start-match",{code:roomCode});
$("back").onclick = () => location.reload();
$("continue").onclick = () => $("end-screen").classList.add("hidden");

socket.on("room-state", state => {
  if (state.code !== roomCode) return;
  phase=state.phase; round=state.round; timeLeft=state.timeLeft;
  $("players").innerHTML = state.players.map(p =>
    `<div class="player ${p.team==="DEFEND"?"def":""}">${escapeHtml(p.name)}<small>${p.team==="ATTACK"?"ATTACKER":"DEFENDER"} · ${p.alive?"READY":"DOWN"}</small></div>`
  ).join("");
  if (state.phase !== "LOBBY" && !inGame) startGame(state);
  if (inGame) {
    $("phase").textContent = state.phase;
    $("round").textContent = `ROUND ${String(state.round).padStart(2,"0")}`;
    $("timer").textContent = `${String(Math.floor(state.timeLeft/60)).padStart(2,"0")}:${String(state.timeLeft%60).padStart(2,"0")}`;
    const me=state.players.find(p=>p.id===myId);
    if(me){health=me.health;$("health").textContent=health;}
    updateRemoteFromState(state.players);
    if(state.phase==="END") $("end-screen").classList.remove("hidden");
    else $("end-screen").classList.add("hidden");
  }
});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

function addBox(x,y,z,w,h,d,material, opts={}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true;
  mesh.userData = { destructible: !!opts.destructible, solid: opts.solid!==false, kind:opts.kind||"wall" };
  scene.add(mesh); world.push(mesh); return mesh;
}
function buildMap(){
  scene.background = new THREE.Color(0x9aa49c);
  scene.fog = new THREE.Fog(0x9aa49c,30,75);
  const hemi=new THREE.HemisphereLight(0xcbd7d0,0x303a35,2.0);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffe7c7,2.4);sun.position.set(-12,24,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
  addBox(0,-.25,0,48,.5,36,mats.floor);
  // Perimeter and interior tactical rooms.
  addBox(0,2,-18,48,4,.5,mats.wall);addBox(0,2,18,48,4,.5,mats.wall);
  addBox(-24,2,0,.5,4,36,mats.wall);addBox(24,2,0,.5,4,36,mats.wall);
  addBox(-7,2,-7,.35,4,12,mats.wall);addBox(7,2,7,.35,4,12,mats.wall);
  addBox(0,2,7,14,4,.35,mats.wall,{destructible:true});
  addBox(0,2,-7,14,4,.35,mats.wall,{destructible:true});
  addBox(-15,1.5,0,5,3,.4,mats.wall,{destructible:true});
  addBox(15,1.5,0,5,3,.4,mats.wall,{destructible:true});
  // Reinforced-looking central objective and cover.
  addBox(0,1,-1,2.8,2,.8,mats.dark);
  addBox(-4,.65,2,2.5,1.3,1.2,mats.metal);
  addBox(4,.65,-2,2.5,1.3,1.2,mats.metal);
  addBox(-12,.8,-10,3,1.6,1.4,mats.wood,{destructible:true});
  addBox(12,.8,10,3,1.6,1.4,mats.wood,{destructible:true});
  for(let i=0;i<7;i++){
    addBox(-19+i*6,.12,-13,1.4,.24,1.4,mats.dark);
    addBox(-19+i*6,.12,13,1.4,.24,1.4,mats.dark);
  }
  // Ceiling beams and overhead practical lights.
  for(let x=-18;x<=18;x+=6){
    addBox(x,3.85,0,.12,.12,35,mats.dark);
    const light=new THREE.PointLight(0xffe3b0,45,12);light.position.set(x,3.5,0);scene.add(light);
  }
  // Exterior training range silhouettes.
  for(let i=0;i<8;i++){
    const pillar=addBox(-20+i*5,1.2,-21,1.1,2.4,.7,mats.dark);
    pillar.userData.solid=false;
  }
}
function startGame(state){
  inGame=true; $("lobby").classList.add("hidden"); $("hud").classList.remove("hidden"); $("chatbox").classList.remove("hidden");
  $("phase").textContent=state.phase;
  initThree();
  const me=state.players.find(p=>p.id===myId);
  if(me){camera.position.set(me.x,playerHeight,me.z);yaw=me.yaw;}
  $("notice").textContent="WASD MOVE · SHIFT SPRINT · C CROUCH · CLICK FIRE · ENTER CHAT · ESC RELEASE MOUSE";
  animate();
}
function initThree(){
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(78,innerWidth/innerHeight,.1,120);
  camera.position.set(-12,playerHeight,0);camera.rotation.order="YXZ";
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  $("game").appendChild(renderer.domElement);
  clock=new THREE.Clock();buildMap();makeWeapon();
  addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  renderer.domElement.addEventListener("click",()=>{if(!document.pointerLockElement)renderer.domElement.requestPointerLock();else shoot();});
  document.addEventListener("mousemove",e=>{if(document.pointerLockElement===renderer.domElement){yaw-=e.movementX*.0022;pitch-=e.movementY*.0022;pitch=Math.max(-1.45,Math.min(1.45,pitch));camera.rotation.set(pitch,yaw,0,"YXZ");}});
  document.addEventListener("keydown",e=>{keys[e.code]=true;if(e.code==="Enter"){$("chatinput").focus();}});
  document.addEventListener("keyup",e=>keys[e.code]=false);
  document.addEventListener("mousedown",e=>{if(e.button===2)e.preventDefault();});
  document.addEventListener("contextmenu",e=>e.preventDefault());
}
function makeWeapon(){
  const group=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,.65),mat(0x202725));body.position.set(.32,-.28,-.55);group.add(body);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.42,10),mat(0x111615));barrel.rotation.x=Math.PI/2;barrel.position.set(.32,-.24,-.99);group.add(barrel);
  const sight=new THREE.Mesh(new THREE.BoxGeometry(.07,.07,.1),mats.lime);sight.position.set(.32,-.17,-.56);group.add(sight);
  camera.add(group);scene.add(camera);
}
function makeRemote(p){
  const group=new THREE.Group();
  const suit=mat(p.team==="ATTACK"?0x8b9a85:0x4b5961);
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.36,.8,4,8),suit);body.position.y=1.05;group.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.23,12,10),mat(0x9b8069));head.position.y=1.78;group.add(head);
  const visor=new THREE.Mesh(new THREE.BoxGeometry(.32,.08,.12),mat(0x172022));visor.position.set(0,1.8,.19);group.add(visor);
  const gun=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.8),mat(0x171d1c));gun.position.set(.3,1.2,.35);group.add(gun);
  scene.add(group);return group;
}
function updateRemoteFromState(players){
  for(const p of players){
    if(p.id===myId)continue;
    let obj=remote.get(p.id);
    if(!obj){obj=makeRemote(p);remote.set(p.id,obj);}
    obj.visible=p.alive;obj.position.set(p.x,0,p.z);obj.rotation.y=p.yaw;
    obj.userData.team=p.team;
  }
  const ids=new Set(players.map(p=>p.id));
  for(const [id,obj] of remote)if(!ids.has(id)){scene.remove(obj);remote.delete(id);}
}
socket.on("player-moved",p=>{
  const obj=remote.get(p.id);if(obj){obj.position.set(p.x,0,p.z);obj.rotation.y=p.yaw;}
});
socket.on("player-left",({id})=>{const obj=remote.get(id);if(obj){scene.remove(obj);remote.delete(id);}});
function move(dt){
  if(!document.pointerLockElement)return;
  const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  let dir=new THREE.Vector3();
  if(keys.KeyW)dir.add(forward);if(keys.KeyS)dir.sub(forward);
  if(keys.KeyD)dir.add(right);if(keys.KeyA)dir.sub(right);
  if(dir.lengthSq())dir.normalize();
  const speed=keys.ShiftLeft?8:keys.KeyC?2.1:4.8;
  camera.position.addScaledVector(dir,speed*dt);
  camera.position.x=Math.max(-22,Math.min(22,camera.position.x));
  camera.position.z=Math.max(-16,Math.min(16,camera.position.z));
  camera.position.y=keys.KeyC?1.15:playerHeight;
  camera.rotation.set(pitch,yaw,0,"YXZ");
  const now=performance.now();
  if(now-lastUpdate>50){
    lastUpdate=now;
    socket.emit("player-update",{x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw,pitch});
  }
}
function shoot(){
  if(!inGame||!document.pointerLockElement||phase!=="ACTION")return;
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const targets=[...remote.values()];
  const hits=raycaster.intersectObjects(targets,true);
  if(!hits.length)return;
  let obj=hits[0].object;
  while(obj.parent&&!remoteHas(obj))obj=obj.parent;
  const id=[...remote.entries()].find(([,v])=>v===obj)?.[0];
  if(id)socket.emit("fire",{targetId:id});
}
function remoteHas(obj){return [...remote.values()].includes(obj);}
socket.on("shot-result",r=>{
  if(r.targetId===myId){health=r.health;$("health").textContent=health;feed("YOU WERE HIT");}
  if(r.shooterId===myId)feed(r.alive?"HIT CONFIRMED":"TARGET ELIMINATED");
});
function feed(s){const d=document.createElement("div");d.className="feedline";d.textContent=s;$("feed").prepend(d);setTimeout(()=>d.remove(),2600);}
function animate(){
  if(!inGame)return;
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.04);move(dt);
  renderer.render(scene,camera);
}
$("chatform").addEventListener("submit",e=>{
  e.preventDefault();const message=$("chatinput").value.trim();if(!message)return;
  socket.emit("chat",{code:roomCode,message});$("chatinput").value="";$("chatinput").blur();
});
socket.on("chat",m=>{const d=document.createElement("div");d.textContent=`${m.name}: ${m.message}`;$("chatlog").appendChild(d);$("chatlog").scrollTop=$("chatlog").scrollHeight;});
