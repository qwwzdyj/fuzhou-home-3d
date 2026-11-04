import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {defaultFurnishing,decodeFurnishing,migrateRemovals,BASE_REMOVALS} from './furnishing-plan.mjs';
import {createFurnishing} from './furnishing-geometry.mjs';
import {decodePlan,pushHistory,PLAN_SCHEMA} from './edit-state.mjs';
import {createDeskMeshes} from './desk-geometry.mjs';
const build=()=>createFurnishing(defaultFurnishing());
test('migrate nine removals without losing more recent removals',()=>{assert.equal(migrateRemovals(null).length,9);const d=migrateRemovals({deleted:['toilet','small-bed']});assert.equal(d.length,10);assert.ok(d.includes('toilet'));assert.ok(!d.includes('main-bed'));});
test('explicit v06 restoration remains restored after reload',()=>assert.deepEqual(migrateRemovals({deleted:[],furnishing:defaultFurnishing()}),[]));
test('invalid furnishing settings rejected',()=>{for(const p of [null,{},[],{enabled:true,diameter:9},{enabled:'true',diameter:.9}])assert.throws(()=>decodeFurnishing(p));assert.equal(decodeFurnishing(undefined),undefined);});
test('round trip and undo clone furnishing state',()=>{const furnishing=defaultFurnishing();const p=decodePlan({schema:PLAN_SCHEMA,deleted:[],furnishing},new Set());assert.deepEqual(p.furnishing,furnishing);const h=[];pushHistory(h,new Set(BASE_REMOVALS),{}, {enabled:true,widths:[1,1]},furnishing);furnishing.diameter=1.2;assert.equal(h[0].furnishing.diameter,.9);});
test('all new assemblies editable, named and finite',()=>{const b=build();assert.equal(b.catalog.length,20);for(const m of b.meshes){assert.ok(m.userData.new_furnishing);assert.ok(m.userData.editable_furniture);assert.ok(m.name);assert.ok([...m.position.toArray(),...m.scale.toArray()].every(Number.isFinite));}assert.equal(new Set(b.meshes.map(m=>m.userData.asset_id)).size,b.catalog.length);});
function bounds(b,id){const result=new THREE.Box3();for(const m of b.meshes.filter(m=>m.userData.asset_id===id)){m.updateMatrixWorld();result.expandByObject(m);}return result;}
test('round table is 90 cm diameter and 75 cm high',()=>{const a=bounds(build(),'new-dining-table'),s=a.getSize(new THREE.Vector3());assert.ok(Math.abs(s.x-.9)<1e-6);assert.ok(Math.abs(s.z-.9)<1e-6);assert.ok(Math.abs(a.max.y-.75)<1e-6);});
test('living floor furniture leaves right-side corridor clear for every table option',()=>{for(const diameter of [.8,.9,1,1.1,1.2]){const b=createFurnishing({enabled:true,diameter});for(const id of ['new-sideboard','new-dining-table','new-dining-chair-a','new-dining-chair-b']){const a=bounds(b,id);assert.ok(a.min.x>=-.001,id);assert.ok(a.max.x<=2.36,id);assert.ok(-a.max.z>=2.37,id);assert.ok(-a.min.z<=5.21,id);}}});
test('study chairs do not intersect desk tabletop footprints',()=>{const b=build();for(const id of ['new-study-chair-a','new-study-chair-b']){const a=bounds(b,id);assert.ok(-a.min.z<8.13);assert.ok(a.min.x>0&&a.max.x<2.24);assert.ok(-a.max.z>7.4);}});
test('side table does not overlap retained main bed and keeps right passage',()=>{const b=bounds(build(),'new-side-table');assert.ok(-b.max.z>10.25);assert.ok(b.max.x<2.24);});
test('duplicate mat images are not counted twice and two-pack bins is two',()=>{const c=build().catalog;assert.equal(c.filter(a=>a.id.includes('bay-mat')).length,1);assert.equal(c.filter(a=>a.id.includes('bin-')).length,2);});
test('desks use walnut tops and black steel legs',()=>{const b=createDeskMeshes([0,2.24,6.67,8.75],{enabled:true,widths:[1,1]});assert.equal(b.meshes.find(m=>m.name.endsWith('桌板')).material.color.getHexString(),'60402d');assert.equal(b.meshes.find(m=>m.name.includes('钢腿')).material.color.getHexString(),'232526');});

test('kitchen cart is outside the kitchen door swing radius',()=>{const b=bounds(build(),'new-cart');const x=Math.min(b.max.x,Math.max(b.min.x,2.135)),y=Math.min(-b.min.z,Math.max(-b.max.z,1.165));assert.ok(Math.hypot(x-2.135,y-1.165)>.72);});
