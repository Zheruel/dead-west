// Champion room controller (EVENTS s4): hosts the mini-boss fight. Room.startMini spawns the mini (invulnerable, inactive) and calls intro();
// the scene's boss-intro path shows the compact WANTED card and calls startFight() when it ends. The reward is Room.onMiniDefeated (via flow).
// Persistent data (state.ctl): { done, id, flawless, time } so a revisit shows the room as settled and never fights or pays twice.
import Controller from './Controller.js';
import { ROOM, DEPTH, FONT_TITLE } from '../../config.js';
import { Sfx } from '../../core/Audio.js';

export default class ChampionRoom extends Controller {
  build() {
    const { scene, room, state } = this;
    state.id = state.id || this.def.mini || null;
    this.stamp = null;
    if (state.done) {
      // the fight is over: a faint stamp on the floor where the bounty was collected
      this.stamp = this.track(scene.add.text(ROOM.cx, ROOM.cy + 250, 'BOUNTY COLLECTED', { fontFamily: FONT_TITLE, fontSize: '40px', color: '#e0a040' })
        .setOrigin(0.5).setAlpha(0.16).setAngle(-4).setDepth(DEPTH.decals + 1));
    }
    this.on('mini:defeated', (p) => {
      if (this.destroyed || !p) return;
      state.done = true; state.id = p.id; state.flawless = !!p.flawless; state.time = p.time;
    });
    this.introduced = false;
    room.champion = this;
  }

  /** The mini-boss exists (inactive, invulnerable): play the WANTED card, then the fight starts. */
  intro(boss) {
    if (this.introduced) return;
    this.introduced = true;
    const { scene, room } = this;
    this.boss = boss;
    Sfx.play('mini_intro', { vol: 0.9 });
    scene.fx.ringPulse(boss.x, boss.y, 0xe0a040, 300, 700, 0.35);
    scene.fx.shake(0.006, 400);
    if (typeof scene.beginBossIntro === 'function') scene.beginBossIntro(boss);
    else this.later(1000, () => { if (boss.alive) boss.startFight(); });
    room.state.miniIntro = true;
  }

  onMiniDefeated(mini) {
    const { scene } = this;
    this.state.done = true;
    if (mini) this.state.id = mini.id;
    scene.fx.ringPulse(ROOM.cx, ROOM.cy, 0xe0a040, 520, 800, 0.3);
    scene.fx.text(ROOM.cx, ROOM.cy - 130, 'BOUNTY PAID', { color: '#e0a040', size: 34 });
  }

  destroy() {
    this.boss = null;
    this.stamp = null;
    if (this.room.champion === this) this.room.champion = null;
    super.destroy();
  }
}
export { ChampionRoom };
