import test from 'node:test';
import assert from 'node:assert/strict';
import {bedroomDimensions,bedroomDimensionSegments} from './bedroom-dimensions.mjs';
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
