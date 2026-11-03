// Two provisional desks along the small bedroom wall shared with the main bedroom.
export const DESK_IDS=['proposed-desk-a','proposed-desk-b'];
export const DESK_DEPTH=.60,DESK_HEIGHT=.75,DESK_GAP=.02,DESK_BACK_GAP=.02;
export function defaultDesks(){return {enabled:true,widths:[1,1]};}
export function decodeDesks(raw){
 if(raw===undefined)return undefined;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof raw.enabled!=='boolean'||!Array.isArray(raw.widths)||raw.widths.length!==2||!raw.widths.every(w=>[1,1.2,1.4].includes(w)))throw new Error('双桌方案无效：每张桌长只支持 100 / 120 / 140 cm');
 return {enabled:raw.enabled,widths:[...raw.widths]};
}
export function deskLayout(rect, config){
 const [x0,x1,y0,y1]=rect,total=config.widths[0]+config.widths[1]+DESK_GAP;
 const start=x0+(x1-x0-total)/2,back=y1-DESK_BACK_GAP;
 return {span:total,remaining:x1-x0-total,frontDepth:back-DESK_DEPTH-y0,
  fits:total<=x1-x0+1e-8&&DESK_DEPTH+DESK_BACK_GAP<=y1-y0,
  desks:config.widths.map((width,i)=>{const x=start+(i===1?config.widths[0]+DESK_GAP:0);return {id:DESK_IDS[i],width,depth:DESK_DEPTH,height:DESK_HEIGHT,rect:[x,x+width,back-DESK_DEPTH,back]};}),
 };
}
export function overlapRect(a,b){return Math.min(a[1],b[1])-Math.max(a[0],b[0])>1e-6&&Math.min(a[3],b[3])-Math.max(a[2],b[2])>1e-6;}
