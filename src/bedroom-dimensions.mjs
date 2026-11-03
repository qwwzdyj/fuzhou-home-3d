// Read room dimensions from the same rectangles used for navigation and the model.
// Room areas are rectangular model footprints, not certified floor areas.
const definitions = [
  {id:'small', name:'小卧室 / 次卧', doorKey:'small_door_width', color:'#285343'},
  {id:'main', name:'阳台卧室 / 主卧', doorKey:'main_door_width', color:'#956333'},
];
export function bedroomDimensions(rooms, metadata) {
  return definitions.filter(d=>rooms[d.id]).map(d=>{
    const rect=[...rooms[d.id].rect], [x0,x1,y0,y1]=rect;
    if(rect.length!==4||!rect.every(Number.isFinite)||x1<=x0||y1<=y0) throw new Error('卧室边界无效');
    const width=x1-x0, depth=y1-y0, door=metadata[d.doorKey];
    return {...d, rect, width, depth, area:width*depth,
      height:metadata.room_height?.value_m,
      doorWidth:door?.value_m,
      doorConfirmed:['owner_confirmed','user_reported_confirmed_quantity'].includes(door?.status),
      status:'model_reference',
    };
  });
}
export function bedroomDimensionSegments(rect) {
  const [x0,x1,y0,y1]=rect, offset=.28, z=.12;
  return [
    {axis:'width',name:'宽',start:[x0,y0-offset,z],end:[x1,y0-offset,z],value:x1-x0,
      extensions:[[[x0,y0,z],[x0,y0-offset-.12,z]],[[x1,y0,z],[x1,y0-offset-.12,z]]]},
    {axis:'depth',name:'深',start:[x0-offset,y0,z],end:[x0-offset,y1,z],value:y1-y0,
      extensions:[[[x0,y0,z],[x0-offset-.12,y0,z]],[[x0,y1,z],[x0-offset-.12,y1,z]]]},
  ];
}
