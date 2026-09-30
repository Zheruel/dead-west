// Shared helpers of the event controllers and the secret variants (FE-V1): slot lookup, art-or-placeholder props, code-drawn playing cards,
// floor-scoped buffs and the `EventBase` controller (state.data access, event:done bookkeeping, pickups that survive a mid-action room exit).
// Named exports only: EventRoom registers controllers from the DEFAULT export of the other files in this folder.
import Controller from '../Controller.js';
import HoldRing from '../../../entities/HoldRing.js';
import { ROOM, DEPTH, FONT_TITLE, FONT_BODY, tileToWorld, actorDepth } from '../../../config.js';
import { Assets } from '../../../core/Assets.js';
import { bus } from '../../../core/events.js';
import { EVENT_LINES } from '../../../data/story/dialogue.js';

export const CARD_W = 88;
export const CARD_H = 124;
const INK = '#120c0a';

/** World points of template markers (`I`, `C`, `K`, ...) sorted left to right, then top to bottom; `fallback` = [[c, r], ...] when the template has none. */
export function slotPoints(room, key, fallback = []) {
  const list = ((room.tpl && room.tpl.slots && room.tpl.slots[key]) || []).slice().sort((a, b) => a.c - b.c || a.r - b.r);
  const src = list.length ? list.map((s) => [s.c, s.r]) : fallback;
  return src.map(([c, r]) => tileToWorld(c, r));
}

// ---------------------------------------------------------------------------------------------------------------- spoken lines (STORY 11.3)
/** Spoken / caption line `key` of event `ev` (EVENT_LINES); arrays are variants (`r` = rng picks one, else the first). '' when missing. */
export function eventLine(ev, key, r = null) {
  const v = EVENT_LINES[ev] && EVENT_LINES[ev][key];
  if (Array.isArray(v)) return r ? r.pick(v) : v[0];
  return v || '';
}

/**
 * Parchment speech tag (code-drawn, no art): wrapped text on a tag whose bottom-centre sits at (x, y), clamped to the play area, held `hold` ms
 * then faded. Tracked by the room (destroyed with it). Returns the container (caller may destroy a previous one).
 */
export function speechTag(scene, room, x, y, text, { color = '#2a1a10', hold = 3200, size = 20, wrap = 440 } = {}) {
  const t = scene.add.text(0, 0, text, { fontFamily: FONT_BODY, fontSize: `${size}px`, color, wordWrap: { width: wrap }, align: 'left', lineSpacing: 2 }).setOrigin(0, 0);
  const PX = 14, PY = 9;
  const w = Math.ceil(t.width) + PX * 2, h = Math.ceil(t.height) + PY * 2;
  const left = Math.max(ROOM.x + 8, Math.min(ROOM.right - w - 8, x - w / 2));
  const top = Math.max(ROOM.y + 8, y - h);
  const tail = Math.max(left + 14, Math.min(left + w - 14, x));
  const g = scene.add.graphics();
  g.fillStyle(0x120c0a, 0.35); g.fillRoundedRect(left + 3, top + 4, w, h, 6);
  g.fillStyle(0xe6d2a0, 1); g.fillRoundedRect(left, top, w, h, 6);
  g.lineStyle(2, 0x6b4423, 1); g.strokeRoundedRect(left, top, w, h, 6);
  g.fillStyle(0xe6d2a0, 1); g.fillTriangle(tail - 8, top + h - 1, tail + 8, top + h - 1, tail, top + h + 9);
  g.lineStyle(2, 0x6b4423, 1); g.beginPath(); g.moveTo(tail - 8, top + h); g.lineTo(tail, top + h + 9); g.lineTo(tail + 8, top + h); g.strokePath();
  t.setPosition(left + PX, top + PY);
  const box = scene.add.container(0, 0, [g, t]).setDepth(DEPTH.fx + 30).setAlpha(0);
  box.once('destroy', () => scene.tweens.killTweensOf(box));
  scene.tweens.add({ targets: box, alpha: 1, duration: 140 });
  scene.tweens.add({ targets: box, alpha: 0, delay: hold, duration: 300, onComplete: () => { if (box.scene) box.destroy(); } });
  return room.track(box);
}

// ---------------------------------------------------------------------------------------------------------------- placeholders
/** Canvas texture created once per texture manager. */
export function phTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, w, h);
  const c = t.getContext();
  c.lineJoin = 'round';
  draw(c, w, h);
  t.refresh();
  return key;
}

/**
 * Prop / icon image: the real sheet cell when the sheet is loaded, else a generated stand-in (`draw(ctx, w, h)`, `w x h` canvas).
 * `bottom` anchors sheet props at their feet (sheets are bottom anchored); returns the image.
 */
