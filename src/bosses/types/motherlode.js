// MINI-BOSS 3 - THE MOTHERLODE (mound of silver ore around a miner's skeleton, floor 3, HP 280, EVENTS s4.3). Strip enemy_motherlode (0-3 shamble, 4 hoists a boulder,
// 5 slams). Slow (50 px/s): creeps toward you until ~250 px, turns slowly (so you can get round the side).
//  * rock_lob - 0.5 s hoist, then 4 rocks fall on red discs (r70) after 1.0 s: on the player + 3 spread points, 1 dmg each.
//  * cart_ram - a red band (96 px, 1.0 s) on your tile row, then a minecart sweeps the row at 900 px/s: 2 dmg, smashes breakables.
//  * phase 2 (< 50 %): silver crystals grow - hits inside the FRONT CONE (60 deg, drawn on the floor) do x0.6 (miner rule, explosions ignore it);
//    `rock_lob` throws 6 rocks and each volley calls 2 bats (max 4 alive).
import MiniBase, { ROOM, TILE, TAU } from '../parts/MiniBase.js';
import { registerBoss } from '../registry.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { angleDiff } from '../../core/util.js';

const FRONT = 1.05; // rad half-angle of the armoured cone
const TURN = 0.85; // rad/s cone turn rate between attacks (0.45 while attacking)
const SILVER = 0xe8f0ff;

class Motherlode extends MiniBase {
  build() {
    this.addAttack('rock_lob', this.atkRockLob, { weight: 3 });
    this.addAttack('cart_ram', this.atkCartRam, { weight: 2 });
    this.face = Math.PI / 2;
  }

  moveBehaviour() {
    const d = this.distToPlayer();
    if (d > 250) this.steerToward(this.player.x, this.player.y, this.speed); else this.stop();
  }

  damageMultiplier(info) {
    let m = super.damageMultiplier(info);
    if (!this.p2 || info.explosion) return m;
    let src = null;
    if (info.x != null && info.y != null) src = Math.atan2(info.y - this.y, info.x - this.x);
    else if (info.angle != null) src = info.angle + Math.PI;
    if (src != null && Math.abs(angleDiff(this.face, src)) < FRONT) {
      const fx = this.scene.fx;
      fx.impact(this.x + Math.cos(src) * this.radius, this.y - 40 + Math.sin(src) * 14, src, 0.9);
      fx.burst(this.x + Math.cos(src) * this.radius, this.y - 40, { color: [0xffe6a0, 0xffffff], count: 4, speed: [80, 220], life: [120, 240], scale: [1.2, 2] });
      Sfx.play('bullet_hit_wall', { vol: 0.5, rate: 1.6 + this.rng.float(0, 0.4), gap: 0.05 });
      m *= 0.6;
    }
    return m;
  }

  update(dt) {
    if (this.alive && this.active && !this.dying) {
      const want = this.angleToPlayer();
      const step = (this.gen ? 0.45 : TURN) * dt;
      const d = angleDiff(this.face, want);
      this.face += Math.abs(d) < step ? d : Math.sign(d) * step;
      if (this.p2) {
        const c = this.cone || (this.cone = { x: 0, y: 0, a: 0, half: FRONT, len: 190, alpha: 0.11, color: SILVER });
        c.x = this.x; c.y = this.y + 20; c.a = this.face;
      }
    }
    super.update(dt);
  }
  onCancel() { if (!this.p2) this.cone = null; else if (this.cone) this.cone.alpha = 0.11; }

  // ------------------------------------------------------------------------------------------ rock lob
  *atkRockLob() {
    const s = this.scene, p = this.player, p2 = this.p2;
    this.setPose('windup');
    this.pulse(0.5);
    Sfx.play('dig', { rate: 0.6 });
    yield 0.5;
    this.setPose('attack');
    const n = p2 ? 6 : 4;
    const pts = [{ x: p.x, y: p.y }];
    const a0 = this.rng.float(0, TAU), R = p2 ? 235 : 215;
    for (let i = 0; i < n - 1; i++) {
      const a = a0 + (i / (n - 1)) * TAU;
      pts.push(this.clampIn(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, 80));
    }
    for (const q of pts) {
      this.zone(q.x, q.y, 70, { tell: 1.0, dmg: 1, kind: 'rock', fall: 'rock', fallDur: 0.4, sfx: 'rock_crumble', burstColors: [0x8a7a68, 0xc8d0e0, 0xe8dcc0] });
    }
    Sfx.play('explosion_2', { vol: 0.4, rate: 0.7 });
    if (p2) {
      let bats = 0;
      for (const e of s.enemies) if (e.alive && e.id === 'bat') bats++;
      const k = Math.min(2, 4 - bats);
      if (k > 0) this.spawnAdds('bat', k, { radius: 130, opts: { noLoot: true } });
    }
    yield 1.0;
    this.setPose('move');
    yield 0.4;
  }

  // ------------------------------------------------------------------------------------------ cart ram
  *atkCartRam() {
    const p = this.player;
    this.setPose('windup');
    this.pulse(0.4);
    Sfx.play('cart_rumble', { rate: 0.8, vol: 0.7 });
    yield 0.4;
    this.setPose('attack');
    const row = Math.max(0, Math.min(6, Math.floor((p.y - ROOM.y) / TILE)));
    const dir = this.rng.sign();
    this.sweep({
      row, dir, speed: 900, w: 96, len: 150, dmg: 2, kind: 'cart', tell: 1.0, breaks: true, color: 0xd63a2a,
      sfx: { key: 'cart_rumble', opts: { vol: 0.9 } },
      make: (sc) => {
        const im = Assets.makeCell(sc, 0, 0, 'haz_cart', 'cart_h_0', 1);
        im.setFlipX(dir < 0);
        return im;
      },
    });
    yield 1.0 + 1.5;
    this.setPose('move');
    yield 0.3;
  }
}

registerBoss('motherlode', Motherlode, { foot: 34 });
