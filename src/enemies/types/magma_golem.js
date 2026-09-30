// MAGMA GOLEM (floor 4, tank / area denial; CHAPTER2 s3 no. 6). Lumbers at 55 px/s (fire-tagged: lava and fire patches do not hurt it). Every
// 4.5-5.5 s (only once the player is within ~560 px): raises its fists for 0.9 s (frame 4) while a red band (96 px wide, 5 tiles long) points at
// the player. The band tracks for 0.6 s, then LOCKS (turns gold) for the last 0.3 s: step out of it. Slam (frame 5): five eruption columns
// along the band, 96 px apart, 0.12 s between each, every one 1 dmg + a fire patch r 48 for 2.0 s (a dodge roll's i-frames pass through).
// Death: 3 fire patches r 60 for 2.5 s. Heavy: knocks back a third as far as a normal enemy.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { GroundHaz } from '../../systems/GroundHaz.js';
import { ROOM, ENEMY_DEFAULTS } from '../../config.js';
import { enemyRng, sfx, warnDepth } from '../parts/fe_e2/common.js';

const WIND = 0.9, LOCK_AT = 0.6, RECOVER = 0.7;
const BAND_W = 96, BAND_TILES = 5, COL_GAP = 96, COL_STEP = 0.12, COL_R = 52, FIRE_R = 48, FIRE_LIFE = 2.0;
const TRIGGER_DIST = 560;
const RED = 0xd63a2a, GOLD = 0xffb040;

class MagmaGolem extends Enemy {
  init() {
    this.rn = enemyRng(this);
    this.setState('walk');
    this.atkCd = this.rn.float(2.2, 3.2);
    this.knockback = ENEMY_DEFAULTS.knockback * 0.35;
    this.aimA = 0;
    this.locked = false;
    this.bandBase = null; this.bandFill = null;
  }

  // ------------------------------------------------------------------------------------------ AI
  ai(dt) {
    const p = this.player;
    this.atkCd -= dt; // 4.5-5.5 s between windup STARTS
    switch (this.state) {
      case 'walk': {
        this.setPose('move');
        this.steerToward(p.x, p.y, this.speed);
        this.faceToward(p.x);
        if (this.atkCd <= 0 && this.distToPlayer() < TRIGGER_DIST) this.startSlam();
        break;
      }
      case 'wind': {
        this.stop();
        this.faceToward(p.x);
        if (!this.locked) {
          if (this.stateTime < LOCK_AT) this.aimA = this.angleToPlayer();
          else { this.locked = true; sfx('mark_lock', 'bullet_hit_wall', { vol: 0.5, rate: 1.2 }); this.scene.fx.spark(this.x + Math.cos(this.aimA) * this.radius, this.y, this.aimA + Math.PI, false); }
        }
        break;
      }
      default: this.stop(); break;
    }
  }

  startSlam() {
    this.setState('wind');
    this.stop();
    this.locked = false;
    this.aimA = this.angleToPlayer();
    this.atkCd = this.cd(this.rn.float(4.5, 5.5));
    sfx('bull_snort', 'zombie_groan', { vol: 0.6, rate: 0.55 });
    this.telegraph(WIND, () => this.slam());
  }

  slam() {
    if (!this.alive) return;
    this.setState('slam');
    this.setPose('attack');
    this.hideBand();
    const s = this.scene, gh = GroundHaz.of(s), c = Math.cos(this.aimA), sn = Math.sin(this.aimA);
    const src = { enemy: this, enemyName: 'magma_golem' };
    let first = true;
    for (let i = 0; i < BAND_TILES; i++) {
      const dist = this.radius + COL_GAP * (i + 0.5), x = this.x + c * dist, y = this.y + sn * dist;
      if (x < ROOM.x + 12 || x > ROOM.right - 12 || y < ROOM.y + 12 || y > ROOM.bottom - 12) continue; // columns past the wall are not raised
      gh.circle({
        x, y, r: COL_R, tell: i * COL_STEP, active: 0.25, hold: 0.4, dmg: 1, kind: 'fire', color: 0xff7a1f,
        fire: { r: FIRE_R, dur: FIRE_LIFE }, source: src, shake: first, sfx: 'vent_erupt',
        burstColors: [0xff7a1f, 0xffd060, 0x3b2320],
      });
      first = false;
    }
    sfx('fire_whoosh', null, { vol: 0.6, rate: 0.7 });
    s.fx.shake(0.006, 140);
    s.fx.dust(this.x + c * this.radius, this.y + sn * this.radius + 10, 1.4);
    this.after(RECOVER, () => { if (this.state === 'slam') { this.setState('walk'); this.setPose('move'); } });
  }

  // ------------------------------------------------------------------------------------------ band telegraph
  update(dt) {
    super.update(dt);
    if (this.alive) this.drawBand();
  }

  drawBand() {
    if (this.state !== 'wind') { if (this.bandBase && this.bandBase.visible) this.hideBand(); return; }
    const s = this.scene;
    if (!this.bandBase || !this.bandBase.scene) {
      this.bandBase = s.add.image(0, 0, 'px').setOrigin(0, 0.5);
      this.bandFill = s.add.image(0, 0, 'px').setOrigin(0, 0.5);
      this.bandBase.__noSnap = true; this.bandFill.__noSnap = true;
    }
    const k = Math.min(1, this.stateTime / WIND), a = this.aimA;
    const x0 = this.x + Math.cos(a) * this.radius, y0 = this.y + Math.sin(a) * this.radius, len = BAND_TILES * COL_GAP;
    const dep = warnDepth(s.room);
    const col = this.locked ? GOLD : RED;
    this.bandBase.setVisible(true).setPosition(x0, y0).setRotation(a).setDisplaySize(len, BAND_W).setTint(col).setAlpha(this.locked ? 0.26 : 0.2).setDepth(dep);
    this.bandFill.setVisible(true).setPosition(x0, y0).setRotation(a).setDisplaySize(len, 2 + (BAND_W - 2) * k * k).setTint(col).setAlpha(this.locked ? 0.5 : 0.42).setDepth(dep + 1);
  }

  hideBand() {
    if (this.bandBase) this.bandBase.setVisible(false);
    if (this.bandFill) this.bandFill.setVisible(false);
  }

  // ------------------------------------------------------------------------------------------ death
  onDeath(info) {
    this.hideBand();
    const room = this.scene.room;
    if ((info && info.silent) || !room || !room.ignite) return;
    room.ignite(this.x, this.y, { r: 60, life: 2.5, count: 3, spread: 80 });
    this.scene.fx.burst(this.x, this.y - 40, { color: [0xff7a1f, 0xffd060, 0x3b2320], count: 22, speed: [100, 330], life: [350, 800], scale: [1.6, 3.6], gravity: 380 });
    sfx('explosion', null, { vol: 0.45, rate: 0.75 });
  }

  destroy() {
    if (this.bandBase) { this.bandBase.destroy(); this.bandBase = null; }
    if (this.bandFill) { this.bandFill.destroy(); this.bandFill = null; }
    super.destroy();
  }
}

registerEnemy('magma_golem', MagmaGolem, { fps: 6 });
