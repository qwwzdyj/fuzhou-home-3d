import * as THREE from 'three';
import {deskLayout} from './desk-plan.mjs';
export function createDeskMeshes(rect,config){
 const layout=deskLayout(rect,config),meshes=[];
 for(const [i,desk] of layout.desks.entries()){
  const [x0,x1,y0,y1]=desk.rect,cx=(x0+x1)/2,cy=(y0+y1)/2;
  const label=`试摆书桌 ${i?'B':'A'} · ${Math.round(desk.width*100)}×60×75 cm`;
  function box(name,x,y,z,w,d,h,color){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:layout.fits?color:'#cf8c79',roughness:.65}));
   mesh.name=`${label}_${name}`;mesh.position.set(x,z,-y);mesh.castShadow=mesh.receiveShadow=true;
   mesh.userData={asset_id:desk.id,asset_label:label,asset_room:'small',editable_furniture:true,group:'small',proposed_desk:true,width_m:desk.width,depth_m:.6,height_m:.75,placement_status:'trial_not_site_verified'};
   meshes.push(mesh);
  }
  box('桌板',cx,cy,.7375,desk.width,.6,.025,'#60402d');
  for(const [j,x] of [x0+.04,x1-.04].entries())for(const [k,y] of [y0+.04,y1-.04].entries()){
   box(`钢腿${j}${k}`,x,y,.3725,.035,.035,.705,'#232526');
   box(`调节脚${j}${k}`,x,y,.01,.037,.037,.02,'#303735');
  }
  for(const y of [y0+.04,y1-.04])box('长边框',cx,y,.705,desk.width-.08,.03,.04,'#232526');
  for(const x of [x0+.04,x1-.04])box('短边框',x,cy,.705,.03,.52,.04,'#232526');
 }
 return {layout,meshes};
}
