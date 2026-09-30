// A door in one wall of a room. State is derived: hidden (unrevealed secret) | locked (needs key) | closed (encounter) | open.
// Kinds: normal | treasure | boss | secret | champion (boss frames tinted gold-red, WANTED poster pinned beside it on the side that leads in).
import { DOORS, DEPTH, ROOM_TYPES } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';

export default class Door {
  /** data = floor.rooms[i].doors[dir] : {to, kind, locked?, revealed?} */
  constructor(room, dir, data) {
    this.room = room;
    this.dir = dir;
    this.data = data;
    this.geom = DOORS[dir];
    this.kind = data.kind;
    this.to = data.to;
    this.sprite = Assets.makeCell(room.scene, this.geom.x, this.geom.y, 'doors', 'door_open', 0.5);
    this.sprite.setRotation(this.geom.rot).setDepth(DEPTH.floor + 2);
    room.track(this.sprite);
    if (this.kind === 'champion') this.decorateChampion();
    this.lastState = null;
    this.bumpCd = 0;
    this.refresh(false);
  }

  get state() {
    const d = this.data;
    if (d.kind === 'secret' && !d.revealed) return 'hidden';
    if (d.locked) return 'locked';
    if (this.room.locked) return 'closed';
    return 'open';
  }
  get passable() { return this.state === 'open'; }

  frameName() {
    const st = this.state;
    const open = st === 'open';
    switch (this.kind) {
      case 'treasure': return st === 'locked' ? 'door_treasure_locked' : open ? 'door_treasure_open' : 'door_closed';
      case 'boss': case 'champion': return open ? 'door_boss_open' : 'door_boss_closed';
      default: return open ? 'door_open' : 'door_closed';
    }
  }

  /** Champion door: boss frames with a gold-red tint; the room that leads INTO the champion room also gets the WANTED poster beside the frame. */
  decorateChampion() {
    const room = this.room, g = this.geom;
    this.sprite.setTint((ROOM_TYPES.champion && ROOM_TYPES.champion.doorTint) || 0xe0a040);
    if (room.type === 'champion') return;
    const s = room.scene;
    const side = g.dir === 'up' || g.dir === 'down' ? [1, 0] : [0, 1]; // along the wall
    const x = g.x + side[0] * 122 + g.dx * -6, y = g.y + side[1] * 122 + g.dy * -6;
    const poster = Assets.has('props_small')
      ? Assets.makeCell(s, x, y, 'props_small', 'wanted_poster', 0.5).setScale(0.72)
      : s.add.image(x, y, wantedTexture(s)).setScale(0.8);
    poster.setRotation((g.dx + g.dy) * 0.06).setDepth(DEPTH.floor + 3);
    room.track(poster);
  }

  refresh(sound = true) {
    const st = this.state;
    this.sprite.setVisible(st !== 'hidden');
    this.sprite.setFrame(Assets.frame('doors', this.frameName()));
    if (sound && this.lastState && this.lastState !== st) {
      if (st === 'closed') { Sfx.play('door_close', { vol: 0.8 }); this.juice(true); }
      else if (st === 'open' && this.lastState === 'closed') { Sfx.play('door_open', { vol: 0.8 }); this.juice(false); }
    }
    this.lastState = st;
  }

  /** Door state-change flourish: slam = squash-in + dust + small jolt; open = swell + gold glint + dust. */
  juice(slam) {
    const s = this.room.scene, g = this.geom, sp = this.sprite;
    if (!s || !sp || !sp.scene) return;
    const bx = sp.scaleX, by = sp.scaleY;
    sp.setScale(bx * (slam ? 1.14 : 1.07), by * (slam ? 1.14 : 1.07));
    s.tweens.add({ targets: sp, scaleX: bx, scaleY: by, duration: slam ? 170 : 260, ease: slam ? 'Bounce.easeOut' : 'Back.easeOut' });
    const ix = g.x - g.dx * 36, iy = g.y - g.dy * 36; // just inside the room
    s.fx.dust(ix, iy, slam ? 1.1 : 0.9);
    s.fx.burst(ix, iy, { color: [0xb89868, 0x8a7458], count: slam ? 10 : 7, speed: [40, 150], life: [300, 600], scale: [0.08, 0.26], tex: 'glow', alpha: [0.45, 0] });
    if (slam) s.fx.shake(0.004, 110);
    else s.fx.ringPulse(g.x, g.y, 0xf0d080, 54, 380, 0.7);
  }
}

/** Code-drawn WANTED poster (used until `props_small` art exists): torn cream sheet with a horned skull. Generated once. */
function wantedTexture(scene) {
  const key = 'ph_wanted';
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, 64, 80);
  const c = t.getContext();
  c.fillStyle = '#d9c39a'; c.strokeStyle = '#120c0a'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(6, 4); c.lineTo(58, 8); c.lineTo(56, 40); c.lineTo(60, 74); c.lineTo(10, 76); c.lineTo(4, 40); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#3a2418'; c.fillRect(14, 12, 36, 6);
  c.fillStyle = '#120c0a';
  c.beginPath(); c.arc(32, 42, 12, 0, 7); c.fill();
  c.beginPath(); c.moveTo(20, 34); c.lineTo(14, 22); c.lineTo(25, 30); c.fill();
  c.beginPath(); c.moveTo(44, 34); c.lineTo(50, 22); c.lineTo(39, 30); c.fill();
  c.fillStyle = '#d9c39a'; c.fillRect(26, 40, 4, 5); c.fillRect(34, 40, 4, 5);
  c.fillStyle = '#3a2418'; c.fillRect(16, 62, 32, 4);
  t.refresh();
  return key;
}
