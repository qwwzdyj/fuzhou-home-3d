import {decodeDoors} from './door-state.mjs';
export const PLAN_SCHEMA = 'fuzhou-home-edit-plan-v1';
export function visibleMesh(meta, mode, furniture, deleted) {
  if (meta.asset_id && (deleted.has(meta.asset_id) || !furniture)) return false;
  if (mode === 'cut' && ['upper', 'open_upper', 'ceil', 'high'].includes(meta.group)) return false;
  if (mode === 'shell' && meta.group === 'ceil') return false;
  return true;
}
export function decodePlan(raw, knownIds, doorIds=new Set()) {
  const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!p || p.schema !== PLAN_SCHEMA || !Array.isArray(p.deleted) || p.deleted.length > 1000) throw new Error('不是支持的家具调整方案');
  if (p.deleted.some(id => typeof id !== 'string' || !knownIds.has(id))) throw new Error('方案包含此模型中不存在的家具');
  const camera = p.camera;
  if (camera && (!['position', 'target'].every(k => Array.isArray(camera[k]) && camera[k].length === 3 && camera[k].every(v => Number.isFinite(v) && Math.abs(v) < 200)))) throw new Error('相机坐标无效');
  const view=p.view;
  if(view && (!['cut','shell','full'].includes(view.mode) || !['orbit','pan','fly'].includes(view.nav) || !Number.isFinite(view.fov) || view.fov<15 || view.fov>100)) throw new Error('视图设置无效');
  const doors=decodeDoors(p.doors,doorIds);
  return { ...(doors===undefined?{}:{doors}), deleted: [...new Set(p.deleted)], camera, view };
}
export function pushHistory(history, deleted, doors) {
  history.push(doors ? {deleted:[...deleted], doors:{...doors}} : [...deleted]);
  if (history.length > 50) history.shift();
}
