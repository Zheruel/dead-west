// Boss registry + design metadata (no class imports -> safe for type files to import).
export const BOSS_META = {
  cascabel: { name: 'EL CASCABEL', title: 'The Rattle Before The Bite', hp: 260, r: 105, floor: 1, portrait: 'portrait_cascabel', music: 'boss', speed: 0 },
  grimm: { name: 'MARSHAL GRIMM', title: 'The Law Never Sleeps', hp: 420, r: 62, floor: 2, portrait: 'portrait_grimm', music: 'boss', speed: 110 },
  undertaker: { name: 'THE UNDERTAKER', title: 'Last Rites For The Living', hp: 650, r: 70, floor: 3, portrait: 'portrait_undertaker', music: 'boss_final', speed: 90 },
};
const reg = new Map();

/** registerBoss('cascabel', CascabelClass, { name, title, hp, r, portrait, music, ... }) */
export function registerBoss(id, Class, meta = {}) {
  reg.set(id, { Class, meta: { ...(BOSS_META[id] || {}), ...meta } });
}
export const getBoss = (id) => reg.get(id);
export const bossMeta = (id) => (reg.get(id) ? reg.get(id).meta : BOSS_META[id]) || null;