export function cellOr(scene, sheet, name, x, y, { scale = 1, origin = 1, size = [96, 96], draw = null } = {}) {
  if (Assets.has(sheet)) return Assets.makeCell(scene, x, y, sheet, name, origin).setScale(scale);
  const [w, h] = size;
  const key = phTexture(scene, `ph_${sheet}_${name}`, w, h, draw || ((c) => {
    c.fillStyle = '#4a3428'; c.strokeStyle = INK; c.lineWidth = 5;
    c.beginPath(); c.roundRect(8, 8, w - 16, h - 16, 12); c.fill(); c.stroke();
    c.fillStyle = '#e8dcc0'; c.font = `bold ${Math.round(h / 4)}px ${FONT_BODY}, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(name.replace(/_/g, ' ').slice(0, 10), w / 2, h / 2);
  }));
  return scene.add.image(x, y, key).setOrigin(0.5, origin).setScale(scale);
}

/** Persistent label (does not fade). */
export function label(scene, room, x, y, text, { color = '#e8dcc0', size = 22, depth = DEPTH.fx - 20 } = {}) {
  const t = scene.add.text(x, y, text, { fontFamily: FONT_BODY, fontSize: `${size}px`, color, stroke: INK, strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(depth);
  room.track(t);
  return t;
}

// ---------------------------------------------------------------------------------------------------------------- playing cards
const SUIT_COLOR = { S: '#1a1410', C: '#1a1410', H: '#b02a20', D: '#b02a20' };

function suitPath(c, suit, cx, cy, s) {
  c.beginPath();
  if (suit === 'H') {
    c.moveTo(cx, cy + s * 0.95);
    c.bezierCurveTo(cx + s * 1.5, cy + s * 0.05, cx + s * 0.85, cy - s * 0.95, cx, cy - s * 0.35);
    c.bezierCurveTo(cx - s * 0.85, cy - s * 0.95, cx - s * 1.5, cy + s * 0.05, cx, cy + s * 0.95);
  } else if (suit === 'D') {
    c.moveTo(cx, cy - s); c.lineTo(cx + s * 0.75, cy); c.lineTo(cx, cy + s); c.lineTo(cx - s * 0.75, cy);
  } else if (suit === 'S') {
    c.moveTo(cx, cy - s * 0.95);
    c.bezierCurveTo(cx + s * 1.5, cy - s * 0.05, cx + s * 0.85, cy + s * 0.9, cx, cy + s * 0.35);
    c.bezierCurveTo(cx - s * 0.85, cy + s * 0.9, cx - s * 1.5, cy - s * 0.05, cx, cy - s * 0.95);
    c.moveTo(cx, cy + s * 0.2); c.lineTo(cx + s * 0.45, cy + s); c.lineTo(cx - s * 0.45, cy + s);
  } else {
    c.arc(cx, cy - s * 0.45, s * 0.42, 0, 7); c.moveTo(cx + s * 0.85, cy + s * 0.2);
    c.arc(cx + s * 0.5, cy + s * 0.2, s * 0.42, 0, 7); c.moveTo(cx - s * 0.08, cy + s * 0.2);
    c.arc(cx - s * 0.5, cy + s * 0.2, s * 0.42, 0, 7);
    c.moveTo(cx, cy); c.lineTo(cx + s * 0.32, cy + s); c.lineTo(cx - s * 0.32, cy + s);
  }
  c.closePath();
}

const rankText = (n) => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[n] || String(n));

/** Texture key of the face of a card (rank 2..14, suit S|H|D|C): cream rounded rect, corner rank + suit, big centre suit. */
export function cardFace(scene, rank, suit) {
  return phTexture(scene, `ph_card_${rank}_${suit}`, CARD_W, CARD_H, (c) => {
    c.fillStyle = '#efe4c8'; c.strokeStyle = INK; c.lineWidth = 5;
    c.beginPath(); c.roundRect(3, 3, CARD_W - 6, CARD_H - 6, 10); c.fill(); c.stroke();
    c.fillStyle = SUIT_COLOR[suit]; c.font = `bold 26px ${FONT_TITLE}, Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(rankText(rank), 20, 24);
    suitPath(c, suit, 20, 48, 8); c.fill();
    c.save(); c.translate(CARD_W, CARD_H); c.rotate(Math.PI);
    c.fillText(rankText(rank), 20, 24); suitPath(c, suit, 20, 48, 8); c.fill();
    c.restore();
    suitPath(c, suit, CARD_W / 2, CARD_H / 2 + 2, 20); c.fill(); c.lineWidth = 2; c.stroke();
  });
}

/** Texture key of the card back (deep red with a bone lattice). */
export function cardBack(scene) {
  return phTexture(scene, 'ph_card_back', CARD_W, CARD_H, (c) => {
    c.fillStyle = '#7a1c1c'; c.strokeStyle = INK; c.lineWidth = 5;
    c.beginPath(); c.roundRect(3, 3, CARD_W - 6, CARD_H - 6, 10); c.fill(); c.stroke();
    c.strokeStyle = '#d8c89a'; c.lineWidth = 2;
    for (let i = -6; i < 8; i++) { c.beginPath(); c.moveTo(i * 16, 8); c.lineTo(i * 16 + 110, CARD_H - 8); c.moveTo(i * 16 + 110, 8); c.lineTo(i * 16, CARD_H - 8); c.stroke(); }
    c.fillStyle = '#e8dcc0'; c.beginPath(); c.arc(CARD_W / 2, CARD_H / 2, 13, 0, 7); c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(CARD_W / 2 - 5, CARD_H / 2 - 2, 3, 0, 7); c.arc(CARD_W / 2 + 5, CARD_H / 2 - 2, 3, 0, 7); c.fill();
  });
}

/** Squash flip: scaleX -> 0, swap texture, back. Returns the tween. */
export function flipCard(scene, img, toTexture, ms = 170) {
  scene.tweens.killTweensOf(img);
  const sx = img.scaleX || 1;
  return scene.tweens.add({ targets: img, scaleX: 0, duration: ms, ease: 'Sine.easeIn', yoyo: true, onYoyo: () => { if (img.scene) img.setTexture(toTexture); }, onComplete: () => { if (img.scene) img.setScale(sx, img.scaleY); } });
}

// ---------------------------------------------------------------------------------------------------------------- buffs
const floorBuffs = new WeakMap(); // player -> Set of buff ids removed on floor:changed
/** Player buff that ends with the floor (or after `secs`). apply(stats). */
export function addFloorBuff(scene, player, id, apply, secs = Infinity) {
  player.addBuff(id, apply, secs);
  let set = floorBuffs.get(player);
  if (!set) {
    set = new Set();
    floorBuffs.set(player, set);
    bus.scoped(scene, 'floor:changed', () => { for (const b of set) player.removeBuff(b); set.clear(); });
  }
  set.add(id);
}

// ---------------------------------------------------------------------------------------------------------------- base controller
export class EventBase extends Controller {
  get data() { return this.state.data || (this.state.data = {}); }
  get eventId() { return this.state.id; }
  /** Sorted world points of a marker key. */
  spots(key, fallback) { return slotPoints(this.room, key, fallback); }

  /** Register a HoldRing (Room ticks / destroys it). */
  ring(o) { const r = new HoldRing(this.room, o); (this.rings || (this.rings = [])).push(r); return r; }
  /** Persistent world label. */
  label(x, y, text, o) { return label(this.scene, this.room, x, y, text, o); }
  /** World point of the NPC's speech tag (bottom-centre): above the K prop. */
  voicePos() { const k = this.spots('K', [[6, 2]])[0]; return { x: k.x, y: k.y - 150 }; }
  /**
   * Speak STORY line `key` of this event (or of `o.ev`) in a parchment tag; `o.text` overrides the lookup, `o.delay` ms defers it, `o.at` = {x, y}.
   * One tag per controller at a time (a new line replaces the previous one). No-op while the room is being torn down.
   */
  speak(key, o = {}) {
    const stamp = this._spoke || 0;
    const go = () => {
      if (this.tearing || this.destroyed || this.room.destroyed) return null;
      if (key === 'greet' && (this._spoke || 0) !== stamp) return null; // a greeting never talks over a line spoken meanwhile (player rushed the event)
      this._spoke = (this._spoke || 0) + 1;
      const text = o.text || eventLine(o.ev || this.eventId, key, this.rng(`line-${key}`, o.n || 0));
      if (!text) return null;
      if (this.voice && this.voice.scene) this.voice.destroy();
      const at = o.at || this.voicePos();
      this.voice = speechTag(this.scene, this.room, at.x, at.y, text, { color: o.color, hold: o.hold });
      return this.voice;
    };
    if (o.delay) { this.later(o.delay, go); return null; }
    return go();
  }
  /** Short floating text. */
  say(x, y, text, color = '#e8dcc0', size = 26) { this.scene.fx.text(x, y, text, { color, size }); }

  /** The event's last action resolved: `event:done` (once). */
  finish(outcome) {
    const st = this.state;
    st.done = true;
    if (st.counted) return;
    st.counted = true;
    bus.emit('event:done', { id: st.id, outcome, net: st.net || 0 });
  }

  /** Pickup that also works while the room is being torn down (written to the room state instead of spawned). */
  pickup(type, x, y, o) {
    if (this.tearing || this.room.destroyed) { this.room.state.pickups.push({ type, x, y }); return null; }
    return this.room.dropPickup(type, x, y, o);
  }
  /** Pedestal that also works during teardown. */
  pedestal(rec) {
    const full = { price: null, group: null, taken: false, ...rec };
    if (this.tearing || this.room.destroyed) { this.room.state.pedestals.push(full); return null; }
    return this.room.spawnPedestal(full);
  }

  /** Called when the player leaves with the event only partly used: it still counts once. */
  onLeave() {}

  destroy() {
    this.tearing = true;
    try { this.onLeave(); } catch (e) { console.error(e); }
    const st = this.state;
    if (!st.counted && (st.uses || 0) > 0) { st.counted = true; bus.emit('event:done', { id: st.id, outcome: 'left', net: st.net || 0 }); }
    for (const r of this.rings || []) r.destroy();
    super.destroy();
  }
}

export { ROOM, DEPTH, FONT_TITLE, FONT_BODY, tileToWorld, actorDepth, HoldRing };
