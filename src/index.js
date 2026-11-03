import {poseDoor, doorSnapshot} from './door-state.mjs';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {PLAN_SCHEMA, visibleMesh, decodePlan, pushHistory} from './edit-state.mjs';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {roomDimensions} from './bedroom-dimensions.mjs';
import {createBedroomOverlay} from './bedroom-overlay.mjs';
import {defaultDesks,decodeDesks,deskLayout,overlapRect,DESK_IDS} from './desk-plan.mjs';
import {createDeskMeshes} from './desk-geometry.mjs';

const data=window.HOME_DATA, $=id=>document.getElementById(id), rooms=data.layout.rooms;
const dimensions=roomDimensions(rooms,data.spec.parameter_metadata), bedrooms=dimensions.filter(r=>['small','main'].includes(r.id)), bedroomById=new Map(dimensions.map(b=>[b.id,b]));
const names={overall_inner_width:'统一开间',kitchen_width:'厨房净宽',kitchen_depth:'厨房纵深',living_depth:'小厅纵深',bathroom_width:'卫生间长边',bathroom_depth:'卫生间短边',small_bedroom_width:'小卧室宽',small_bedroom_depth:'小卧室深',main_bedroom_depth:'阳台卧室纵深',balcony_depth:'阳台进深',room_height:'主空间净高',entry_height:'入户净高',kitchen_height:'厨房吊顶净高',bathroom_height:'卫生间吊顶净高',small_bay_width:'小卧室飘窗宽',small_door_offset:'次卧门距前墙角',small_door_width:'次卧门扇宽',front_door_width:'入户门扇宽',main_door_width:'主卧门扇宽',kitchen_door_width:'厨房门扇宽',bathroom_door_width:'卫生间门扇宽',kitchen_box_width:'厨房凸墙宽',kitchen_box_depth:'厨房凸墙深'};
$('parameters').innerHTML=Object.entries(names).map(([k,n])=>{const m=data.spec.parameter_metadata[k];return `<tr><td>${n}</td><td>${m.value_m.toFixed(3)}</td><td>${m.basis}</td></tr>`;}).join('');
$('userMeasurements').innerHTML=(data.spec.user_measurements||[]).map(m=>`<tr><td>${m.item}</td><td>${m.value_cm} cm</td><td>屋主确认</td></tr>`).join('');
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(a=>a.classList.toggle('active',a===b));document.querySelectorAll('.tabPage').forEach(p=>p.hidden=p.id!==b.dataset.tab);});
$('maxView').onclick=()=>{const expanded=document.querySelector('main').classList.toggle('maximized');$('maxView').textContent=expanded?'返回面板':'放大模型';$('maxView').setAttribute('aria-pressed',expanded);};
$('help').onclick=()=>{$('helpDialog').showModal();};$('closeHelp').onclick=()=>{$('helpDialog').close();};

