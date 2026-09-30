// STEAM STOKER (CHAPTER2 s4 #3, F5 tank / space control). Walks 65 px/s toward the player. Every 3.6 s it vents: the boiler glows 0.8 s (pose 4, red ring r 200
// drawn on the floor) -> blast (pose 5): 1 dmg inside r 200 + the player's standard 340 px/s outward knockback, then a scald cloud r 110 for 2.0 s
// (1 dmg per 0.8 s inside, see parts/fe-e3/scald.js). Death: the same cloud only (no instant damage; `silent` deaths leave none).
// Only sensible extras over the doc: the vent is held back while the player is > 480 px away (the blast would be wasted), and the 3.6 s cycle is
// measured start-to-start (windup + blast fit inside it).
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { rng } from '../../core/rng.js';
import { ScaldField, SCALD } from '../parts/fe-e3/scald.js';

const BLAST_R = 200;
const WINDUP = 0.8;
const VENT_EVERY = 3.6;
const VENT_RANGE = 480;

class SteamStoker extends Enemy {
  init() {
    this.setState('walk');
    this.ventCd = rng.game.float(1.4, 2.4);
  }

  ai(dt) {
    const p = this.player;
    this.faceToward(p.x);
    this.ventCd -= dt;
    if (this.state === 'vent') { this.stop(); return; } // planted for the windup and the blast pose
    this.setPose('move');
    this.steerToward(p.x, p.y, this.speed);
    if (this.ventCd <= 0) {
      if (this.distToPlayer() > VENT_RANGE) this.ventCd = 0.4;
      else this.startVent();
    }
  }

  startVent() {
    this.setState('vent');
    this.ventCd = this.cd(VENT_EVERY);
    this.stop();
    const x = this.x, y = this.y;
    this.scene.fx.warnCircle(x, y, BLAST_R, WINDUP);
    Sfx.play('steam_hiss', { vol: 0.8 });
    this.telegraph(WINDUP, () => this.blast(x, y));
  }

  blast(x, y) {
    const s = this.scene, p = this.player;
    this.setPose('attack');
    Sfx.play('steam_blast', { vol: 0.9 });
    s.fx.shake(0.006, 140);
    s.fx.ringPulse(x, y, 0xdde4e8, BLAST_R, 320, 0.8);
    s.fx.burst(x, y - 40, { color: [0xdde4e8, 0xffffff], count: 18, speed: [160, 380], life: [350, 700], scale: [2.5, 5], tex: 'glow', alpha: [0.6, 0] });
    if (p && !p.dead && p.canBeHit()) {
      const rr = BLAST_R + p.hurtRadius * 0.5;
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < rr * rr) p.damage(1, { x, y, enemy: this, enemyName: 'steam_stoker', kind: 'steam' }); // knock 340 px/s outward
    }
    ScaldField.of(s).add(x, y, { r: SCALD.r, life: SCALD.life });
    this.after(0.55, () => { this.setPose('move'); this.setState('walk'); });
  }

  onDeath(info) {
    if (info && info.silent) return;
    ScaldField.of(this.scene).add(this.x, this.y, { r: SCALD.r, life: SCALD.life });
    Sfx.play('steam_hiss', { vol: 0.7 });
  }
}

registerEnemy('steam_stoker', SteamStoker, { fps: 7 });
