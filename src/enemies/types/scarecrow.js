// SCARECROW (floor 2): hanged ghoul, never moves. Every ~3 s it throws its arms up (0.5 s telegraph + caw) and releases 2 CROWS
// from its body. Caps: 4 live crows per scarecrow, 8 in the room (when capped it just waits and re-checks). First release is
// delayed ~1.6 s so you can read the room. Shooting it is the answer: the crows are cheap, the post is 30 HP (x floor scaling).
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { spawnEnemy } from '../index.js';
import { Sfx } from '../../core/Audio.js';

const CAP_OWN = 4, CAP_ROOM = 8, PERIOD = 3, WINDUP = 0.5;

class Scarecrow extends Enemy {
  init() {
    this.setState('idle');
    this.cd = 1.6;
    this.crows = [];
    this.knockback = 0;
  }

  liveCrows() { this.crows = this.crows.filter((c) => c.alive); return this.crows.length; }

  ai(dt) {
    this.stop();
    this.faceToward(this.player.x);
    if (this.state !== 'idle') return;
    this.setPose('move');
    this.cd -= dt;
    if (this.cd > 0) return;
    if (this.liveCrows() > CAP_OWN - 2 || this.scene.enemies.filter((e) => e.id === 'crow').length > CAP_ROOM - 2) { this.cd = 0.6; return; }
    this.setState('release');
    Sfx.play('crow_caw', { vol: 0.6, rate: 0.75 + Math.random() * 0.1 });
    this.telegraph(WINDUP, () => {
      this.setPose('attack');
      Sfx.play('crow_caw', { vol: 0.75, rate: 1 + Math.random() * 0.2, gap: 0 });
      Sfx.play('spawn', { vol: 0.3, rate: 1.3 });
      const a0 = Math.random() * Math.PI;
      for (let i = 0; i < 2; i++) {
        const a = a0 + i * Math.PI;
        const x = this.x + Math.cos(a) * 60, y = this.y - 20 + Math.sin(a) * 36;
        this.scene.fx.burst(x, y - 30, { color: [0x1a1a1e, 0x3a3a44], count: 8, speed: [60, 200], life: [300, 600], scale: [1.5, 3], gravity: 50 });
        const c = spawnEnemy(this.scene, 'crow', x, y, { instant: true, floor: this.floor, parent: this });
        this.crows.push(c);
      }
      this.scene.fx.shake(0.003, 100);
      this.after(0.4, () => { this.setPose('move'); this.setState('idle'); this.cd = PERIOD; });
    });
  }
}

registerEnemy('scarecrow', Scarecrow, { hp: 30, r: 36, speed: 0, floors: [2], weight: 1, heavy: true });
