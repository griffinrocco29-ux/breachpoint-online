import * as THREE from "three";
const socket=io(),$=id=>document.getElementById(id);
let roomCode="",myId="",inGame=false,scene,camera,renderer,clock,yaw=0,pitch=0,health=100,phase="LOBBY",round=1,keys={},remote=new Map(),colliders=[],weapon,weaponKick=0,walkTime=0,lastShot=0,fireHeld=false,recoilOffset=0,recoilPattern=0,aiming=false,crouched=false,lastUpdate=0,magazine=30,reserveAmmo=150,reloading=false,actionAnim="",actionStart=0,actionDuration=0,knifeGroup=null,knifeActive=false,planting=false,weaponBasePos=new THREE.Vector3(),crosshairSpread=6;
const raycaster=new THREE.Raycaster(),M=(c,r=.85,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const mats={concrete:M(0x77766e),dark:M(0x414743),steel:M(0x65706d,.35,.7),black:M(0x171c1b,.5,.6),wood:M(0x66503a),olive:M(0x4b5948),red:M(0x793d32)};
function status(t){$("menu-status").textContent=t}
socket.on("connect",()=>status("SECURE LINK ESTABLISHED // SERVER ONLINE"));socket.on("disconnect",()=>status("LINK LOST // RECONNECTING"));
function playerName(){return $("name").value.trim().slice(0,16)||"ROOKIE"}
function enterLobby(r){if(!r||!r.ok){status(r?.error||"Unable to join.");return}roomCode=r.code;myId=r.playerId;$("menu").classList.add("hidden");$("lobby").classList.remove("hidden");$("code-display").textContent=roomCode}
$("quick").onclick=()=>socket.emit("quick-join",{name:playerName()},enterLobby);
$("practice").onclick=()=>socket.emit("practice-room",{name:playerName()},enterLobby);$("range").onclick=()=>socket.emit("range-room",{name:playerName()},enterLobby);
$("create").onclick=()=>socket.emit("create-room",{name:playerName(),isPrivate:true},enterLobby);
$("join").onclick=()=>socket.emit("join-room",{name:playerName(),code:$("room-code").value},enterLobby);
$("copy-code").onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);$("copy-code").textContent="COPIED"}catch{}};
$("start").onclick=()=>socket.emit("start-match",{code:roomCode});$("back").onclick=()=>location.reload();$("continue").onclick=()=>$("end-screen").classList.add("hidden");
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function tex(base,wood=false){const c=document.createElement("canvas");c.width=c.height=512;const x=c.getContext("2d");x.fillStyle=base;x.fillRect(0,0,512,512);for(let i=0;i<8000;i++){const v=Math.random()*30;x.fillStyle="rgba(255,255,255,"+(v/900)+")";const s=Math.random()*3+1;x.fillRect(Math.random()*512,Math.random()*512,s,s)}if(wood){for(let i=0;i<50;i++){x.strokeStyle="rgba(20,12,6,.14)";x.beginPath();let y=Math.random()*512;x.moveTo(0,y);x.lineTo(512,y+(Math.random()-.5)*12);x.stroke()}}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t}
const concrete=new THREE.MeshStandardMaterial({map:tex("#77766e"),roughness:.97}),wood=new THREE.MeshStandardMaterial({map:tex("#66503a",true),roughness:.9});concrete.bumpMap=concrete.map;concrete.bumpScale=.035;wood.bumpMap=wood.map;wood.bumpScale=.045;
function box(x,y,z,w,h,d,mat,solid=true){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);if(solid){const c={min:new THREE.Vector3(x-w/2,y-h/2,z-d/2),max:new THREE.Vector3(x+w/2,y+h/2,z+d/2),object:o};colliders.push(c);o.userData.collider=c}if(mat===wood)destructibles.push(o);return o}
function cyl(x,y,z,r,h,mat){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,18),mat);o.position.set(x,y,z);o.castShadow=true;scene.add(o);return o}
function crate(x,z,w=1.7,h=1.3,d=1.4){box(x,h/2,z,w,h,d,wood);for(let y=.2;y<h;y+=.28)box(x,y,z-d/2-.02,w*.92,.035,.035,mats.steel,false)}
function barrel(x,z){cyl(x,.55,z,.38,1.1,mats.red);for(const y of [.2,.88])cyl(x,y,z,.395,.045,mats.steel)}
function buildRange(){scene.background=new THREE.Color(0x777f79);scene.fog=new THREE.FogExp2(0x777f79,.012);scene.add(new THREE.HemisphereLight(0xdce5df,0x202722,1.35));const sun=new THREE.DirectionalLight(0xffe8ca,1.7);sun.position.set(-10,22,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);box(0,-.25,0,28,.5,48,concrete,false);box(0,4.8,-23,28,.4,.5,mats.dark,false);box(-14,2.3,0,.4,4.6,48,concrete);box(14,2.3,0,.4,4.6,48,concrete);box(0,2.3,-24,28,4.6,.4,concrete);for(let z of [-20,-10,0,10]){const stripe=new THREE.Mesh(new THREE.BoxGeometry(25,.012,.035),new THREE.MeshBasicMaterial({color:0xc8dc8b}));stripe.position.set(0,.012,z);scene.add(stripe)}for(let x of [-10,-5,0,5,10]){box(x,.72,-13,.16,1.4,.16,mats.black,false);const board=new THREE.Group();board.userData.isRangeTarget=true;board.position.set(x,1.75,-13);scene.add(board);const plate=new THREE.Mesh(new THREE.PlaneGeometry(.95,1.35),new THREE.MeshStandardMaterial({color:0x9ca59a,roughness:.9,side:THREE.DoubleSide}));plate.userData.isRangeTarget=true;board.add(plate);targetMeshes.push(plate);const silhouette=new THREE.Mesh(new THREE.CircleGeometry(.24,16),new THREE.MeshBasicMaterial({color:0x333b36,side:THREE.DoubleSide}));silhouette.position.set(0,.34,.012);board.add(silhouette);const bull=new THREE.Mesh(new THREE.RingGeometry(.065,.095,24),new THREE.MeshBasicMaterial({color:0xc8dc8b,side:THREE.DoubleSide}));bull.position.set(0,.34,.02);board.add(bull)}}
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
 // Wall conduits, cable clamps, diagonal braces and worn floor marks add surface-level industrial detail.
 for(const z of [-21.35,21.35]){const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,52,12),mats.steel);pipe.rotation.z=Math.PI/2;pipe.position.set(0,4.45,z);scene.add(pipe);for(let x=-24;x<=24;x+=4){const clamp=new THREE.Mesh(new THREE.TorusGeometry(.075,.018,6,12),mats.black);clamp.rotation.y=Math.PI/2;clamp.position.set(x,4.45,z);scene.add(clamp)}}
 for(const x of [-26.9,26.9])for(let z=-18;z<=18;z+=6){const rib=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,4.9,8),mats.steel);rib.position.set(x,2.7,z);scene.add(rib)}
 const brace=(a,b,r=.055)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),mats.steel);mesh.position.copy(av.add(bv).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());scene.add(mesh)};
 for(const x of [-13,0,13]){brace([x-.8,.18,-8],[x+.8,3.2,-8]);brace([x+.8,.18,8],[x-.8,3.2,8])}
 for(const [x,z,scale] of [[-12,-4,1.2],[11,8,.9],[-4,17,.7],[18,-12,1.1]]){const scuff=new THREE.Mesh(new THREE.CircleGeometry(scale,24),new THREE.MeshBasicMaterial({color:0x343a35,transparent:true,opacity:.22,depthWrite:false}));scuff.rotation.x=-Math.PI/2;scuff.position.set(x,.018,z);scene.add(scuff)}
}
function add(parent,geo,mat,pos,rot){const o=new THREE.Mesh(geo,mat);o.position.set(...pos);if(rot)o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
let activeWeapon="VXR-9",shotgunPumpStart=0,destructibles=[],debris=[],leanValue=0,leanApplied=0,leanTarget=0,muzzleFlash=null,flashLight=null,tracers=[],targetMeshes=[],rangeMode=false,rangeHits=0,shellCasings=[],boltCycleStart=0,boltCasingPending=false;
function makeVXR9(){
 const g=new THREE.Group(),metal=M(0x202725,.34,.82),steel=M(0x68736d,.28,.78),dark=M(0x111716,.38,.78),poly=M(0x292f2b,.82,.08),rubber=M(0x141a17,.96,0),cloth=M(0x303a34,.96,0),glove=M(0x171d1a,.9,.02);
 const glass=new THREE.MeshPhysicalMaterial({color:0xa9d4d0,roughness:.025,metalness:0,transmission:.96,transparent:true,opacity:.12,thickness:.008,ior:1.48,depthWrite:false,side:THREE.DoubleSide}),red=new THREE.MeshBasicMaterial({color:0xff2638,toneMapped:false});
 const put=(geo,mat,p=[0,0,0],rot=null,parent=g)=>add(parent,geo,mat,p,rot||undefined);
 const tube=(rad,len,mat,p,n=16)=>put(new THREE.CylinderGeometry(rad,rad,len,n,1,true),mat,p,[Math.PI/2,0,0]);
 const capsule=(parent,a,b,r,mat)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A),m=new THREE.Mesh(new THREE.CapsuleGeometry(r,Math.max(.001,d.length()-2*r),4,10),mat);m.position.copy(A.add(B).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());m.castShadow=true;parent.add(m);return m};
 // Slim M4-profile receiver, built from rounded 12- and 16-sided components.
 put(new THREE.BoxGeometry(.145,.115,.66),metal,[0,.012,-.39]);
 put(new THREE.BoxGeometry(.125,.065,.48),poly,[0,-.055,-.40]);
 put(new THREE.CylinderGeometry(.071,.073,.60,8),dark,[0,.025,-.91],[Math.PI/2,0,0]);
 put(new THREE.CapsuleGeometry(.057,.22,4,12),dark,[0,-.025,-.64],[Math.PI/2,0,0]);
 put(new THREE.BoxGeometry(.105,.014,.34),steel,[0,.085,-.37]);
 put(new THREE.BoxGeometry(.009,.042,.19),dark,[.074,.035,-.36]);
 const portCover=put(new THREE.BoxGeometry(.012,.048,.205),metal,[.082,.04,-.36]);portCover.name="vxr-port-cover";
 // Slim free-float M-LOK handguard, rounded profile and recessed slots.
 put(new THREE.CylinderGeometry(.074,.074,.83,8),poly,[0,.012,-1.13],[Math.PI/2,0,0]);
 put(new THREE.CylinderGeometry(.079,.079,.035,14),metal,[0,.012,-.705],[Math.PI/2,0,0]);
 for(const side of [-1,1])for(let i=0;i<9;i++){const z=-.82-i*.075;put(new THREE.CapsuleGeometry(.009,.032,3,8),dark,[side*.071,.012,z],[Math.PI/2,0,0]);put(new THREE.CylinderGeometry(.004,.004,.014,8),steel,[side*.079,.012,z],[0,0,Math.PI/2])}
 for(let i=0;i<4;i++)put(new THREE.CylinderGeometry(.006,.006,.07,8),steel,[.071,-.045,-.9-i*.16],[0,0,Math.PI/2]);
 // Individual Picatinny teeth instead of one oversized rail block.
 put(new THREE.BoxGeometry(.075,.018,.86),dark,[0,.086,-1.12]);
 for(let i=0;i<22;i++)put(new THREE.BoxGeometry(.088,.012,.022),steel,[0,.102,-.72-i*.038]);
 // Long thin barrel, gas collars and compact multi-port muzzle.
 put(new THREE.CylinderGeometry(.022,.024,1.23,16),steel,[0,.012,-1.84],[Math.PI/2,0,0]);
 put(new THREE.CylinderGeometry(.031,.034,.095,12),metal,[0,.012,-1.48],[Math.PI/2,0,0]);
 put(new THREE.CylinderGeometry(.034,.03,.13,12),dark,[0,.012,-2.45],[Math.PI/2,0,0]);
 put(new THREE.CylinderGeometry(.028,.028,.018,12),steel,[0,.012,-2.525],[Math.PI/2,0,0]);
 for(let i=0;i<6;i++)put(new THREE.BoxGeometry(.008,.018,.028),dark,[.028*Math.cos(i*Math.PI/3),.012+.028*Math.sin(i*Math.PI/3),-2.46]);
 // Buffer tube, adjustable stock and butt pad.
 put(new THREE.CylinderGeometry(.037,.037,.52,12),steel,[0,.012,.53],[Math.PI/2,0,0]);
 put(new THREE.CapsuleGeometry(.064,.28,4,12),poly,[0,.005,.72],[Math.PI/2,0,0]);
 put(new THREE.CylinderGeometry(.074,.074,.035,12),rubber,[0,.005,.89],[Math.PI/2,0,0]);
 for(let i=0;i<5;i++)put(new THREE.TorusGeometry(.038,.003,5,12),steel,[0,.012,.35+i*.07],[Math.PI/2,0,0]);
 // Rounded pistol grip and trigger guard.
 put(new THREE.CapsuleGeometry(.046,.19,4,10),rubber,[0,-.17,-.15],[.24,0,0]);
 for(let i=0;i<4;i++)put(new THREE.TorusGeometry(.042,.003,5,12),steel,[0,-.12-i*.038,-.17],[.24,0,0]);
 const guard=new THREE.Mesh(new THREE.TorusGeometry(.068,.008,6,18,Math.PI),steel);guard.position.set(0,-.13,-.42);guard.rotation.x=Math.PI/2;g.add(guard);
 // Octagonal tapered magazine with floorplate and narrow ribs.
 const mag=new THREE.Group();mag.name="vxr-magazine";
 put(new THREE.CylinderGeometry(.047,.055,.31,8,1),poly,[0,-.29,-.52],[.12,0,0],mag);
 put(new THREE.CylinderGeometry(.051,.051,.018,8),dark,[0,-.45,-.52],[.12,0,0],mag);
 for(let i=0;i<6;i++)put(new THREE.CylinderGeometry(.003,.003,.22,6),steel,[.049*Math.cos(i*Math.PI/3),-.29,-.52+.049*Math.sin(i*Math.PI/3)],[.12,0,0],mag);
 mag.userData.basePosition=mag.position.clone();g.add(mag);
 // Slim octagonal vertical grip with fine traction rings.
 put(new THREE.CylinderGeometry(.034,.045,.19,8),rubber,[0,-.14,-1.16],[.12,0,0]);
 put(new THREE.CylinderGeometry(.049,.049,.018,8),steel,[0,-.245,-1.16]);
 for(let i=0;i<4;i++)put(new THREE.TorusGeometry(.036,.003,5,12),steel,[0,-.09-i*.035,-1.16],[Math.PI/2,0,0]);
 // Hollow tubular red-dot optic with thin rings and transparent glass. No front post in sight line.
 put(new THREE.BoxGeometry(.085,.012,.16),dark,[0,.115,-.46]);
 tube(.046,.205,dark,[0,.177,-.48],20);
 put(new THREE.TorusGeometry(.046,.006,8,24),steel,[0,.177,-.375]);
 put(new THREE.TorusGeometry(.046,.006,8,24),steel,[0,.177,-.585]);
 put(new THREE.CircleGeometry(.039,32),glass,[0,.177,-.373]);
 put(new THREE.CircleGeometry(.039,32),glass,[0,.177,-.587]);
 put(new THREE.SphereGeometry(.0025,8,8),red,[0,.177,-.586]);
 // Small rear notch only; leave the forward optic window completely clear.
 put(new THREE.CylinderGeometry(.025,.025,.035,10),metal,[0,.11,-.12]);
 put(new THREE.BoxGeometry(.035,.018,.018),steel,[0,.132,-.12]);
 put(new THREE.CylinderGeometry(.012,.012,.025,10),steel,[.077,.015,-.29],[0,0,Math.PI/2]);
 put(new THREE.SphereGeometry(.012,8,8),poly,[.093,.015,-.29]);
 // Sliding bolt group and charging handle, both driven by a shared cycle clock.
 const bolt=new THREE.Group();bolt.name="vxr-bolt";
 put(new THREE.CapsuleGeometry(.025,.22,3,10),dark,[0,0,0],[Math.PI/2,0,0],bolt);
 put(new THREE.CylinderGeometry(.014,.014,.025,8),steel,[0,0,-.11],[Math.PI/2,0,0],bolt);
 bolt.position.set(.082,.045,-.35);g.add(bolt);
 const charging=put(new THREE.CylinderGeometry(.012,.012,.095,10),steel,[.084,.045,-.35],[0,0,Math.PI/2]);charging.name="vxr-charging-handle";
 // Arms and hands use narrow capsule segments, positioned under the optic's sight line.
 const leftArm=new THREE.Group();leftArm.name="vxr-left-arm";g.add(leftArm);
 capsule(leftArm,[-.49,-.64,-1.48],[-.12,-.29,-1.12],.064,cloth);
 put(new THREE.CylinderGeometry(.068,.062,.075,12),cloth,[-.13,-.29,-1.12],[.6,0,.55],leftArm);
 put(new THREE.CapsuleGeometry(.045,.085,4,10),glove,[-.075,-.245,-1.08],[.3,0,-.2],leftArm);
 for(let i=0;i<4;i++)capsule(leftArm,[-.11+i*.022,-.26,-1.11],[-.09+i*.022,-.29,-1.02],.009,glove);
 const rightArm=new THREE.Group();rightArm.name="vxr-right-arm";g.add(rightArm);
 capsule(rightArm,[.52,-.68,.48],[.13,-.29,-.16],.067,cloth);
 put(new THREE.CylinderGeometry(.07,.064,.075,12),cloth,[.15,-.29,-.16],[.5,0,-.5],rightArm);
 put(new THREE.CapsuleGeometry(.046,.085,4,10),glove,[.085,-.23,-.2],[.2,0,.12],rightArm);
 for(let i=0;i<4;i++)capsule(rightArm,[.08+i*.022,-.25,-.23],[.09+i*.022,-.29,-.3],.009,glove);
 g.userData.mag=mag;g.userData.bolt=bolt;g.userData.charging=charging;g.userData.portCover=portCover;g.userData.leftArm=leftArm;g.userData.rightArm=rightArm;
 return g;
}
function makeBreach12(){
 const g=new THREE.Group(),metal=M(0x252b29,.38,.78),steel=M(0x737d76,.3,.72),dark=M(0x111716,.38,.78),poly=M(0x343a35,.78,.08),rubber=M(0x151a18,.95,0),cloth=M(0x303a34,.96,0),glove=M(0x171d1a,.9,.02);
 const put=(geo,mat,p=[0,0,0],rot=null,parent=g)=>add(parent,geo,mat,p,rot||undefined);
 const capsule=(parent,a,b,r,mat)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A),m=new THREE.Mesh(new THREE.CapsuleGeometry(r,Math.max(.001,d.length()-2*r),3,8),mat);m.position.copy(A.add(B).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());parent.add(m);return m};
 // BREACH-12 pump-action shotgun: compact solid receiver, barrel, magazine tube and shoulder stock.
 put(new THREE.BoxGeometry(.16,.16,.55),metal,[0,.005,-.35]);put(new THREE.BoxGeometry(.145,.075,.40),steel,[0,.095,-.39]);put(new THREE.BoxGeometry(.12,.12,.25),poly,[0,-.12,-.30]);
 put(new THREE.CylinderGeometry(.034,.034,1.18,12),steel,[0,.015,-1.22],[Math.PI/2,0,0]);put(new THREE.CylinderGeometry(.046,.046,.12,12),dark,[0,.015,-1.83],[Math.PI/2,0,0]);put(new THREE.CylinderGeometry(.027,.027,.62,10),metal,[0,-.095,-1.13],[Math.PI/2,0,0]);
 const pump=new THREE.Group();pump.name="breach-pump";put(new THREE.CylinderGeometry(.075,.075,.43,8),poly,[0,0,0],[Math.PI/2,0,0],pump);
 for(let i=0;i<7;i++)put(new THREE.BoxGeometry(.012,.085,.035),steel,[.073*Math.cos(i*Math.PI/3.5),.073*Math.sin(i*Math.PI/3.5),-.13+i*.04],null,pump);pump.position.set(0,-.015,-.98);g.add(pump);
 put(new THREE.BoxGeometry(.115,.12,.42),metal,[0,.005,.25]);put(new THREE.BoxGeometry(.15,.20,.23),poly,[0,.015,.57]);put(new THREE.BoxGeometry(.16,.24,.045),rubber,[0,.015,.70]);put(new THREE.CapsuleGeometry(.052,.20,3,8),rubber,[0,-.18,-.12],[.18,0,0]);
 put(new THREE.TorusGeometry(.07,.008,5,16,Math.PI),steel,[0,-.12,-.42],[Math.PI/2,0,0]);put(new THREE.BoxGeometry(.09,.018,.43),dark,[0,.105,-.42]);for(let i=0;i<10;i++)put(new THREE.BoxGeometry(.10,.012,.025),steel,[0,.12,-.23-i*.04]);
 const shells=new THREE.Group();shells.name="breach-shells";for(let i=0;i<6;i++){put(new THREE.CylinderGeometry(.022,.022,.075,10),M(0x8b3028,.55,.18),[0,-.10,-.82+i*.065],[Math.PI/2,0,0],shells);put(new THREE.CylinderGeometry(.023,.023,.012,10),steel,[0,-.10,-.82+i*.065-.038],[Math.PI/2,0,0],shells)}g.add(shells);
 const left=new THREE.Group();left.name="vxr-left-arm";g.add(left);capsule(left,[-.48,-.62,-1.20],[-.10,-.27,-.95],.06,cloth);put(new THREE.CapsuleGeometry(.045,.08,3,8),glove,[-.08,-.23,-.92]);
 const right=new THREE.Group();right.name="vxr-right-arm";g.add(right);capsule(right,[.50,-.65,.40],[.12,-.28,-.20],.064,cloth);put(new THREE.CapsuleGeometry(.045,.08,3,8),glove,[.08,-.23,-.23]);
 g.userData.leftArm=left;g.userData.rightArm=right;g.userData.pump=pump;g.userData.shells=shells;return g;
}
function showWeaponModel(name){
 const old=weapon.getObjectByName("loaded-weapon");if(old)weapon.remove(old);
 const model=name==="BREACH-12"?makeBreach12():makeVXR9();if(model){
  const holder=new THREE.Group();holder.name="loaded-weapon";holder.userData.hipPosition=name==="BREACH-12"?new THREE.Vector3(.17,-.22,-.60):new THREE.Vector3(.18,-.20,-.56);holder.position.copy(holder.userData.hipPosition);holder.userData.adsPosition=name==="BREACH-12"?new THREE.Vector3(0,-.16,-.48):new THREE.Vector3(0,-.155,-.43);holder.userData.inspectPosition=new THREE.Vector3(.02,-.30,-1.48);holder.userData.inspectRotation=new THREE.Euler(-.08,.38,.32);
  model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true}});
  holder.userData.mag=model.userData.mag||null;holder.userData.bolt=model.userData.bolt||null;holder.userData.charging=model.userData.charging||null;holder.userData.portCover=model.userData.portCover||null;holder.userData.leftArm=model.userData.leftArm;holder.userData.rightArm=model.userData.rightArm;holder.userData.pump=model.userData.pump||null;holder.userData.shells=model.userData.shells||null;
  holder.add(model);const spare=model.userData.mag?model.userData.mag.clone():null;if(spare){spare.name="vxr-spare-magazine";spare.visible=false;holder.add(spare)}holder.userData.spareMag=spare;weapon.add(holder);
 }
 const fallback=weapon.getObjectByName("procedural-fallback");if(fallback)fallback.visible=!model;
 if($("weapon-name"))$("weapon-name").textContent=name==="BREACH-12"?"BREACH-12 // 12 GAUGE":"VXR-9 // PROTOTYPE";
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
 showWeaponModel("VXR-9");
 muzzleFlash=new THREE.Group();muzzleFlash.position.set(.30,-.25,-2.95);muzzleFlash.visible=false;camera.add(muzzleFlash);muzzleFlash.add(new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),new THREE.MeshBasicMaterial({color:0xfff1bf})));const flashCone=new THREE.Mesh(new THREE.ConeGeometry(.09,.38,8),new THREE.MeshBasicMaterial({color:0xff9b38,transparent:true,opacity:.9,side:THREE.DoubleSide}));flashCone.rotation.x=-Math.PI/2;flashCone.position.z=-.17;muzzleFlash.add(flashCone);flashLight=new THREE.PointLight(0xffa34a,0,4,2);muzzleFlash.add(flashLight);
}
function selectWeapon(name){if(!weapon||!["VXR-9","BREACH-12"].includes(name)||activeWeapon===name)return;activeWeapon=name;weaponKick=0;reloading=false;actionAnim="";magazine=name==="BREACH-12"?6:30;reserveAmmo=name==="BREACH-12"?48:150;showWeaponModel(name);updateAmmo();feed(name+" SELECTED");}
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
 addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});const cross=$("crosshair");renderer.domElement.tabIndex=0;renderer.domElement.addEventListener("click",()=>{if(inGame&&!document.pointerLockElement){renderer.domElement.focus();renderer.domElement.requestPointerLock()}});
 document.addEventListener("mousemove",e=>{if(document.pointerLockElement===renderer.domElement){yaw-=e.movementX*.0019;pitch-=e.movementY*.0019;pitch=THREE.MathUtils.clamp(pitch,-1.48,1.48);camera.rotation.set(pitch-recoilOffset,yaw,-leanValue*.12,"YXZ")}});
 document.addEventListener("keydown",e=>{const typing=e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement;if(inGame&&!typing&&["KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","KeyC","KeyQ","KeyE","Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();if(!typing)keys[e.code]=true;if(e.code==="Enter"&&inGame){e.preventDefault();$("chatinput").focus()}if(inGame&&!typing&&!e.repeat&&e.code==="KeyQ")leanTarget=leanTarget===-1?0:-1;if(inGame&&!typing&&!e.repeat&&e.code==="KeyE")leanTarget=leanTarget===1?0:1;if(e.code==="KeyR"&&inGame&&!e.repeat&&!typing)reload();if(e.code==="KeyF"&&inGame&&!e.repeat&&!typing){planting=true;playAction("plant",1900);socket.emit("bomb-interact")}if(e.code==="KeyV"&&inGame&&!e.repeat&&!typing)melee();if(e.code==="KeyT"&&inGame&&!e.repeat&&!typing)inspectWeapon();if(inGame&&!typing&&!e.repeat&&e.code==="Digit1")selectWeapon("VXR-9");if(inGame&&!typing&&!e.repeat&&e.code==="Digit2")selectWeapon("BREACH-12");if(e.code==="Escape"&&inGame){e.preventDefault();leaveToMenu()}if(e.code==="KeyC"&&inGame)crouched=true});document.addEventListener("keyup",e=>{keys[e.code]=false;if(e.code==="KeyC")crouched=false});
 document.addEventListener("mousedown",e=>{if(e.button===2){aiming=true;e.preventDefault()}if(e.button===0&&inGame){fireHeld=true;shoot()}});document.addEventListener("mouseup",e=>{if(e.button===0)fireHeld=false;if(e.button===2)aiming=false});window.addEventListener("blur",()=>{fireHeld=false;aiming=false});document.addEventListener("contextmenu",e=>e.preventDefault());animate()}
function leaveToMenu(){if(document.pointerLockElement)document.exitPointerLock();location.reload()}
function collides(x,z,r=.34){for(const c of colliders){const a=THREE.MathUtils.clamp(x,c.min.x,c.max.x),b=THREE.MathUtils.clamp(z,c.min.z,c.max.z);if((x-a)**2+(z-b)**2<r*r)return true}return false}
function move(dt){if(!inGame)return;const locked=document.pointerLockElement===renderer.domElement,f=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),r=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),d=new THREE.Vector3();camera.position.addScaledVector(r,(leanApplied-leanValue)*.22);leanValue=THREE.MathUtils.damp(leanValue,leanTarget,12,dt);leanApplied=leanValue;if(keys.KeyW)d.add(f);if(keys.KeyS)d.sub(f);if(keys.KeyD)d.add(r);if(keys.KeyA)d.sub(r);if(d.lengthSq())d.normalize();const sprint=keys.ShiftLeft||keys.ShiftRight,speed=crouched?2.1:sprint?7.1:4.1;
 if(inGame){const nx=camera.position.x+d.x*speed*dt,nz=camera.position.z+d.z*speed*dt;if(!collides(nx,camera.position.z))camera.position.x=nx;if(!collides(camera.position.x,nz))camera.position.z=nz}camera.position.y=THREE.MathUtils.damp(camera.position.y,crouched?1.18:1.68,13,dt);camera.rotation.z=THREE.MathUtils.damp(camera.rotation.z,-leanValue*.12,12,dt);if(d.lengthSq()&&locked)walkTime+=dt*(sprint?13:8);
 if(fireHeld)shoot();weaponKick=Math.max(0,weaponKick-dt*3.5);
 const elapsed=actionAnim?performance.now()-actionStart:99999,progress=actionDuration?THREE.MathUtils.clamp(elapsed/actionDuration,0,1):1;
 if(actionAnim&&progress>=1){if(actionAnim==="plant"&&!bombPlanted)planting=false;if(actionAnim!=="reload"&&actionAnim!=="empty-reload")actionAnim=""}
 if(knifeGroup&&knifeActive){const p=THREE.MathUtils.clamp(elapsed/560,0,1),stab=Math.sin(Math.min(1,p*1.7)*Math.PI/2);knifeGroup.position.set(.48-stab*.48,-.38+stab*.17,-.72-stab*.7);knifeGroup.rotation.set(-.25-stab*.95,-.18+stab*.18,-.2-stab*.42)}
 if(knifeGroup&&!knifeActive){knifeGroup.position.lerp(knifeGroup.userData.rest.position,1-Math.exp(-18*dt));knifeGroup.rotation.x=THREE.MathUtils.damp(knifeGroup.rotation.x,knifeGroup.userData.rest.rotation.x,16,dt);knifeGroup.rotation.y=THREE.MathUtils.damp(knifeGroup.rotation.y,knifeGroup.userData.rest.rotation.y,16,dt);knifeGroup.rotation.z=THREE.MathUtils.damp(knifeGroup.rotation.z,knifeGroup.userData.rest.rotation.z,16,dt)}
 recoilOffset=THREE.MathUtils.damp(recoilOffset,0,5.2,dt);
 const reloadAction=actionAnim==="reload"||actionAnim==="empty-reload",emptyAction=actionAnim==="empty-reload";
 const reloadDip=reloadAction?Math.sin(progress*Math.PI)*.12:0,plantDip=actionAnim==="plant"?Math.sin(progress*Math.PI)*.55:0;
 weapon.position.set(Math.sin(walkTime)*.008,-weaponKick*.05+Math.abs(Math.cos(walkTime*2))*.006-reloadDip-plantDip,-weaponKick*.08);
 const crosshair=$("crosshair");if(crosshair){const targetSpread=aiming?1.5+weaponKick*2:6+weaponKick*18+(keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD?4:0);crosshairSpread=THREE.MathUtils.damp(crosshairSpread,targetSpread,10,dt);crosshair.style.setProperty("--spread",crosshairSpread+"px");crosshair.style.opacity=aiming?".42":".9"}
 weapon.rotation.set(-weaponKick*.06+(actionAnim==="plant"?progress*.65:0),Math.sin(walkTime)*.01,Math.sin(walkTime*.5)*.01+(reloadAction?Math.sin(progress*Math.PI)*.08:0));
 const viewWeapon=weapon.getObjectByName("loaded-weapon");if(viewWeapon){
  const inspecting=actionAnim==="inspect",p=progress,target=inspecting?viewWeapon.userData.inspectPosition:(aiming?viewWeapon.userData.adsPosition:viewWeapon.userData.hipPosition);
  if(target)viewWeapon.position.lerp(target,1-Math.exp((inspecting?7:12)*-dt));
  const mag=viewWeapon.userData.mag,spare=viewWeapon.userData.spareMag,left=viewWeapon.userData.leftArm,rightArm=viewWeapon.userData.rightArm;
  let inspectX=inspecting?-.08:0,inspectY=inspecting?.38:0,inspectZ=inspecting?.32:0,reloadRoll=0;
  if(reloadAction){
   const out=THREE.MathUtils.smoothstep(p,.08,.28),insert=THREE.MathUtils.smoothstep(p,.34,.62),handReach=THREE.MathUtils.smoothstep(p,.12,.38)*(1-THREE.MathUtils.smoothstep(p,.76,.94));
   if(mag){mag.visible=p<.38;mag.position.set(0,-out*.36,out*.08);mag.rotation.x=out*.2}
   if(spare){spare.visible=p>=.28&&p<.99;spare.position.set(-.12*(1-insert),-.39*(1-insert),-.5*(1-insert));spare.rotation.x=(1-insert)*.18}
   if(left){left.position.set(-.055*handReach,-.12*handReach,.18*handReach);left.rotation.set(.1*handReach,0,-.14*handReach)}
   if(emptyAction){
    reloadRoll=THREE.MathUtils.smoothstep(p,.62,.78)*(1-THREE.MathUtils.smoothstep(p,.9,.99))*.78;
    const boltPull=THREE.MathUtils.smoothstep(p,.79,.86)*(1-THREE.MathUtils.smoothstep(p,.89,.96));
    const bolt=viewWeapon.userData.bolt,handle=viewWeapon.userData.charging;
    if(bolt)bolt.position.z=-.35+boltPull*.13;if(handle)handle.position.x=.084+boltPull*.10;
    if(rightArm){rightArm.position.set(.08*boltPull,-.04*boltPull,.12*boltPull);rightArm.rotation.set(.14*boltPull,0,-.2*boltPull)}
   }
  }else{
   if(mag){mag.visible=true;mag.position.lerp(mag.userData.basePosition||new THREE.Vector3(),1-Math.exp(-18*dt));mag.rotation.x=THREE.MathUtils.damp(mag.rotation.x,0,18,dt)}
   if(spare)spare.visible=false;
   if(left){left.position.lerp(new THREE.Vector3(),1-Math.exp(-12*dt));left.rotation.x=THREE.MathUtils.damp(left.rotation.x,Math.sin(walkTime)*.018,10,dt);left.rotation.z=THREE.MathUtils.damp(left.rotation.z,0,12,dt)}
   if(rightArm){rightArm.position.lerp(new THREE.Vector3(),1-Math.exp(-12*dt));rightArm.rotation.x=THREE.MathUtils.damp(rightArm.rotation.x,Math.sin(walkTime)*.012,10,dt);rightArm.rotation.z=THREE.MathUtils.damp(rightArm.rotation.z,0,12,dt)}
  }
  viewWeapon.rotation.x=THREE.MathUtils.damp(viewWeapon.rotation.x,inspectX+(reloadAction?Math.sin(p*Math.PI)*.12:0),10,dt);
  viewWeapon.rotation.y=THREE.MathUtils.damp(viewWeapon.rotation.y,inspectY,10,dt);
  viewWeapon.rotation.z=THREE.MathUtils.damp(viewWeapon.rotation.z,inspectZ+reloadRoll,10,dt);
  viewWeapon.scale.setScalar(THREE.MathUtils.damp(viewWeapon.scale.x,inspecting?.68:aiming?.92:1,12,dt));
 }camera.position.addScaledVector(r,leanValue*.22);camera.rotation.set(pitch-recoilOffset,yaw,leanValue*.19,"YXZ");camera.fov=THREE.MathUtils.damp(camera.fov,aiming?48:76,10,dt);camera.updateProjectionMatrix();const reticle=document.getElementById("vxr-reticle");if(reticle)reticle.classList.toggle("visible",aiming&&activeWeapon==="VXR-9");if(muzzleFlash&&flashLight){muzzleFlash.position.lerp(aiming?new THREE.Vector3(0,-.28,-2.70):new THREE.Vector3(.30,-.25,-2.95),1-Math.exp(-18*dt));flashLight.intensity=THREE.MathUtils.damp(flashLight.intensity,0,28,dt);if(flashLight.intensity<.03)muzzleFlash.visible=false;}
 if(locked&&performance.now()-lastUpdate>50){lastUpdate=performance.now();socket.emit("player-update",{x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw,pitch})}}
function updateAmmo(){const a=$("ammo-mag"),b=$("ammo-reserve");if(a)a.textContent=String(magazine).padStart(2,"0");if(b)b.textContent=rangeMode?"∞":String(reserveAmmo).padStart(3,"0")}
function reload(){
 const capacity=activeWeapon==="BREACH-12"?6:30;
 if(!inGame||reloading||magazine>=capacity||(!rangeMode&&reserveAmmo<=0)||knifeActive||planting)return;
 const empty=magazine===0,duration=activeWeapon==="BREACH-12"?1900:(empty?3600:2600);boltCycleStart=0;boltCasingPending=false;reloading=true;playAction(empty?"empty-reload":"reload",duration);
 feed(empty?"EMPTY // MAGAZINE + BOLT":"RELOADING");
 setTimeout(()=>{
  const capacity=activeWeapon==="BREACH-12"?6:30,n=rangeMode?capacity-magazine:Math.min(capacity-magazine,reserveAmmo);magazine+=n;if(!rangeMode)reserveAmmo-=n;reloading=false;
  if(actionAnim==="reload"||actionAnim==="empty-reload")actionAnim="";
  const rig=weapon.getObjectByName("loaded-weapon");
  if(rig){const old=rig.userData.mag,sp=rig.userData.spareMag;
   if(old&&sp){old.visible=false;sp.visible=true;sp.name="vxr-magazine";sp.position.set(0,0,0);sp.rotation.set(0,0,0);rig.userData.mag=sp;
    const next=sp.clone();next.name="vxr-spare-magazine";next.visible=false;rig.add(next);rig.userData.spareMag=next;}
   if(rig.userData.leftArm)rig.userData.leftArm.position.set(0,0,0);
   if(rig.userData.rightArm)rig.userData.rightArm.position.set(0,0,0);
   if(rig.userData.bolt)rig.userData.bolt.position.z=-.35;
   if(rig.userData.charging)rig.userData.charging.position.z=-.35;
   if(rig.userData.portCover)rig.userData.portCover.rotation.z=0;
  }
  updateAmmo();feed("RELOAD COMPLETE");
 },duration);
}
function melee(){if(!inGame||knifeActive||reloading)return;knifeActive=true;knifeGroup.visible=true;playAction("melee",560);feed("KNIFE // QUICK STRIKE");setTimeout(()=>{knifeActive=false;knifeGroup.visible=false;if(actionAnim==="melee")actionAnim=""},560)}
function inspectWeapon(){if(!inGame||reloading||knifeActive||planting||actionAnim==="inspect")return;playAction("inspect",3600);feed(activeWeapon+" // FULL WEAPON INSPECTION")}
function ejectCasing(rig){
 const brass=M(0xc79a43,.28,.82),shell=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.045,10),brass);
 shell.rotation.set(Math.PI/2,0,0);
 const port=rig.localToWorld(new THREE.Vector3(.105,.045,-.35));shell.position.copy(port);scene.add(shell);
 const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
 shellCasings.push({mesh:shell,velocity:right.clone().multiplyScalar(1.45+Math.random()*.35).addScaledVector(up,.65+Math.random()*.25).add(new THREE.Vector3(0,.12,0)),life:2.3,spin:(Math.random()-.5)*22});
}
function shoot(){
 const shotgun=activeWeapon==="BREACH-12",interval=shotgun?760:155;
 if(!inGame||phase!=="ACTION"||!document.pointerLockElement||reloading||knifeActive||planting||actionAnim==="inspect"||performance.now()-lastShot<interval)return;
 if(magazine<=0&&!rangeMode){feed("MAGAZINE EMPTY // PRESS R TO RELOAD");return}
 lastShot=performance.now();magazine--;updateAmmo();weaponKick=Math.min(1,weaponKick+(shotgun?.72:.42));recoilPattern++;
 const spread=shotgun?(aiming?.026:.085):(aiming?.0011:.032),base=new THREE.Vector3();camera.getWorldDirection(base);
 const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),origin=camera.position.clone();
 const muzzleLocal=aiming?new THREE.Vector3(0,-.16,-2.35):new THREE.Vector3(.18,-.20,-2.42),muzzle=camera.localToWorld(muzzleLocal.clone());
 recoilOffset=Math.min(.19,recoilOffset+(aiming?.005:shotgun?.035:.02)+(recoilPattern%5===0?.006:0));yaw+=Math.sin(recoilPattern*1.7)*(aiming?.0004:shotgun?.004:.002);
 const pelletCount=shotgun?8:1;let firstImpact=origin.clone().add(base.clone().multiplyScalar(55));
 for(let pellet=0;pellet<pelletCount;pellet++){
  const dir=base.clone().addScaledVector(right,(Math.random()-.5)*spread*2).addScaledVector(up,(Math.random()-.5)*spread*2).normalize();
  raycaster.set(origin,dir);raycaster.far=55;const hits=raycaster.intersectObjects([...remote.values(),...destructibles,...targetMeshes],true);
  if(pellet===0&&hits.length)firstImpact.copy(hits[0].point);if(!hits.length)continue;
  const first=hits[0];let target=first.object;while(target&&!target.userData.isRangeTarget)target=target.parent;
  if(target){if(pellet===0){rangeHits++;target.rotation.x=-.12;feed("RANGE HIT // "+rangeHits+" CONFIRMED")}continue}
  let breakable=first.object;while(breakable&&!destructibles.includes(breakable))breakable=breakable.parent;
  if(breakable){breakProp(breakable,first.point,dir);continue}
  let o=first.object;while(o.parent&&!remoteHas(o))o=o.parent;const id=[...remote.entries()].find(([,g])=>g===o)?.[0];
  if(id)socket.emit("fire",{origin:origin.toArray(),direction:dir.toArray(),targetId:id,weapon:activeWeapon});
 }
 const geo=new THREE.BufferGeometry().setFromPoints([muzzle,firstImpact]),line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffd58b,transparent:true,opacity:.95,depthWrite:false}));scene.add(line);tracers.push({line,life:.16,maxLife:.16});
 if(shotgun){shotgunPumpStart=performance.now()}else{boltCycleStart=performance.now();boltCasingPending=true}
 if(muzzleFlash&&flashLight){muzzleFlash.position.copy(muzzleLocal);muzzleFlash.visible=true;muzzleFlash.rotation.z=Math.random()*Math.PI*2;flashLight.intensity=shotgun?5:3.8;setTimeout(()=>{if(flashLight)flashLight.intensity=0},shotgun?75:48)}
}
function breakProp(obj,point,direction){const idx=destructibles.indexOf(obj);if(idx<0)return;destructibles.splice(idx,1);scene.remove(obj);obj.geometry.dispose();const c=obj.userData.collider;if(c){const ci=colliders.indexOf(c);if(ci>=0)colliders.splice(ci,1)}for(let i=0;i<9;i++){const shard=new THREE.Mesh(new THREE.DodecahedronGeometry(.09+Math.random()*.15,0),wood);shard.position.copy(point).add(new THREE.Vector3((Math.random()-.5)*.7,(Math.random()-.5)*.5,(Math.random()-.5)*.7));shard.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);shard.castShadow=true;scene.add(shard);debris.push({mesh:shard,velocity:new THREE.Vector3((Math.random()-.5)*3+direction.x*.8,1+Math.random()*3,(Math.random()-.5)*3+direction.z*.8),life:5})}feed("COVER DESTROYED");}
function remoteHas(o){return [...remote.values()].includes(o)}
function feed(t){const d=document.createElement("div");d.className="feedline";d.textContent=t;$("feed").prepend(d);setTimeout(()=>d.remove(),2500)}
socket.on("bomb-event",b=>{bombPlanted=b.status==="PLANTED";if(b.status==="PLANTED"){planting=false;playAction("plant-finish",500);feed("DEVICE ARMED // SITE A")}if(b.status==="DEFUSED"||b.status==="DETONATED")planting=false;const el=$("bomb-status");if(!el)return;el.textContent=b.status==="PLANTED"?"BOMB PLANTED // DEFUSE SITE A":b.status==="DEFUSED"?"BOMB DEFUSED // SITE SECURE":b.status==="DETONATED"?"BOMB DETONATED // ROUND LOST":"OBJECTIVE // SITE A"});
socket.on("shot-result",r=>{if(r.targetId===myId){health=r.health;$("health").textContent=health;feed("DAMAGE TAKEN")}const hit=remote.get(r.targetId);if(hit){hit.userData.hitUntil=performance.now()+220;if(!r.alive)hit.userData.dead=true}if(r.shooterId===myId)feed(r.alive?"HIT CONFIRMED":"TARGET NEUTRALIZED")});
socket.on("player-moved",p=>{const g=remote.get(p.id);if(g){g.position.set(p.x,0,p.z);g.rotation.y=p.yaw}});socket.on("player-left",({id})=>{const g=remote.get(id);if(g){scene.remove(g);remote.delete(id)}});
socket.on("room-state",s=>{if(s.code!==roomCode)return;phase=s.phase;round=s.round;$("players").innerHTML=s.players.map(p=>'<div class="player '+(p.team==="DEFEND"?"def":"")+'">'+esc(p.name)+'<small>'+(p.team==="ATTACK"?"ASSAULT":"DEFENSE")+' · '+(p.alive?"READY":"DOWN")+'</small></div>').join("");if(s.phase!=="LOBBY"&&!inGame)startGame(s);if(inGame){if(s.bomb){bombPlanted=!!s.bomb.planted;if($("bomb-status"))$("bomb-status").textContent=s.bomb.planted?"BOMB PLANTED // "+s.bomb.time+"s REMAINING":s.bomb.defused?"BOMB DEFUSED // SITE SECURE":"OBJECTIVE // ATTACKERS PLANT AT SITE A"}$("phase").textContent=s.phase;$("round").textContent="ROUND "+String(s.round).padStart(2,"0");$("timer").textContent=String(Math.floor(s.timeLeft/60)).padStart(2,"0")+":"+String(s.timeLeft%60).padStart(2,"0");const me=s.players.find(p=>p.id===myId);if(me){health=me.health;$("health").textContent=health}updateRemotes(s.players);$("end-screen").classList.toggle("hidden",s.phase!=="END")}});
function startGame(s){inGame=true;leanValue=0;leanApplied=0;magazine=30;reserveAmmo=150;reloading=false;updateAmmo();const wantsRange=s.mode==="RANGE";if(wantsRange!==rangeMode){rangeMode=wantsRange;rangeHits=0;for(const o of [...scene.children])if(o!==camera)scene.remove(o);colliders=[];destructibles=[];targetMeshes=[];tracers=[];if(rangeMode)buildRange();else buildMap();makeDefuser()}updateAmmo();$("lobby").classList.add("hidden");$("hud").classList.remove("hidden");$("chatbox").classList.remove("hidden");$("bomb-btn").style.display=rangeMode?"none":"";$("bomb-status").style.display=rangeMode?"none":"";if($("phase"))$("phase").textContent=rangeMode?"LIVE FIRE // RANGE":"PREPARATION";if($("notice"))$("notice").textContent=rangeMode?"WASD MOVE · Z/X LEAN · RMB AIM · LMB FIRE · T INSPECT · R RELOAD":"WASD MOVE · SHIFT SPRINT · C CROUCH · Z/X LEAN · RMB AIM · LMB FIRE · T INSPECT · F PLANT / DEFUSE · R RELOAD · V MELEE";const me=s.players.find(p=>p.id===myId);if(me){camera.position.set(me.x,1.68,me.z);yaw=me.yaw;camera.rotation.set(0,yaw,0,"YXZ")}weapon.visible=true;weapon.position.set(0,0,0);updateRemotes(s.players);$("notice").textContent="WASD MOVE · SHIFT SPRINT · C CROUCH · Z/X LEAN · RMB AIM · LMB FIRE · 1 RIFLE · 2 SHOTGUN · T INSPECT · F PLANT / DEFUSE · R RELOAD · V MELEE · ESC MENU"}
$("reload-btn").addEventListener("click",reload);$("bomb-btn").addEventListener("click",()=>socket.emit("bomb-interact"));$("chatform").addEventListener("submit",e=>{e.preventDefault();const m=$("chatinput").value.trim();if(!m)return;socket.emit("chat",{code:roomCode,message:m});$("chatinput").value="";$("chatinput").blur()});socket.on("chat",m=>{const d=document.createElement("div");d.textContent=m.name+": "+m.message;$("chatlog").appendChild(d);$("chatlog").scrollTop=$("chatlog").scrollHeight});
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);bombAnim+=dt;
 for(let i=tracers.length-1;i>=0;i--){const t=tracers[i];t.life-=dt;t.line.material.opacity=Math.max(0,t.life/t.maxLife);if(t.life<=0){scene.remove(t.line);t.line.geometry.dispose();t.line.material.dispose();tracers.splice(i,1)}}
 const rifle=weapon&&weapon.getObjectByName("loaded-weapon");
 if(rifle&&rifle.userData.shells)rifle.userData.shells.children.forEach((o,i)=>o.visible=Math.floor(i/2)<magazine);
 if(rifle&&rifle.userData.pump){const age=shotgunPumpStart?performance.now()-shotgunPumpStart:99999,p=age<90?THREE.MathUtils.clamp(age/90,0,1):age<260?1-THREE.MathUtils.clamp((age-90)/170,0,1):0;rifle.userData.pump.position.z=-.98+p*.18;if(age>270)shotgunPumpStart=0}
 if(rifle&&boltCycleStart){const age=performance.now()-boltCycleStart,back=THREE.MathUtils.clamp(age/42,0,1),forward=age<42?0:THREE.MathUtils.clamp((age-42)/92,0,1),kick=age<42?back*back*(3-2*back):(1-forward)*(1-forward)*(3-2*(1-forward));
  const bolt=rifle.userData.bolt,handle=rifle.userData.charging,cover=rifle.userData.portCover;
  if(bolt)bolt.position.z=-.35+kick*.115;if(handle)handle.position.x=.084+kick*.09;
  if(cover)cover.rotation.z=-kick*.55;
  if(age>=36&&boltCasingPending){ejectCasing(rifle);boltCasingPending=false}
  if(age>160){boltCycleStart=0;if(cover)cover.rotation.z=0}
 }
 for(let i=shellCasings.length-1;i>=0;i--){const s=shellCasings[i];s.life-=dt;s.velocity.y-=9.8*dt;s.mesh.position.addScaledVector(s.velocity,dt);s.mesh.rotation.x+=s.spin*dt;s.mesh.rotation.z+=s.spin*.7*dt;if(s.mesh.position.y<.035){s.mesh.position.y=.035;s.velocity.y=Math.abs(s.velocity.y)*.24;s.velocity.x*=.68;s.velocity.z*=.68}if(s.life<=0){scene.remove(s.mesh);s.mesh.geometry.dispose();s.mesh.material.dispose();shellCasings.splice(i,1)}}
 for(let i=debris.length-1;i>=0;i--){const d=debris[i];d.life-=dt;d.velocity.y-=9.8*dt;d.mesh.position.addScaledVector(d.velocity,dt);d.mesh.rotation.x+=d.velocity.z*dt;d.mesh.rotation.z-=d.velocity.x*dt;if(d.mesh.position.y<.08){d.mesh.position.y=.08;d.velocity.y=Math.abs(d.velocity.y)*.22;d.velocity.x*=.72;d.velocity.z*=.72}if(d.life<=0){scene.remove(d.mesh);d.mesh.geometry.dispose();debris.splice(i,1)}}
 if(defuserDevice){defuserDevice.visible=bombPlanted;defuserDevice.rotation.y=Math.sin(bombAnim*1.5)*.045;defuserDevice.position.y=1.84+Math.sin(bombAnim*2.4)*.025;if(defuserLight){defuserLight.intensity=bombPlanted?(Math.sin(bombAnim*7)>0?3.2:.25):0;defuserLight.color.setHex(Math.sin(bombAnim*7)>0?0x4cff85:0xffb34c)}}
 for(const g of remote.values()){const moving=g.userData.moving,t=bombAnim*(moving?9:1.4)+(g.userData.phase||0),flinch=(g.userData.hitUntil||0)>performance.now()?Math.sin((g.userData.hitUntil-performance.now())/220*Math.PI)*.22:0;for(const limb of g.userData.limbs||[]){const swing=moving?Math.sin(t+(limb.side<0?Math.PI:0))*(limb.kind==="leg"?.58:.38):Math.sin(t)*.025;limb.node.rotation.x=(limb.kind==="leg"?swing:-swing*.75)+(limb.kind==="arm"?flinch:0)}if(g.userData.torso){g.userData.torso.position.y=1.08+(moving?Math.abs(Math.sin(t*2))*.035:Math.sin(t)*.012);g.userData.torso.rotation.z=flinch*.45}if(g.userData.dead){g.rotation.z=THREE.MathUtils.damp(g.rotation.z,.9,5,.016);g.position.y=THREE.MathUtils.damp(g.position.y,-.85,5,.016)}}
 if(!inGame){camera.position.x=12+Math.sin(performance.now()*.00012)*1.2;camera.position.y=3.1+Math.sin(performance.now()*.0002)*.12;camera.lookAt(0,1.2,0)}else move(dt);renderer.render(scene,camera)}
initThree();