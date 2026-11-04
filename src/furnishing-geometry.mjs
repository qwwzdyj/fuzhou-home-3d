import * as THREE from 'three';
const walnut='#65412b',oak='#a2693c',steel='#aeb4b4',cream='#e9e3d1',black='#292b2c',blue='#52647d';
// Dimensions in metres. Image-selected sizes are distinguished from layout estimates.
export function createFurnishing(config){
 const meshes=[],catalog=[];
 function item(id,label,room,pos,angle,size,basis,build){
  const group=new THREE.Group();group.position.set(pos[0],pos[2],-pos[1]);group.rotation.y=angle;
  const meta={asset_id:'new-'+id,asset_label:label,asset_room:room,editable_furniture:true,new_furnishing:true,group:room,size_m:size,size_basis:basis,placement_status:'layout_proposal_not_site_verified'};
  function mesh(name,geo,x,y,z,color,metal=0){const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:metal?.3:.72,metalness:metal}));m.position.set(x,z,-y);m.name=label+'_'+name;m.userData={...meta};m.castShadow=m.receiveShadow=true;group.add(m);return m;}
  const box=(n,x,y,z,w,d,h,c)=>mesh(n,new THREE.BoxGeometry(w,h,d),x,y,z,c);
  const cyl=(n,x,y,z,rt,rb,h,c,metal=0)=>mesh(n,new THREE.CylinderGeometry(rt,rb,h,40),x,y,z,c,metal);
  function bar(n,a,b,r,c){const from=new THREE.Vector3(a[0],a[2],-a[1]),to=new THREE.Vector3(b[0],b[2],-b[1]),v=to.clone().sub(from);const m=mesh(n,new THREE.CylinderGeometry(r,r,v.length(),10),0,0,0,c,.55);m.position.copy(from.clone().lerp(to,.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;}
  function panelHole(w,h,r,holes,y,z,color){const shape=new THREE.Shape();shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();for(const [x,v] of holes){const path=new THREE.Path();path.absarc(x,v,r,0,Math.PI*2,true);shape.holes.push(path);}const m=mesh('圆孔木板',new THREE.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:false}),0,y,z,color);return m;}
  build({box,cyl,bar,panelHole});group.updateMatrixWorld(true);
  for(const m of [...group.children]){m.applyMatrix4(group.matrixWorld);group.remove(m);meshes.push(m);}
  catalog.push({id:meta.asset_id,label,room,size,basis});
 }
 item('sideboard','胡桃木餐边柜 · 180×41×90 cm（规格暂定）','living',[.98,4.965,0],0,[1.8,.41,.9],'image_options_estimated',({box,bar})=>{
  for(const x of [-.88,-.3,.3,.88])for(const y of [-.19,.19])bar('镀铬立柱',[x,y,.02],[x,y,.9],.009,steel);
  for(const z of [.72,.89])box('长层板',0,0,z,1.8,.41,.02,walnut);
  for(const x of [-.6,.6]){box('抽屉柜体',x,0,.49,.57,.38,.4,walnut);for(const z of [.39,.58]){box('抽屉面',x,-.201,z,.55,.016,.18,walnut);box('抽屉暗拉手',x,-.214,z+.07,.27,.015,.012,black);}}
  for(const x of [-.59,.59])bar('背撑',[x-.28,.19,.05],[x+.28,.19,.72],.004,steel);
 });
 item('dining-table',`白面圆餐桌 · Ø${config.diameter*100}×75 cm（直径暂定）`,'living',[1.08,3.58,0],0,[config.diameter,config.diameter,.75],'diameter_estimated_height_image',({cyl,box,panelHole})=>{
  cyl('圆桌木边',0,0,.725,config.diameter/2,config.diameter/2,.035,walnut);cyl('白色桌面',0,0,.746,config.diameter/2,config.diameter/2,.008,'#e9e6de');cyl('金属底盘',0,0,.018,.26,.26,.035,steel,.8);
  panelHole(.23,.65,.035,[[0,-.16],[0,.05],[0,.24]],.105,.36,oak);box('立柱后板',0,.11,.36,.23,.018,.65,walnut);box('立柱侧板',-.108,0,.36,.018,.22,.65,walnut);box('立柱侧板',.108,0,.36,.018,.22,.65,walnut);
 });
 function chair(id,room,x,y,angle){item(id,`${room==='small'?'工作椅':'餐椅'} ${id.endsWith('a')?'A':'B'} · 蓝坐垫胡桃木 · 44×40×76 cm（数量暂定）`,room,[x,y,0],angle,[.44,.4,.76],'image_dimensions_quantity_estimated',({cyl,bar,panelHole})=>{
  const seat=cyl('蓝色坐垫',0,0,.45,.21,.21,.04,blue);seat.scale.z=.92;
  for(const x of [-.19,.19])for(const y of [-.17,.17]){bar('镀铬椅腿',[x*1.06,y,.015],[x,y,.44],.009,steel);cyl('脚垫',x*1.06,y,.009,.013,.014,.018,black);}
  for(const x of [-.18,.18])bar('靠背支撑',[x,.16,.4],[x,.17,.68],.009,steel);
  panelHole(.44,.17,.04,[[-.07,0]],.18,.675,oak);
 });}
 chair('study-chair-a','small',.61,7.88,Math.PI);chair('study-chair-b','small',1.63,7.88,Math.PI);
 chair('dining-chair-a','living',1.08-config.diameter/2-.23,3.58,-Math.PI/2);chair('dining-chair-b','living',1.08+config.diameter/2+.23,3.58,Math.PI/2);
 item('wall-cubby','胡桃木格子壁柜 · 100×24×60 cm（规格暂定）','small',[1.12,8.60,1.4],0,[1,.24,.6],'image_options_estimated',({box})=>{
  box('背板',0,.11,.3,1,.02,.6,walnut);for(const z of [.01,.3,.59])box('层板',0,0,z,1,.24,.02,walnut);for(const x of [-.49,.49])box('侧板',x,0,.3,.02,.24,.6,walnut);for(const x of [-.25,0,.25])box('上格',x,0,.45,.02,.24,.28,walnut);for(const x of [-.165,.165])box('下格',x,0,.15,.02,.24,.28,walnut);
 });
 function shelf(id,label,x,y,z,w,d,h,levels){item(id,label,'living',[x,y,z],0,[w,d,h],id==='mini-shelf'?'image_selected':'image_shape_size_estimated',({box,bar})=>{for(let i=0;i<levels;i++)box('层板',0,0,.01+i*(h-.02)/(levels-1),w,d,.012,walnut);for(const x of [-w/2+.012,w/2-.012])for(const y of [-d/2+.012,d/2-.012])bar('立杆',[x,y,0],[x,y,h],.005,steel);});}
 shelf('mini-shelf','桌面小收纳架 · 30×12×30 cm',.42,4.96,.9,.30,.12,.30,3);
 shelf('coffee-shelf','咖啡角三层架 · 60×20×55 cm（暂定）',1.43,4.99,.9,.60,.20,.55,3);
 item('cart','木色金属小推车 · 40×22×42 cm','kitchen',[1.18,2.05,0],0,[.4,.22,.42],'image_dimensions',({box,bar,cyl})=>{
  for(const z of [.08,.33])box('置物层',0,0,z,.4,.22,.02,oak);for(const x of [-.185,.185]){for(const y of [-.095,.095])bar('立柱',[x,y,.06],[x,y,.42],.008,steel);bar('扶手',[x,-.095,.42],[x,.095,.42],.008,steel);}
  for(const x of [-.17,.17])for(const y of [-.085,.085]){const c=cyl('脚轮',x,y,.035,.03,.03,.02,oak);c.rotation.x=Math.PI/2;}
 });
 item('side-table','胡桃木圆边几 · 40×40×24 cm','main',[.38,10.53,0],0,[.4,.4,.24],'image_dimensions',({cyl,box})=>{cyl('圆面',0,0,.23,.2,.2,.02,walnut);box('交叉腿',0,0,.115,.35,.025,.23,walnut);box('交叉腿',0,0,.115,.025,.35,.23,walnut);});
 item('silver-lamp','银色蘑菇台灯 · Ø15×21 cm','main',[.38,10.53,.24],0,[.15,.15,.21],'image_dimensions',({cyl})=>{cyl('底座',0,0,.008,.04,.04,.016,steel,.9);cyl('灯柱',0,0,.095,.012,.035,.18,steel,.9);cyl('蘑菇灯罩',0,0,.185,.014,.075,.05,steel,.9);cyl('发光面',0,0,.16,.068,.068,.004,'#fff0c9');});
 item('pendant','胡桃木碟形吊灯 · Ø30×18 cm（吊高暂定）','living',[1.08,3.58,0],0,[.3,.3,2.72],'image_dimensions_drop_estimated',({cyl,bar})=>{cyl('顶盘',0,0,2.695,.05,.05,.05,steel,.8);bar('吊线',[0,0,2.67],[0,0,1.94],.003,black);cyl('灯座',0,0,1.92,.024,.035,.12,steel,.7);cyl('上碟',0,0,1.88,.018,.15,.045,walnut);cyl('下碟',0,0,1.83,.018,.11,.04,walnut);cyl('灯面',0,0,1.806,.07,.07,.008,'#ffedc5');});
 for(const [id,room,x,y] of [['bin-study','small',.25,8.4],['bin-main','main',.92,10.53]])item(id,'米白垃圾桶 · Ø24.5×30 cm',room,[x,y,0],0,[.245,.245,.3],'image_two_pack',({cyl})=>{cyl('桶体',0,0,.15,.1225,.0875,.3,cream);cyl('桶口暗面',0,0,.3005,.111,.111,.002,'#777368');});
 item('paper-box','壁挂纸巾盒 · 24.3×13×20.5 cm','bath',[.95,5.41,1.05],Math.PI,[.243,.13,.205],'image_dimensions',({box,cyl})=>{box('奶油盒体',0,0,.1025,.243,.13,.205,cream);box('木色边框',0,-.068,.1025,.221,.014,.183,walnut);box('磨砂盖',0,-.078,.1025,.186,.012,.15,'#d8d4bb');box('抽纸口',0,-.086,.075,.14,.005,.012,black);});
 item('corner-basket','奶油转角收纳篮 · 边长21.5 cm','bath',[.13,5.46,1.30],0,[.215,.215,.12],'image_dimensions',({box})=>{box('篮底',0,0,.01,.20,.20,.015,cream);for(const x of [-.10,.10])box('侧沿',x,0,.04,.008,.2,.065,cream);box('前沿',0,-.1,.04,.2,.008,.065,cream);box('毛巾杆',0,-.12,-.035,.23,.008,.008,cream);});
 item('broom','白色扫把簸箕套装 · 高87 cm','balcony',[2.85,11.98,0],0,[.26,.12,.87],'image_dimensions',({box,bar})=>{box('簸箕',0,0,.08,.245,.12,.16,cream);box('刷毛',0,0,.22,.26,.03,.09,black);bar('扫把柄',[0,0,.22],[0,0,.87],.008,cream);bar('簸箕柄',[.08,.04,.1],[.08,.04,.85],.009,cream);});
 item('entry-rug','驼色入户毯 · 80×100 cm','entry',[2.70,1.47,.012],0,[.8,1,.008],'image_selected',({box})=>{box('地毯',0,0,.004,.8,1,.008,'#aa8a58');for(let i=0;i<25;i++)box('编织条纹',0,-.48+i*.04,.008,.78,.004,.001,'#c0a273');});
 item('bay-mat','焦糖飘窗毯 · 150×50 cm（折边约3 cm）','small',[-.23,7.705,.553],0,[.5,1.5,.008],'image_selected_duplicate_deduplicated',({box})=>{box('平铺147cm',0,0,.004,.5,1.47,.008,'#a37a4d');box('3cm折边',0,-.72,.012,.5,.03,.008,'#987046');for(let i=0;i<35;i++)box('编织条纹',0,-.7+i*.04,.008,.48,.004,.001,'#b59564');});
 return {meshes,catalog};
}
