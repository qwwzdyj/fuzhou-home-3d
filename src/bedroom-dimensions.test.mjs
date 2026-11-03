import test from 'node:test';
import assert from 'node:assert/strict';
import {bedroomDimensions,roomDimensions,bedroomDimensionSegments} from './bedroom-dimensions.mjs';
const rooms={small:{rect:[0,2.24,6.67,8.75]},main:{rect:[0,3.2,8.87,11.52]}};
const metadata={room_height:{value_m:2.72},small_door_width:{value_m:.765,status:'user_reported_confirmed_quantity'},main_door_width:{value_m:.805,status:'owner_confirmed'}};
test('bedroom sizes come from model room bounds',()=>{
 const [small,main]=bedroomDimensions(rooms,metadata);
 assert.equal(small.width,2.24);assert.equal(small.depth.toFixed(2),'2.08');assert.equal(small.area.toFixed(2),'4.66');
 assert.equal(main.width,3.2);assert.equal(main.depth.toFixed(2),'2.65');assert.equal(main.area.toFixed(2),'8.48');
 assert.equal(small.height,2.72);assert.equal(small.doorWidth,.765);assert.equal(main.doorWidth,.805);
});
test('confirmed door widths never promote room dimensions to measured',()=>{
 for(const d of bedroomDimensions(rooms,metadata)){assert.equal(d.status,'model_reference');assert.equal(d.doorConfirmed,true);}
 assert.equal(bedroomDimensions(rooms,{})[0].doorConfirmed,false);
});
test('room bounds are copied, not mutated',()=>{const result=bedroomDimensions(rooms,metadata);result[0].rect[0]=100;assert.equal(rooms.small.rect[0],0);});
test('future geometry changes drive all dimension numbers',()=>{const result=bedroomDimensions({small:{rect:[1,3.5,5,8]}},metadata);assert.equal(result[0].width,2.5);assert.equal(result[0].depth,3);});
test('missing bedroom omitted and invalid bounds rejected',()=>{assert.equal(bedroomDimensions({},metadata).length,0);assert.throws(()=>bedroomDimensions({small:{rect:[0,0,1,2]}},metadata));});
test('dimension arrows span true width and depth without adding offset',()=>{
 for(const r of Object.values(rooms))for(const d of bedroomDimensionSegments(r.rect)){
  assert.ok(Math.abs(Math.hypot(...d.end.map((n,i)=>n-d.start[i]))-d.value)<1e-10);
  assert.equal(d.extensions.length,2);
  if(d.axis==='width'){assert.equal(d.start[0],r.rect[0]);assert.equal(d.end[0],r.rect[1]);}
  else {assert.equal(d.start[1],r.rect[2]);assert.equal(d.end[1],r.rect[3]);}
 }
});
const allRooms={...rooms,living:{rect:[0,3.2,2.37,5.21]},balcony:{rect:[0,3.2,11.68,12.76]},kitchen:{rect:[0,2.08,0,2.25]},bath:{rect:[0,2.24,5.33,6.55]},entry:{rect:[2.2,3.2,0,2.37]},corridor:{rect:[2.36,3.2,5.21,8.87]}};
test('all eight spaces have finite model-reference width and depth',()=>{
 const dimensions=roomDimensions(allRooms,metadata);assert.equal(dimensions.length,8);
 for(const d of dimensions){assert.ok([d.width,d.depth,d.area].every(Number.isFinite));assert.equal(d.status,'model_reference');}
 assert.equal(bedroomDimensions(allRooms,metadata).length,2);
});
test('living room includes circulation and balcony does not invent height or door width',()=>{
 const dimensions=roomDimensions(allRooms,metadata), living=dimensions.find(r=>r.id==='living'),balcony=dimensions.find(r=>r.id==='balcony');
 assert.equal(living.width,3.2);assert.equal(living.depth.toFixed(2),'2.84');assert.match(living.note,/通行/);
 assert.equal(balcony.width,3.2);assert.equal(balcony.depth.toFixed(2),'1.08');assert.equal(balcony.height,undefined);assert.equal(balcony.doorWidth,undefined);assert.equal(balcony.doorConfirmed,false);
});
