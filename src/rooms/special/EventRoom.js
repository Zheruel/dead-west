// Event room host (EVENTS s3, room type `event`, template `event_<id>`): a dead-end "?" room with a prop and one event controller.
// The host owns everything shared (banner, bobbing prop / placeholder, `event:started`) and hosts the event controller looked up in
// ./events/<PascalCase id>.js (FE-V1). Events persist ONLY in `state` = room.state.event = { id, uses, net, done, data }.
// A missing or crashing event controller never breaks the room: the prop stays and the room is a quiet dead end.
import Controller from './Controller.js';
import { ROOM, TILE, DEPTH, actorDepth, tileToWorld, FONT_TITLE } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { bus } from '../../core/events.js';

const MODULES = import.meta.glob('./events/*.js', { eager: true });
const NAMES = {
  card_sharp: 'THE CARD SHARP', wishing_well: 'THE WISHING WELL', gravedigger: 'GRAVE ROBBING', preacher: 'THE CONFESSIONAL',
  snake_oil: 'THE SNAKE-OIL SALESMAN', quick_draw: "THE DEAD MAN'S DUEL",
};
const PROP = { card_sharp: 'card_table', wishing_well: 'well', gravedigger: 'grave_mound', preacher: 'confessional', snake_oil: 'wagon_oil', quick_draw: 'duel_post' };
const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/** id -> controller class, from the file names (CardSharp.js -> card_sharp) or a `static id`. */
const REGISTRY = {};
for (const [path, mod] of Object.entries(MODULES)) {
  const C = mod.default;
  if (typeof C !== 'function') continue;
  const file = path.split('/').pop().replace(/\.js$/, '');
  REGISTRY[C.id || snake(file)] = C;
}

export const eventName = (id) => NAMES[id] || String(id || 'EVENT').toUpperCase().replace(/_/g, ' ');

export default class EventRoom extends Controller {
  build() {
    const { scene, room, state } = this;
    state.id = state.id || this.def.event;
    state.uses = state.uses || 0;
    state.net = state.net || 0;
    state.done = !!state.done;
    state.data = state.data || {};
    this.id = state.id;
    this.sub = null;
    const k = ((room.tpl && room.tpl.slots && room.tpl.slots.K) || [])[0];
    const at = k ? tileToWorld(k.c, k.r) : tileToWorld(6, 2);
    this.baseY = at.y + TILE / 2;
    this.prop = this.makeProp(at.x, this.baseY);
    const C = REGISTRY[this.id];
    if (!C) return;
    try {
      const sub = new C(room, this.def, state);
      sub.host = this;
      sub.prop = this.prop;
      sub.build();
      this.sub = sub;
    } catch (e) {
      console.error(`[EventRoom] event '${this.id}' failed to build`, e);
      this.sub = null;
    }
  }

  /** Bobbing prop: `props_events` art when it exists, otherwise a code-drawn stand-in with a big "?". */
  makeProp(x, bottom) {
    const scene = this.scene;
    const name = PROP[this.id];
    let im;
    if (name && Assets.has('props_events')) im = Assets.makeCell(scene, x, bottom, 'props_events', name, 1);
    else im = scene.add.image(x, bottom, propTexture(scene)).setOrigin(0.5, 1);
    im.setDepth(actorDepth(bottom));
    return this.track(im);
  }

  onEnter() {
    const { state } = this;
    if (!state.started) { state.started = true; bus.emit('event:started', { id: this.id }); }
    this.room.banner(`EVENT: ${eventName(this.id)}`, { color: '#f0c860', hold: 1200, size: 40 });
    this.guard('onEnter');
  }

  update(dt) {
    super.update(dt);
    if (this.prop && this.prop.scene) this.prop.y = this.baseY + Math.sin(this.age * 2.2) * 3;
    this.guard('update', dt);
  }

  onCleared() { this.guard('onCleared'); }
  onMiniDefeated(m) { this.guard('onMiniDefeated', m); }

  /** Forward a lifecycle call to the event controller; a throwing event is switched off instead of taking the room down. */
  guard(name, arg) {
    const sub = this.sub;
    if (!sub || sub.failed || typeof sub[name] !== 'function') return;
    try { sub[name](arg); } catch (e) { sub.failed = true; console.error(`[EventRoom] event '${this.id}' ${name} failed`, e); }
  }

  destroy() {
    this.guard('destroy');
    this.sub = null;
    this.prop = null;
    super.destroy();
  }
}
export { EventRoom };

/** Shared 192 px placeholder prop (dark plinth + amber "?"), generated once per texture manager. */
function propTexture(scene) {
  const k = 'ph_event_prop';
  if (scene.textures.exists(k)) return k;
  const t = scene.textures.createCanvas(k, 192, 192);
  const c = t.getContext();
  c.lineJoin = 'round'; c.lineWidth = 5; c.strokeStyle = '#120c0a';
  c.fillStyle = '#4a3428'; c.beginPath(); c.roundRect(34, 96, 124, 88, 14); c.fill(); c.stroke();
  c.fillStyle = '#6b4a34'; c.beginPath(); c.roundRect(24, 84, 144, 26, 10); c.fill(); c.stroke();
  c.fillStyle = '#f0c860'; c.font = `bold 84px ${FONT_TITLE}, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.strokeText('?', 96, 44); c.fillText('?', 96, 44);
  t.refresh();
  return k;
}
