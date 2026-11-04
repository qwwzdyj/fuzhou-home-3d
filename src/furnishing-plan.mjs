// User's nine removals, preserved as a baseline; newer browser removals are merged.
export const BASE_REMOVALS=['coat-rack','folding-table','living-wardrobe-a','living-wardrobe-b','small-bed','main-wardrobe','wood-table-shelf','white-table','standing-mirror'];
export function defaultFurnishing(){return {enabled:true,diameter:.9};}
export function decodeFurnishing(p){if(p===undefined)return undefined;if(!p||typeof p.enabled!=='boolean'||![.8,.9,1,1.1,1.2].includes(p.diameter))throw new Error('新家具方案参数无效');return {enabled:p.enabled,diameter:p.diameter};}
export function migrateRemovals(p){return [...new Set([...(p?.deleted||[]),...(p?.furnishing===undefined?BASE_REMOVALS:[])])];}
