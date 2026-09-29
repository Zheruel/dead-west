// A door in one wall of a room. State is derived: hidden (unrevealed secret) | locked (needs key) | closed (encounter) | open.
import { DOORS, DEPTH } from '../config.js';
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
      case 'boss': return open ? 'door_boss_open' : 'door_boss_closed';
      default: return open ? 'door_open' : 'door_closed';
    }
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
