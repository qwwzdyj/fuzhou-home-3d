import * as THREE from 'three';
import {bedroomDimensionSegments} from './bedroom-dimensions.mjs';

const to3=([x,y,z])=>new THREE.Vector3(x,z,-y);
export function createBedroomOverlay(bedrooms) {
  const root=new THREE.Group(), groups=new Map(), sprites=[];
  root.name='Bedroom dimension guide (not part of exported model)';
  function line(parent, points, color, opacity=1) {
    const mesh=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false}));
    mesh.renderOrder=20;parent.add(mesh);
  }
  function text(parent, caption, position, color, foreground='#fff') {
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;
    const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(2,2,380,92,15);ctx.fill();
    ctx.fillStyle=foreground;ctx.font='600 36px -apple-system, "PingFang SC", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(caption,192,49);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,toneMapped:false}));
    sprite.position.copy(position);sprite.renderOrder=21;sprite.userData.caption=caption;parent.add(sprite);sprites.push(sprite);
  }
  for(const bedroom of bedrooms) {
    const group=new THREE.Group();groups.set(bedroom.id,group);root.add(group);
    const [x0,x1,y0,y1]=bedroom.rect, color=bedroom.color;
    text(group,bedroom.name,to3([(x0+x1)/2,(y0+y1)/2,.25]),'#fffef1',color);
    line(group,[[x0,y0,.05],[x1,y0,.05],[x1,y1,.05],[x0,y1,.05],[x0,y0,.05]].map(to3),color,.8);
    for(const d of bedroomDimensionSegments(bedroom.rect)) {
      const a=to3(d.start),b=to3(d.end),direction=b.clone().sub(a).normalize();
      const side=new THREE.Vector3(-direction.z,0,direction.x);
      line(group,[a,b],color);
      for(const extension of d.extensions)line(group,extension.map(to3),color,.6);
      // Arrowheads point exactly at the room boundary, not an inset width.
      for(const [tip,sign] of [[a,1],[b,-1]]) {
        const inner=tip.clone().addScaledVector(direction,.12*sign);
        line(group,[inner.clone().addScaledVector(side,.055),tip,inner.clone().addScaledVector(side,-.055)],color);
      }
      text(group,`${d.name} ≈ ${d.value.toFixed(2)} m`,a.clone().lerp(b,.5),color);
    }
  }
  return {
    root,
    update(camera, viewportHeight, visibleIds) {
      for(const [id,g] of groups)g.visible=visibleIds.has(id);
      // Constant screen-size labels remain legible while orbiting or zooming.
      for(const sprite of sprites) {
        const point=sprite.position.clone().applyMatrix4(camera.matrixWorldInverse);
        const unit=2*Math.max(.01,-point.z)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,viewportHeight);
        sprite.scale.set(112*unit,28*unit,1);sprite.visible=point.z<-.03;
      }
    },
  };
}
