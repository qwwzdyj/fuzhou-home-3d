import test from 'node:test';import assert from 'node:assert/strict';
import {defaultDesks,decodeDesks,deskLayout,overlapRect} from './desk-plan.mjs';
import {createDeskMeshes} from './desk-geometry.mjs';
const room=[0,2.24,6.67,8.75];
test('two 100cm desks fit with 2cm middle gap and 22cm total side allowance',()=>{
 const r=deskLayout(room,defaultDesks());assert.equal(r.fits,true);assert.equal(r.span,2.02);assert.equal(r.remaining.toFixed(2),'0.22');
 assert.equal(r.desks[0].rect[0].toFixed(2),'0.11');assert.equal(r.desks[1].rect[1].toFixed(2),'2.13');assert.equal(r.frontDepth.toFixed(2),'1.46');
});
test('120 and 140cm pairs do not silently shrink to fit',()=>{
 for(const w of [1.2,1.4]){const r=deskLayout(room,{enabled:true,widths:[w,w]});assert.equal(r.fits,false);assert.equal(r.desks[0].width,w);assert.ok(r.remaining<0);}
});
test('mixed 100+120cm leaves only 2cm total before site uncertainty',()=>assert.equal(deskLayout(room,{enabled:true,widths:[1,1.2]}).remaining.toFixed(2),'0.02'));
test('desk bounds stay along the main-bedroom partition',()=>{for(const d of deskLayout(room,defaultDesks()).desks){assert.equal(d.rect[3],8.73);assert.equal((d.rect[3]-d.rect[2]).toFixed(2),'0.60');}});
test('plan data is validated, copied and old plans remain valid',()=>{
 assert.equal(decodeDesks(undefined),undefined);const source=defaultDesks(),out=decodeDesks(source);out.widths[0]=1.4;assert.equal(source.widths[0],1);
 for(const raw of [null,{},[],{enabled:1,widths:[1,1]},{enabled:true,widths:[1,2]},{enabled:true,widths:[1]},{enabled:true,widths:[NaN,1]}])assert.throws(()=>decodeDesks(raw));
});
test('bed footprint overlaps desks; a clear floor does not',()=>{const d=deskLayout(room,defaultDesks()).desks[0];assert.equal(overlapRect(d.rect,[.07,2.07,7.47,8.67]),true);assert.equal(overlapRect(d.rect,[.1,2.1,6.7,7.9]),false);});
test('both desks are editable complete assemblies with exact external dimensions',()=>{
 const r=createDeskMeshes(room,defaultDesks());assert.equal(r.meshes.length,26);
 for(const id of ['proposed-desk-a','proposed-desk-b']){
  const parts=r.meshes.filter(m=>m.userData.asset_id===id);assert.equal(parts.length,13);
  for(const part of parts){assert.equal(part.userData.editable_furniture,true);assert.equal(part.userData.proposed_desk,true);}
  const top=parts.find(p=>p.name.endsWith('桌板'));assert.equal(top.geometry.parameters.width,1);assert.equal(top.geometry.parameters.depth,.6);assert.equal(top.position.y+top.geometry.parameters.height/2,.75);
 }
 for(const m of r.meshes){m.geometry.dispose();m.material.dispose();}
});
