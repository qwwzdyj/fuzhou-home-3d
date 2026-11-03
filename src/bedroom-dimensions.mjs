// Read room dimensions from the same rectangles used for navigation and the model.
// Room areas are rectangular model footprints, not certified floor areas.
const definitions = [
  {id:'small', name:'小卧室 / 次卧', doorKey:'small_door_width', heightKey:'room_height', color:'#285343',note:'不含飘窗；不是扣除家具后的可用尺寸。'},
  {id:'main', name:'阳台卧室 / 主卧', doorKey:'main_door_width', heightKey:'room_height', color:'#956333',note:'不含相邻阳台；不是扣除家具后的可用尺寸。'},
  {id:'living', name:'客厅 / 小厅', heightKey:'room_height',color:'#366c85',note:'此矩形含右侧通行区域，不能全部作为家具摆放区；不含飘窗。'},
  {id:'balcony', name:'阳台',color:'#537846',note:'进深暂定；未扣除护栏、管道等占位，净高未测。'},
  {id:'kitchen', name:'厨房',heightKey:'kitchen_height',doorKey:'kitchen_door_width',color:'#97773e',note:'矩形尺寸未扣除橱柜与转角凸墙。'},
  {id:'bath', name:'卫生间',heightKey:'bathroom_height',doorKey:'bathroom_door_width',color:'#64768e',note:'矩形尺寸未扣除洁具及设备；短边与净高暂定。'},
  {id:'entry', name:'入户走道',heightKey:'entry_height',doorKey:'front_door_width',color:'#96705b',note:'模型通行范围，未扣除门扇开启范围。'},
  {id:'corridor', name:'后段走道',heightKey:'room_height',color:'#78668a',note:'走道尺寸待现场闭合；未扣除各房门的开启范围。'},
];
export function bedroomDimensions(rooms, metadata) {
  return roomDimensions(rooms,metadata).filter(r=>['small','main'].includes(r.id));
}
export function roomDimensions(rooms, metadata) {
  return definitions.filter(d=>rooms[d.id]).map(d=>{
    const rect=[...rooms[d.id].rect], [x0,x1,y0,y1]=rect;
    if(rect.length!==4||!rect.every(Number.isFinite)||x1<=x0||y1<=y0) throw new Error('卧室边界无效');
    const width=x1-x0, depth=y1-y0, door=metadata[d.doorKey];
    return {...d, rect, width, depth, area:width*depth,
      height:metadata[d.heightKey]?.value_m,
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