const to3=([x,y,z])=>new THREE.Vector3(x,z,-y);
const viewport=$('viewport'), scene=new THREE.Scene();scene.background=new THREE.Color('#e8edea');
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});}catch(err){$('loading').innerHTML='此浏览器未能创建三维画布。请启用硬件加速，或用支持 WebGL 的浏览器打开。';$('status').textContent='静态查看模式 · 三维画布不可用';throw err;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
viewport.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','福州新家可旋转三维模型');
const camera=new THREE.PerspectiveCamera(42,1,.03,200);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.maxDistance=35;controls.minDistance=.18;controls.maxPolarAngle=Math.PI*.91;
const env=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(env,.05).texture;env.dispose();pmrem.dispose();
scene.environmentIntensity=.7;scene.add(new THREE.HemisphereLight(0xffffff,0x92988d,1.2));
const sun=new THREE.DirectionalLight(0xfff6e7,2.5);sun.position.set(4,10,2);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=9;sun.shadow.camera.bottom=-9;sun.shadow.camera.far=40;sun.shadow.normalBias=.015;sun.target.position.set(1.6,0,-6.4);scene.add(sun.target);scene.add(sun);
const fill=new THREE.DirectionalLight(0xe4f1ff,1);fill.position.set(-5,6,-8);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0xe2e8e4,roughness:1}));ground.receiveShadow=true;ground.rotation.x=-Math.PI/2;ground.position.set(1.6,-.19,-6.4);scene.add(ground);
const grid=new THREE.GridHelper(30,30,0xb3c0b8,0xd1dad3);grid.position.set(1.6,-.185,-6.4);scene.add(grid);grid.visible=false;
let model, meshes=[], mode='cut', furniture=true, labels=true, selectedId=null;
let measureMode=false, measurePoints=[], tween=null, nav='orbit';
const assets=new Map(), deleted=new Set(), history=[];
let deskConfig=defaultDesks();
const storageKey='fuzhou-home-public-v05-edits';
const doors=new Map(); let selectedDoor=null, sliderEditing=false;
const rulerGroup=new THREE.Group();scene.add(rulerGroup);
const keys=new Set(), walking=new Set();
let flyYaw=0, flyPitch=0, flyPointer=null, lastFrame=0, down=null;
const ray=new THREE.Raycaster(), mouse=new THREE.Vector2();
const bedroomOverlay=createBedroomOverlay(dimensions);scene.add(bedroomOverlay.root);
let dimensionScope=null,lastDimensionId='small';
function setDimensionScope(scope){
 dimensionScope=scope;
 $('bedroomDimensions').classList.toggle('active',!!scope);$('bedroomDimensions').setAttribute('aria-pressed',!!scope);
 $('bedroomQuick').value=bedroomById.has(scope)?scope:'';
 document.querySelectorAll('.bedroomCard').forEach(card=>card.classList.toggle('chosen',card.dataset.bedroomCard===scope));
}
function heightText(b){return Number.isFinite(b.height)?`模型净高 ≈ ${b.height.toFixed(2)} m`:'净高未确认';}
function doorText(b){return Number.isFinite(b.doorWidth)?`门扇宽 ${(b.doorWidth*100).toFixed(1)} cm · ${b.doorConfirmed?'屋主确认':'待复核'}`:'';}
function bedroomInfo(b){return `<b>${b.name}</b><p>宽约 <strong>${b.width.toFixed(2)} m</strong>（横向）<br>深约 <strong>${b.depth.toFixed(2)} m</strong>（入户端 ↔ 阳台端）<br>${heightText(b)} · 矩形范围约 ${b.area.toFixed(2)} m²</p><p>空间尺寸为建模参考，待复核。${b.note}</p>${doorText(b)?`<p>${doorText(b)}</p>`:''}`;}
function focusBedroom(id,flat=false){
 const b=bedroomById.get(id);if(!b)return;
 clearSelection();resetLens();setNav('orbit');mode='cut';syncMode();setDimensionScope(id);setActiveRoom(id);lastDimensionId=id;
 $('cameraMap').hidden=true;$('mapToggle').setAttribute('aria-expanded','false');
 const [x0,x1,y0,y1]=b.rect,cx=(x0+x1)/2,cy=(y0+y1)/2;
 // Include dimension extensions and adapt framing to narrow mobile viewports.
 const range=Math.max(4.4,(b.width+1.5)/Math.max(.55,camera.aspect),b.depth+1.9);
 const target=to3([cx-.12,cy-.12,.15]);
 move(flat?target.clone().add(new THREE.Vector3(0,range*1.65,.001)):target.clone().add(new THREE.Vector3(range*.5,range*1.25,range*.65)),target);
 $('roomInfo').innerHTML=bedroomInfo(b);
 $('selectedName').textContent=`${b.name} · 宽 ≈ ${b.width.toFixed(2)} m × 深 ≈ ${b.depth.toFixed(2)} m · 参考值`;
}
function compareBedrooms(){
 clearSelection();resetLens();setNav('orbit');mode='cut';syncMode();setDimensionScope('all');setActiveRoom('');
 const x0=Math.min(...bedrooms.map(b=>b.rect[0])),x1=Math.max(...bedrooms.map(b=>b.rect[1]));
 const y0=Math.min(...bedrooms.map(b=>b.rect[2])),y1=Math.max(...bedrooms.map(b=>b.rect[3]));
 const target=to3([(x0+x1)/2-.1,(y0+y1)/2-.1,.1]);
 const height=Math.max((x1-x0+1.8)/Math.max(.55,camera.aspect),y1-y0+2)*1.55;
 move(target.clone().add(new THREE.Vector3(0,height,.001)),target);
 $('roomInfo').innerHTML='<b>两间卧室 / 尺寸对照</b><p>绿色为小卧室，棕色为阳台卧室。宽 = 窗侧到走道侧；深 = 入户端到阳台端。所有房间尺寸仍为模型参考值。</p>';
 $('selectedName').textContent='两间卧室尺寸对照 · 不含飘窗 / 阳台 · 参考值，待复核';
}
for(const b of [...dimensions].sort((a,b)=>['living','balcony','small','main','kitchen','bath','entry','corridor'].indexOf(a.id)-['living','balcony','small','main','kitchen','bath','entry','corridor'].indexOf(b.id))){
 const card=document.createElement('article');card.className='bedroomCard';card.dataset.bedroomCard=b.id;card.style.setProperty('--bedroom-color',b.color);
 card.innerHTML=`<div class="bedroomCardTitle"><b>${b.name}</b><span>参考 · 待复核</span></div><div class="bedroomNumbers"><span>宽 <strong>${b.width.toFixed(2)}</strong> m</span><span>深 <strong>${b.depth.toFixed(2)}</strong> m</span></div><p>${heightText(b)} · 矩形范围 ≈ ${b.area.toFixed(2)} m²</p><p>${b.note}</p>${doorText(b)?`<p>${doorText(b)}</p>`:''}<div class="row"><button data-bedroom="${b.id}" aria-label="定位${b.name}">定位到 3D ↗</button><button data-bedroom-top="${b.id}" aria-label="俯视${b.name}尺寸">俯视尺寸</button></div>`;
 $('bedroomCards').appendChild(card);
 for(const select of [$('dimensionRoom'),$('bedroomQuick')]){const option=document.createElement('option');option.value=b.id;option.textContent=b.name;select.appendChild(option);}
}
$('dimensionRoom').onchange=e=>{const id=e.target.value;document.querySelectorAll('.bedroomCard').forEach(c=>c.hidden=!!id&&c.dataset.bedroomCard!==id);if(id)focusBedroom(id);};
$('bedroomCards').onclick=e=>{const b=e.target.closest('button');if(b?.dataset.bedroom)focusBedroom(b.dataset.bedroom);if(b?.dataset.bedroomTop)focusBedroom(b.dataset.bedroomTop,true);};
$('bedroomCompare').onclick=compareBedrooms;
$('bedroomDimensions').onclick=()=>{if(dimensionScope&&mode==='cut')setDimensionScope(null);else focusBedroom(lastDimensionId);};
$('bedroomQuick').onchange=e=>{if(e.target.value)focusBedroom(e.target.value);};
function rebuildDesks(){
 if(!model)return;
 for(const o of meshes.filter(m=>m.userData.proposed_desk)){o.removeFromParent();o.geometry.dispose();o.material.dispose();}
 meshes=meshes.filter(m=>!m.userData.proposed_desk);for(const id of DESK_IDS)assets.delete(id);
 const built=createDeskMeshes(rooms.small.rect,deskConfig);
 for(const o of built.meshes){model.add(o);meshes.push(o);const id=o.userData.asset_id;if(!assets.has(id))assets.set(id,{label:o.userData.asset_label,room:'small',proposed:true,meshes:[]});assets.get(id).meshes.push(o);}
 model.updateMatrixWorld(true);
}
function applyDesks(next){deskConfig=decodeDesks(next);rebuildDesks();}
function deskAssessment(){
 const layout=deskLayout(rooms.small.rect,deskConfig),active=layout.desks.filter(d=>!deleted.has(d.id)),[x0,x1,y0,y1]=rooms.small.rect;
 const fits=active.every(d=>d.rect[0]>=x0-1e-8&&d.rect[1]<=x1+1e-8&&d.rect[2]>=y0&&d.rect[3]<=y1);
 let bedConflict=false;const bed=assets.get('small-bed');
 if(deskConfig.enabled&&bed&&!deleted.has('small-bed')){const box=new THREE.Box3();for(const mesh of bed.meshes)box.expandByObject(mesh);bedConflict=active.some(d=>overlapRect(d.rect,[box.min.x,box.max.x,-box.max.z,-box.min.z]));}
 return {layout,active,fits,bedConflict};
}
function renderDeskPanel(){
 $('desksEnabled').checked=deskConfig.enabled;for(let i=0;i<2;i++)$('deskWidth'+i).value=String(deskConfig.widths[i]);
 const {layout,active,fits,bedConflict}=deskAssessment();
 $('deskFit').className='deskResult'+(!fits?' invalid':'');
 $('deskFit').textContent=!deskConfig.enabled?'双桌试摆已关闭；原模型未改写。':!active.length?'两张试摆桌已从当前方案删除，可在家具列表恢复。':!fits?`并排超宽：两桌及中缝共 ${(layout.span*100).toFixed(0)} cm，墙宽约 ${((rooms.small.rect[1]-rooms.small.rect[0])*100).toFixed(0)} cm；超出 ${(Math.max(0,-layout.remaining)*100).toFixed(0)} cm，不能按此排法放下。`:active.length===2?`并排宽 ${(layout.span*100).toFixed(0)} cm（含 2 cm 中缝）；两侧各余约 ${(layout.remaining*50).toFixed(0)} cm。${layout.remaining<.06?'余量很小，房间仍需实测。':'仅按当前模型计算。'}`:'当前保留 1 张试摆桌，位置沿用双桌方案。';
 $('deskConflict').hidden=!bedConflict;$('deskConflict').textContent='原床与桌子的平面范围重叠，桌下 / 桌前空间尚未腾空。可移走原床并随时撤销；这不是已验证可用的布局。';
 $('deskFront').textContent=`桌深 60 cm · 高 75 cm · 背墙留 2 cm；桌前理论余深约 ${layout.frontDepth.toFixed(2)} m（未扣原床、门扇、椅子等占位）。`;
 $('deskClearBed').disabled=!assets.has('small-bed')||deleted.has('small-bed');$('deskClearBed').textContent=deleted.has('small-bed')?'原床已移出当前方案':'移走原床（可撤销）';
}
function focusDesks(){focusBedroom('small',true);$('selectedName').textContent=`双桌试摆 · 靠主卧墙 · A ${deskConfig.widths[0]*100}×60 / B ${deskConfig.widths[1]*100}×60 cm · 高 75 cm`;}
$('deskFocus').onclick=$('deskQuickFocus').onclick=focusDesks;
$('desksEnabled').onchange=e=>edit(()=>{deskConfig={...deskConfig,enabled:e.target.checked};clearSelection();});
for(let i=0;i<2;i++)$('deskWidth'+i).onchange=e=>edit(()=>{const next={...deskConfig,widths:[...deskConfig.widths]};next.widths[i]=Number(e.target.value);clearSelection();applyDesks(next);});
$('deskClearBed').onclick=()=>{deleteAsset('small-bed');focusDesks();};
function toast(s){$('editStatus').textContent=s;}
function status(){ $('status').textContent=`MVP v05 · ${meshes.length} 个网格 · ${assets.size} 件家具/设备 · ${doors.size} 组可交互门 · 已删除 ${deleted.size} 件`; }
function clearSelection(){
 for(const o of meshes)if(o.material?.emissive)o.material.emissive.setHex(0);
 selectedId=null;selectedDoor=null;$('deleteSelected').hidden=true;$('quickDoor').hidden=true;
 $('selectedName').textContent='点击门开关 · 点击家具选择 · 拖拽移动视角';
 document.querySelectorAll('.assetItem.chosen').forEach(e=>e.classList.remove('chosen'));
}
function selectAsset(id){
 clearSelection();const a=assets.get(id);if(!a||deleted.has(id))return;
 selectedId=id;for(const o of a.meshes)o.material.emissive?.setHex(0x233e28);
 $('selectedName').textContent=`${a.label} · ${rooms[a.room]?.label||''} · 整件 ${a.meshes.length} 个部件`;
 $('deleteSelected').hidden=false;renderAssets();
}
function syncMode(){
 document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',b.dataset.mode===mode);});
 for(const o of meshes)o.visible=visibleMesh(o.userData,mode,furniture,deleted)&&(!o.userData.proposed_desk||deskConfig.enabled);
 $('modeLabel').textContent=mode==='cut'?'1.05 m 剖切 · 上部结构隐藏':mode==='shell'?'完整墙高 · 天花板隐藏':'完整空间 · 含天花板';
 if(selectedId&&(!furniture||deleted.has(selectedId)))clearSelection();
 renderDeskPanel();
}
function persist(){
 try{localStorage.setItem(storageKey,JSON.stringify(makePlan()));toast(`已自动保存 · 家具删除 ${deleted.size} 件 / 门 / 双桌方案 · 仅此浏览器生效，不影响其他人`);}
 catch{toast('浏览器无法自动保存，请点“保存方案 JSON”下载备份。');}
 status();
}
function edit(action){pushHistory(history,deleted,doorSnapshot(doors),deskConfig);action();syncMode();renderAssets();persist();}
function deleteAsset(id){if(!assets.has(id)||deleted.has(id))return;edit(()=>{deleted.add(id);if(selectedId===id)clearSelection();});}
function undo(){if(!history.length)return;const before=history.pop();deleted.clear();(before.deleted||before).forEach(id=>deleted.add(id));if(before.doors)applyDoorState(before.doors);clearSelection();if(before.desks)applyDesks(before.desks);syncMode();renderAssets();persist();}
function setDoorPose(d,value){
 d.value=value;for(const o of d.meshes){const p=poseDoor(o.userData,o.userDataPose.position,o.userDataPose.quaternion,value);o.position.copy(p.position);o.quaternion.copy(p.quaternion);}
}
function applyDoorState(values){
 for(const [id,d] of doors){d.target=values?.[id]??d.default;setDoorPose(d,d.target);}
 renderDoor();
}
function renderDoor(){
 const d=doors.get($('doorSelect').value);if(!d)return;
 $('doorRange').value=Math.round(d.target*100);
 $('doorSize').textContent=d.width?`门扇宽 / 开门半径 ${(d.width*100).toFixed(1).replace(/\.0$/,'')} cm · ${d.source} 用户确认`:'阳台推拉门 · 尺寸与行程暂定';
 $('doorValue').textContent=d.kind==='sliding'?`${Math.round(d.target*100)}% · 位移 ${(d.target*d.travel).toFixed(2)} m`:`${Math.round(d.target*90)}°`;
 $('doorToggle').textContent=d.target>.5?'关门':'开门';
 if(selectedDoor){$('quickDoor').textContent=doors.get(selectedDoor).target>.5?'关闭此门':'打开此门';}
 $('doorNote').textContent=d.id==='small-door'?'次卧床与门可能干涉；这里演示开合，不含碰撞检测。':d.kind==='sliding'?'双轨错位推拉；活动扇方向及行程暂定，未做现场闭合测量。':'可点击门扇或门框切换开关；也可拖动滑块设置角度。';
}
function selectDoor(id,focus=false){
 clearSelection();const d=doors.get(id);if(!d)return;selectedDoor=id;$('doorSelect').value=id;
 for(const o of d.meshes)o.material.emissive?.setHex(0x284137);
 $('selectedName').textContent=`${d.label} · ${d.kind==='sliding'?'推拉门':'平开门'} · 点击开关 / 侧栏调节`;
 $('quickDoor').hidden=false;renderDoor();
 if(focus){
  setDimensionScope(null);
  resetLens();setNav('orbit');mode='cut';syncMode();
  const c=to3(d.pivot).add(new THREE.Vector3(d.kind==='sliding'?.75:0,.65,0));
  move(c.clone().add(new THREE.Vector3(2.8,3.7,2.8)),c);
 }
}
function toggleDoor(id){const d=doors.get(id);if(!d)return;edit(()=>{d.target=d.target>.5?0:1;});renderDoor();}
$('doorSelect').onchange=()=>selectDoor($('doorSelect').value,true);
$('doorFocus').onclick=()=>selectDoor($('doorSelect').value,true);
$('doorToggle').onclick=()=>{selectDoor($('doorSelect').value);toggleDoor($('doorSelect').value);};
$('quickDoor').onclick=()=>toggleDoor(selectedDoor);
$('doorRange').oninput=e=>{
 const d=doors.get($('doorSelect').value);if(!d)return;
 if(!sliderEditing){pushHistory(history,deleted,doorSnapshot(doors),deskConfig);sliderEditing=true;}
 d.target=Number(e.target.value)/100;setDoorPose(d,d.target);renderDoor();
};
$('doorRange').onchange=()=>{sliderEditing=false;renderAssets();persist();};
$('doorReset').onclick=()=>{edit(()=>applyDoorState());toast('已恢复各门的初始姿态；可撤销。');};
function renderAssets(){
 const term=$('assetSearch').value.trim().toLowerCase(),r=$('assetRoom').value;
 $('assetList').replaceChildren();
 for(const [id,a] of assets){
  if((r&&a.room!==r)||(term&&!`${a.label} ${rooms[a.room]?.label||''}`.toLowerCase().includes(term)))continue;
  const row=document.createElement('div');row.className='assetItem'+(deleted.has(id)?' deleted':'')+(selectedId===id?' chosen':'');
  const select=document.createElement('button');select.textContent=a.label;
  const sub=document.createElement('small');sub.textContent=(rooms[a.room]?.label||'')+(a.proposed?' · 新增试摆':'')+(deleted.has(id)?' · 已删除':a.proposed&&!deskConfig.enabled?' · 方案已关闭':' · 点击定位整件');select.append(sub);
  select.onclick=()=>{if(deleted.has(id)){toast('这件家具已删除，点击右侧“恢复”即可放回。');return;}focusAsset(id);};
  const change=document.createElement('button');change.textContent=deleted.has(id)?'恢复':'删除';change.setAttribute('aria-label',`${change.textContent}${a.label}`);
  change.onclick=()=>{if(deleted.has(id))edit(()=>deleted.delete(id));else deleteAsset(id);};row.append(select,change);$('assetList').append(row);
 }
 if(!$('assetList').children.length)$('assetList').textContent='没有匹配的家具';
 $('assetCount').textContent=`${assets.size} 件 · 删除 ${deleted.size}`;
 $('undoEdit').disabled=!history.length;$('restoreAll').disabled=!deleted.size;$('quickUndo').hidden=!history.length;
}
function setActiveRoom(k){document.querySelectorAll('[data-room]').forEach(b=>b.classList.toggle('active',b.dataset.room===k));}
function setNav(next, relocate=true){
 if(next===nav)return;
 tween=null;
 if(next==='fly'){
  controls.update();controls.enabled=false;
  const f=camera.getWorldDirection(new THREE.Vector3());flyYaw=Math.atan2(-f.x,-f.z);flyPitch=Math.asin(THREE.MathUtils.clamp(f.y,-1,1));
  if(relocate&&(camera.position.y>2.5||camera.position.y<.5)){
   camera.position.copy(to3([2.78,3.6,+$('eyeHeight').value]));flyYaw=0;flyPitch=0;
  }
  flyPitch=THREE.MathUtils.clamp(flyPitch,-1.45,1.45);
  camera.rotation.set(flyPitch,flyYaw,0,'YXZ');mode='full';syncMode();
  if(camera.position.y>=.6&&camera.position.y<=2.3)$('eyeHeight').value=camera.position.y;
  $('eyeValue').textContent=camera.position.y.toFixed(2)+' m';
 }else{
  if(nav==='fly'){const f=camera.getWorldDirection(new THREE.Vector3());controls.target.copy(camera.position).addScaledVector(f,3);}
  controls.enabled=true;controls.mouseButtons.LEFT=next==='pan'?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT=next==='pan'?THREE.MOUSE.ROTATE:THREE.MOUSE.PAN;
  controls.touches.ONE=next==='pan'?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
 }
 nav=next;keys.clear();walking.clear();flyPointer=null;
 viewport.classList.toggle('fly',nav==='fly');viewport.classList.toggle('pan',nav==='pan');
 document.querySelectorAll('[data-nav]').forEach(b=>{b.classList.toggle('active',b.dataset.nav===nav);b.setAttribute('aria-pressed',b.dataset.nav===nav);});
 $('flyPad').hidden=nav!=='fly';
 $('navHint').textContent=nav==='fly'?'拖拽转头 · WASD 移动 · 右键平移':nav==='pan'?'左键拖拽平移 · 右键旋转 · 滚轮缩放':'左键旋转 · 右键平移 · 滚轮缩放';
}
function move(pos,target){setNav('orbit');tween={start:performance.now(),from:camera.position.clone(),to:pos.clone(),a:controls.target.clone(),b:target.clone()};}
function resetLens(){camera.fov=42;camera.updateProjectionMatrix();$('cameraSelect').value='';}
function home(){setDimensionScope(null);clearSelection();resetLens();setNav('orbit');mode='cut';syncMode();move(to3([10.4,-1.6,13.1]),to3([1.4,6.4,.1]));$('roomInfo').innerHTML='<b>全屋 · 从入户到阳台</b><p>右侧通行，左侧依次为厨房、小厅、卫生间、次卧；尽端卧室连接阳台。点击各空间标签可定位并查看宽深尺寸。外轮廓仍待闭合。</p>';setActiveRoom('');}
function top(){setDimensionScope(null);clearSelection();resetLens();setNav('orbit');mode='cut';syncMode();move(to3([1.6,6.30,19]),to3([1.6,6.4,0]));setActiveRoom('');}
const notes={kitchen:'L 形台面绕开转角凸墙；凸墙性质和尺寸仍需现场确认。',entry:'入户门扇宽 86 cm；门洞与门框尺寸暂定。',living:'飘窗、灰色布衣柜、衣帽架、镜子和折叠桌，为现状布局。',bath:'入口旁洗手盆，内侧马桶，靠窗为淋浴和热水器。整体尺寸待复核。',small:'次卧门靠卫生间一端，门扇宽 76.5 cm；离墙角距离暂定。开门未做碰撞检测。',corridor:'连接卫生间、次卧和尽端卧室，走道尺寸暂定。',main:'松木床、白色床边桌、木桌置物架、紫布柜；推拉门通向阳台。',balcony:'短护栏、墙垛、服务管、分段玻璃护栏、木纹砖和双轨推拉门；细部尺寸仍待复核。'};
function room(k){if(bedroomById.has(k)){focusBedroom(k);return;}setDimensionScope(null);clearSelection();resetLens();setNav('orbit');const r=rooms[k], [x0,x1,y0,y1]=r.rect;mode='cut';syncMode();const cx=(x0+x1)/2,cy=(y0+y1)/2;move(to3([cx+4,cy-3.7,5.7]),to3([cx,cy,.4]));setActiveRoom(k);$('roomInfo').innerHTML=`<b>${r.label} <span>约 ${(x1-x0).toFixed(2)} × ${(y1-y0).toFixed(2)} m</span></b><p>${notes[k]}</p>`;}
function focusAsset(id){
 const a=assets.get(id);if(!a)return;if(a.proposed&&!deskConfig.enabled){toast('请先在“双桌试摆”中启用方案。');return;}setDimensionScope(null);setNav('orbit');resetLens();furniture=true;$('furniture').checked=true;
 mode=a.meshes.every(o=>o.userData.group==='high')?'shell':'cut';syncMode();selectAsset(id);
 const box=new THREE.Box3();a.meshes.forEach(o=>box.expandByObject(o));const c=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
 const scale=Math.max(1.8,size.length()*1.3);move(c.clone().add(new THREE.Vector3(scale*.7,scale*.9,scale*.65)),c);setActiveRoom(a.room);
}
for(const [key,r] of Object.entries(rooms)){
 $('rooms').insertAdjacentHTML('beforeend',`<button data-room="${key}">${r.label}</button>`);
 $('assetRoom').insertAdjacentHTML('beforeend',`<option value="${key}">${r.label}</option>`);
}
$('rooms').addEventListener('click',e=>{if(e.target.dataset.room)room(e.target.dataset.room);});
for(const c of data.cameras.filter(c=>c.type==='PERSP'))$('cameraSelect').insertAdjacentHTML('beforeend',`<option value="${c.name}">${c.name.substring(3)}</option>`);
$('cameraSelect').onchange=e=>{const c=data.cameras.find(c=>c.name===e.target.value);if(c){setNav('orbit');mode='full';syncMode();camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(36/(2*c.lens)));camera.updateProjectionMatrix();move(to3(c.position),to3(c.target));setActiveRoom('');$('roomInfo').innerHTML='<b>'+c.name.substring(3)+' · 可继续移动</b><p>切换“自由漫游”后可拖拽转头、移动相机；也可从相机地图调整位置。</p>';}};
$('home').onclick=home;$('quickHome').onclick=home;$('top').onclick=top;
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;syncMode();});
document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>setNav(b.dataset.nav));
$('furniture').onchange=e=>{furniture=e.target.checked;syncMode();};$('labels').onchange=e=>{labels=e.target.checked;};$('grid').onchange=e=>{grid.visible=e.target.checked;};
$('assetSearch').oninput=renderAssets;$('assetRoom').onchange=renderAssets;
$('deleteSelected').onclick=()=>deleteAsset(selectedId);$('undoEdit').onclick=undo;$('quickUndo').onclick=undo;
$('restoreAll').onclick=()=>{if(deleted.size)edit(()=>deleted.clear());};
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.download=name;a.href=u;a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);}
function makePlan(){const target=nav==='fly'?camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3())):controls.target;return {schema:PLAN_SCHEMA,model:'MVP v05 + 双桌试摆',savedAt:new Date().toISOString(),deleted:[...deleted],doors:doorSnapshot(doors),desks:decodeDesks(deskConfig),camera:{position:camera.position.toArray(),target:target.toArray()},view:{mode,nav,fov:camera.fov}};}
$('savePlan').onclick=()=>{download(new Blob([JSON.stringify(makePlan(),null,2)],{type:'application/json'}),'福州新家_家具调整方案.json');toast('已下载方案 JSON，包含家具删除、门开合、双桌尺寸与当前相机位置。');};
$('importPlan').onclick=()=>$('planFile').click();
$('planFile').onchange=async e=>{
 try{
  const f=e.target.files[0];if(!f)return;if(f.size>1000000)throw new Error('方案文件过大');
  const p=decodePlan(await f.text(),new Set(assets.keys()),new Set(doors.keys()));edit(()=>{deleted.clear();p.deleted.forEach(id=>deleted.add(id));applyDoorState(p.doors);clearSelection();applyDesks(p.desks||{...defaultDesks(),enabled:false});});
  if(p.camera){setNav('orbit');mode=p.view?.mode||(p.camera.position[1]>3?'cut':'full');syncMode();camera.fov=p.view?.fov||42;camera.updateProjectionMatrix();move(new THREE.Vector3(...p.camera.position),new THREE.Vector3(...p.camera.target));if(p.view?.nav==='fly')tween.done=()=>setNav('fly',false);}
  toast(`已载入方案，删除 ${p.deleted.length} 件；可撤销本次载入。`);
 }catch(err){toast('载入失败：'+err.message);}finally{e.target.value='';}
};
$('exportEdited').onclick=async()=>{
 const b=$('exportEdited');if(!model)return;if(deskConfig.enabled&&!deskAssessment().fits){toast('试摆桌超出房间边界，请缩短桌长或关闭双桌试摆后再导出。');return;}b.disabled=true;b.textContent='正在导出…';
 try{
  for(const d of doors.values())setDoorPose(d,d.target);model.updateMatrixWorld(true);
  const copy=model.clone(true);copy.traverse(o=>{if(o.userData.door_id)o.userData.door_default=doors.get(o.userData.door_id).target;});copy.traverse(o=>{o.visible=!(o.userData.asset_id&&deleted.has(o.userData.asset_id))&&(!o.userData.proposed_desk||deskConfig.enabled);if(o.isMesh){o.material=o.material.clone();o.material.emissive?.setHex(0);}});
  const binary=await new GLTFExporter().parseAsync(copy,{binary:true,onlyVisible:true});
  copy.traverse(o=>{if(o.isMesh)o.material.dispose();});
  download(new Blob([binary],{type:'model/gltf-binary'}),'福州新家_调整后模型.glb');toast(`已导出完整空间 GLB（移除 ${deleted.size} 件家具），原文件未改写。`);
 }catch(err){toast('导出失败：'+err.message);}finally{b.disabled=false;b.textContent='导出当前方案 GLB';}
};
$('screenshot').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(blob=>{if(blob)download(blob,'福州新家_模型截图.png');});};
$('measure').onclick=()=>{measureMode=!measureMode;clearSelection();clearMeasure();$('measure').classList.toggle('active',measureMode);$('measure').setAttribute('aria-pressed',measureMode);$('selectedName').textContent=measureMode?'依次点击模型上两点；结果是模型距离，非现场实测。':'点击门开关 · 点击家具选择 · 拖拽移动视角';};
function clearMeasure(){measurePoints=[];rulerGroup.children.slice().forEach(o=>{o.geometry?.dispose();o.material?.dispose();rulerGroup.remove(o);});$('distance').hidden=true;}
function pick(e){
 const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,camera);
 const hit=ray.intersectObjects(meshes.filter(o=>o.visible),false)[0];if(!hit){clearSelection();return;}
 if(measureMode){
  if(measurePoints.length===2)clearMeasure();measurePoints.push(hit.point.clone());const dot=new THREE.Mesh(new THREE.SphereGeometry(.025,12,8),new THREE.MeshBasicMaterial({color:0xd3723f,depthTest:false}));dot.position.copy(hit.point);dot.renderOrder=3;rulerGroup.add(dot);
  if(measurePoints.length===2){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(measurePoints),new THREE.LineBasicMaterial({color:0xd3723f,depthTest:false}));line.renderOrder=2;rulerGroup.add(line);$('distance').textContent=`模型两点距离 ${measurePoints[0].distanceTo(measurePoints[1]).toFixed(3)} m · 非现场实测`;$('distance').hidden=false;}return;
 }
 if(hit.object.userData.door_id){selectDoor(hit.object.userData.door_id);toggleDoor(hit.object.userData.door_id);}
 else if(hit.object.userData.asset_id)selectAsset(hit.object.userData.asset_id);
 else{clearSelection();$('selectedName').textContent=`${hit.object.name} · 建筑部件已锁定，不可作为家具删除`;}
}
renderer.domElement.addEventListener('pointerdown',e=>{
 down=[e.clientX,e.clientY];tween=null;
 if(nav==='fly'){renderer.domElement.setPointerCapture(e.pointerId);flyPointer={id:e.pointerId,x:e.clientX,y:e.clientY,pan:e.button===2||e.shiftKey};}
});
renderer.domElement.addEventListener('pointermove',e=>{
 if(nav!=='fly'||!flyPointer||e.pointerId!==flyPointer.id)return;
 const dx=e.clientX-flyPointer.x,dy=e.clientY-flyPointer.y;flyPointer.x=e.clientX;flyPointer.y=e.clientY;
 if(flyPointer.pan){camera.translateX(-dx*.005);camera.position.y=THREE.MathUtils.clamp(camera.position.y+dy*.005,.3,4);}
 else{flyYaw-=dx*.004;flyPitch=THREE.MathUtils.clamp(flyPitch-dy*.004,-1.45,1.45);camera.rotation.set(flyPitch,flyYaw,0,'YXZ');}
});
renderer.domElement.addEventListener('pointerup',e=>{if(down&&e.button===0&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<=5)pick(e);flyPointer=null;down=null;});
renderer.domElement.addEventListener('pointercancel',()=>{flyPointer=null;down=null;});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('wheel',e=>{if(nav==='fly'){e.preventDefault();walk(e.deltaY<0?1:-1,0,.25);}}, {passive:false});
function walk(forward,right,amount){
 const f=camera.getWorldDirection(new THREE.Vector3());f.y=0;f.normalize();const r=new THREE.Vector3().crossVectors(f,camera.up).normalize();
 const v=f.multiplyScalar(forward).addScaledVector(r,right);if(v.lengthSq()>0)camera.position.addScaledVector(v.normalize(),amount);
 camera.position.x=THREE.MathUtils.clamp(camera.position.x,-10,15);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-23,10);
}
for(const b of document.querySelectorAll('[data-walk]')){
 b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);walking.add(b.dataset.walk);};b.onpointerup=b.onpointercancel=()=>walking.delete(b.dataset.walk);
}
// Map coordinates use house Y horizontally and X vertically; no geographic bearing is asserted.
const svg=$('mapSvg'),NS='http://www.w3.org/2000/svg', maxY=13.05,maxX=3.5;
const mx=y=>10+y/maxY*280,my=x=>10+x/maxX*80;
function svgEl(tag,attrs){const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);svg.append(e);return e;}
for(const [k,r]of Object.entries(rooms)){
 const [x0,x1,y0,y1]=r.rect;
 svgEl('rect',{x:mx(y0),y:my(x0),width:(y1-y0)/maxY*280,height:(x1-x0)/maxX*80,fill:k==='corridor'||k==='entry'?'#e6e8d8':'#d6e2d0',stroke:'#94aa90','stroke-width':.8});
 const t=svgEl('text',{x:mx((y0+y1)/2),y:my((x0+x1)/2)+2,'text-anchor':'middle','font-size':8,fill:'#52694d','pointer-events':'none'});t.textContent={kitchen:'厨房',living:'小厅',bath:'卫',small:'次卧',main:'主卧',balcony:'阳台',entry:'入口',corridor:'走道'}[k];
}
const mapArrow=svgEl('line',{stroke:'#c37542','stroke-width':2,'pointer-events':'none'}),mapDot=svgEl('circle',{r:4,fill:'#285343',stroke:'#fff','stroke-width':1.5,'pointer-events':'none'});
function updateMap(){
 if($('cameraMap').hidden)return;
 if(nav==='fly'){$('eyeValue').textContent=camera.position.y.toFixed(2)+' m';$('eyeHeight').value=THREE.MathUtils.clamp(camera.position.y,.6,2.3);}
 const x=THREE.MathUtils.clamp(mx(-camera.position.z),5,295),y=THREE.MathUtils.clamp(my(camera.position.x),5,95),f=camera.getWorldDirection(new THREE.Vector3());
 mapDot.setAttribute('cx',x);mapDot.setAttribute('cy',y);mapArrow.setAttribute('x1',x);mapArrow.setAttribute('y1',y);mapArrow.setAttribute('x2',x-f.z*15);mapArrow.setAttribute('y2',y+f.x*15);
}
let mapDrag=false;
function mapMove(e){
 const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
 setNav('fly');camera.position.set(THREE.MathUtils.clamp((p.y-10)/80*maxX,.1,3.15),+$('eyeHeight').value,-THREE.MathUtils.clamp((p.x-10)/280*maxY,.1,12.7));tween=null;
}
svg.onpointerdown=e=>{svg.setPointerCapture(e.pointerId);mapDrag=true;mapMove(e);};svg.onpointermove=e=>{if(mapDrag)mapMove(e);};svg.onpointerup=svg.onpointercancel=()=>{mapDrag=false;};
$('mapToggle').onclick=()=>{$('cameraMap').hidden=!$('cameraMap').hidden;$('mapToggle').setAttribute('aria-expanded',!$('cameraMap').hidden);};
$('eyeHeight').oninput=e=>{setNav('fly');camera.position.y=+e.target.value;$('eyeValue').textContent=camera.position.y.toFixed(2)+' m';};
const labelNodes=[];
for(const [k,r]of Object.entries(rooms)){
 const el=document.createElement('button');el.className='roomLabel';el.textContent=k==='living'?'客厅 / 小厅':r.label;
 const b=bedroomById.get(k);if(b){el.classList.add('bedroomRoomLabel');const dims=document.createElement('small');dims.textContent=`${b.width.toFixed(2)} × ${b.depth.toFixed(2)} m · 参考`;el.appendChild(dims);el.setAttribute('aria-label',`${b.name}，宽约 ${b.width.toFixed(2)} 米，深约 ${b.depth.toFixed(2)} 米，点击定位`);}
 el.onclick=()=>room(k);$('labelLayer').appendChild(el);labelNodes.push({el,key:k,pos:to3([(r.rect[0]+r.rect[1])/2,(r.rect[2]+r.rect[3])/2,.15])});
}
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(viewport);
function animate(t){
 requestAnimationFrame(animate);const dt=Math.min((t-lastFrame)/1000,.05);lastFrame=t;
 if(tween){const f=Math.min(1,(t-tween.start)/650),v=1-(1-f)**3;camera.position.lerpVectors(tween.from,tween.to,v);controls.target.lerpVectors(tween.a,tween.b,v);if(f===1){const done=tween.done;tween=null;if(done)done();}}
 if(nav==='fly'){
  const forward=Number(keys.has('w')||walking.has('forward'))-Number(keys.has('s')||walking.has('back'));
  const right=Number(keys.has('d')||walking.has('right'))-Number(keys.has('a')||walking.has('left'));
  const speed=keys.has('shift')?3.2:1.25;walk(forward,right,dt*speed);
  camera.position.y=THREE.MathUtils.clamp(camera.position.y+(Number(keys.has('e'))-Number(keys.has('q')))*dt*speed,.3,4);
 }else controls.update();
 for(const d of doors.values())if(Math.abs(d.target-d.value)>.00001)setDoorPose(d,Math.abs(d.target-d.value)<.001?d.target:THREE.MathUtils.lerp(d.value,d.target,1-Math.exp(-dt*10)));
 camera.updateMatrixWorld();
 const dimensionIds=new Set(mode==='cut'&&nav!=='fly'?(dimensionScope==='all'?bedrooms.map(b=>b.id):dimensionScope?[dimensionScope]:[]):[]);
 bedroomOverlay.update(camera,viewport.clientHeight,dimensionIds);
 renderer.render(scene,camera);updateMap();
 for(const l of labelNodes){const p=l.pos.clone().project(camera),show=labels&&mode==='cut'&&!dimensionScope&&p.z<1&&p.z>-1&&Math.abs(p.x)<1&&Math.abs(p.y)<1;l.el.hidden=!show;if(show)l.el.style.transform=`translate(${(p.x+1)*viewport.clientWidth/2}px,${(-p.y+1)*viewport.clientHeight/2}px) translate(-50%,-50%)`;}
}
function load(){
 try{
  const raw=atob(data.glb),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  new GLTFLoader().parse(bytes.buffer,'',g=>{
   model=g.scene;scene.add(model);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material=o.material.clone();o.material.side=THREE.DoubleSide;meshes.push(o);
    const id=o.userData.asset_id;if(id){if(!assets.has(id))assets.set(id,{label:o.userData.asset_label,room:o.userData.asset_room,meshes:[]});assets.get(id).meshes.push(o);}
   }});
   rebuildDesks();$('deskControls').disabled=false;
   for(const o of meshes){const m=o.userData;if(!m.door_id)continue;o.userDataPose={position:o.position.clone(),quaternion:o.quaternion.clone()};if(!doors.has(m.door_id))doors.set(m.door_id,{id:m.door_id,label:m.door_label,kind:m.door_kind,default:m.door_default,value:m.door_default,target:m.door_default,pivot:m.door_pivot,travel:m.door_travel,width:m.door_width_m,source:m.door_width_source,meshes:[]});doors.get(m.door_id).meshes.push(o);}
   for(const [id,d] of doors){const option=document.createElement('option');option.value=id;option.textContent=d.label+(d.width?` · ${(d.width*100).toFixed(1).replace(/\.0$/,'')} cm`:'');$('doorSelect').append(option);}
   renderDoor();
   try{const raw=localStorage.getItem(storageKey);if(raw){const p=decodePlan(raw,new Set(assets.keys()),new Set(doors.keys()));p.deleted.forEach(id=>deleted.add(id));applyDoorState(p.doors);if(p.desks)applyDesks(p.desks);toast(`已恢复上次家具 / 门 / 双桌方案 · 删除 ${deleted.size} 件`);}}catch{toast('本地方案无法读取；当前显示原始家具，可载入 JSON 备份。');}
   home();renderAssets();$('loading').hidden=true;status();
  },err=>failure(err));
 }catch(err){failure(err);}
}
function failure(err){$('loading').textContent='三维模型加载失败。请刷新重试，或换用支持 WebGL 的浏览器。 '+String(err);$('status').textContent='三维模型暂不可用';console.error(err);}
window.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable||$('helpDialog').open)return;
 const k=e.key.toLowerCase();
 if(k==='escape'){clearSelection();clearMeasure();measureMode=false;$('measure').classList.remove('active');$('measure').setAttribute('aria-pressed',false);}
 if(k==='r')home();if(k==='t')top();
 if(k==='delete'||k==='backspace'){if(selectedId){e.preventDefault();deleteAsset(selectedId);}}
 if(k==='z'&&(e.ctrlKey||e.metaKey)){e.preventDefault();undo();}
 if(nav==='fly'&&['w','a','s','d','q','e','shift'].includes(k)){e.preventDefault();keys.add(k);}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();walking.clear();flyPointer=null;});
resize();requestAnimationFrame(animate);load();
