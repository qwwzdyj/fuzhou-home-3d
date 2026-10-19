import {Vector3, Quaternion, MathUtils} from 'three';
const up = new Vector3(0, 1, 0);
export function poseDoor(meta, basePosition, baseQuaternion, value) {
  const position = basePosition.clone(), quaternion = baseQuaternion.clone();
  if (meta.door_role !== 'leaf') return {position, quaternion};
  const delta = MathUtils.clamp(value, 0, 1) - meta.door_default;
  if (meta.door_kind === 'sliding') position.x += delta * meta.door_travel;
  else {
    const [x,y,z] = meta.door_pivot, pivot = new Vector3(x,z,-y);
    const q = new Quaternion().setFromAxisAngle(up, MathUtils.degToRad(delta * meta.door_max_angle));
    position.sub(pivot).applyQuaternion(q).add(pivot); quaternion.premultiply(q);
  }
  return {position, quaternion};
}
export function doorSnapshot(doors) {return Object.fromEntries([...doors].map(([id,d])=>[id,d.target]));}
export function decodeDoors(raw, knownIds) {
  if (raw === undefined) return undefined;
  if (!raw || Array.isArray(raw) || typeof raw !== 'object' || Object.keys(raw).length > 20) throw new Error('门状态无效');
  for (const [id,v] of Object.entries(raw)) if (!knownIds.has(id) || !Number.isFinite(v) || v<0 || v>1) throw new Error('门状态或开合比例无效');
  return {...raw};
}
